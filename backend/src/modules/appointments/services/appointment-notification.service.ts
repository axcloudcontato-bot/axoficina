import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Appointment } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { WaAkgService } from '../../settings/services/wa-akg.service';
import { whatsappRecipient } from '../../settings/services/whatsapp-recipient';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const HOUR_MS = 3_600_000;
const RETRY_DELAY_MS = 15 * 60_000;
const MAX_REMINDER_ATTEMPTS = 4;

export type AppointmentMessageKind = 'CONFIRMATION' | 'REMINDER';

// Plain text the workshop sends about a booked visit; the customer answers in the chat.
export function appointmentMessage(kind: AppointmentMessageKind, input: { customerName: string; workshopName: string; startsAt: Date; timeZone: string; service: string; vehicle: string }) {
  const firstName = input.customerName.trim().split(/\s+/)[0];
  const when = new Intl.DateTimeFormat('pt-BR', { timeZone: input.timeZone, weekday: 'long', day: '2-digit', month: '2-digit' }).format(input.startsAt);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: input.timeZone, hour: '2-digit', minute: '2-digit' }).format(input.startsAt);
  const body = kind === 'REMINDER'
    ? `Olá, ${firstName}! 👋 Passando para lembrar do seu horário na ${input.workshopName}: *${when}, às ${time}*.`
    : `Olá, ${firstName}! 👋 Seu horário na ${input.workshopName} está marcado para *${when}, às ${time}*.`;
  const closing = kind === 'REMINDER' ? 'Se precisar remarcar, é só responder esta mensagem. Até lá! 🚗' : 'Podemos confirmar? Responda esta mensagem para confirmar ou remarcar. 🚗';
  return `${body}\n\n🔧 ${input.service}\n🚘 ${input.vehicle}\n\n${closing}`;
}

@Injectable()
export class AppointmentNotificationService {
  private readonly logger = new Logger(AppointmentNotificationService.name);
  constructor(private readonly prisma: PrismaService, private readonly whatsapp: WaAkgService) {}

  private async timeZone(tenantId: string) {
    return (await this.prisma.unscoped.customerCareSettings.findFirst({ where: { tenantId }, select: { timeZone: true } }))?.timeZone ?? DEFAULT_TIME_ZONE;
  }

  private async content(appointment: Appointment, kind: AppointmentMessageKind) {
    const [tenant, customer, vehicle, timeZone] = await Promise.all([
      this.prisma.unscoped.tenant.findFirst({ where: { id: appointment.tenantId, deletedAt: null } }),
      this.prisma.unscoped.customer.findFirst({ where: { id: appointment.customerId, tenantId: appointment.tenantId, deletedAt: null } }),
      this.prisma.unscoped.vehicle.findFirst({ where: { id: appointment.vehicleId, tenantId: appointment.tenantId, deletedAt: null } }),
      this.timeZone(appointment.tenantId),
    ]);
    const recipient = customer ? whatsappRecipient(customer.phone) : null;
    if (!tenant || !customer || !recipient) return null;
    return { recipient, text: appointmentMessage(kind, { customerName: customer.name, workshopName: tenant.name, startsAt: appointment.startsAt, timeZone, service: appointment.serviceDescription, vehicle: vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : 'seu veículo' }) };
  }

  // Sent by someone at the front desk; failures surface to them.
  async sendConfirmation(appointment: Appointment) {
    const connection = await this.whatsapp.getConnection(appointment.tenantId);
    if (!connection) throw new ConflictException('O WhatsApp da oficina não está ativo. Configure-o ou envie pelo seu celular.');
    const content = await this.content(appointment, 'CONFIRMATION');
    if (!content) throw new ConflictException('O cliente não tem um celular válido para WhatsApp.');
    await this.whatsapp.sendNotice(connection, content.recipient, content.text);
    await this.prisma.client.appointment.updateMany({ where: { id: appointment.id }, data: { confirmationSentAt: new Date() } });
  }

  // Hourly: one reminder per appointment, between 2 and 24 hours ahead, only in daytime hours.
  async sendDueReminders(now = new Date()) {
    let sent = 0;
    const tenants = await this.prisma.unscoped.tenant.findMany({ where: { appointmentRemindersEnabled: true, waAkgEnabled: true, status: 'active', deletedAt: null }, select: { id: true } });
    for (const tenant of tenants) {
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: await this.timeZone(tenant.id), hour: '2-digit', hourCycle: 'h23' }).format(now));
      if (hour < 8 || hour >= 20) continue;
      const retryBefore = new Date(now.getTime() - RETRY_DELAY_MS);
      const due = await this.prisma.unscoped.appointment.findMany({ where: { tenantId: tenant.id, deletedAt: null, reminderSentAt: null, reminderAttempts: { lt: MAX_REMINDER_ATTEMPTS }, AND: [{ OR: [{ reminderClaimedAt: null }, { reminderClaimedAt: { lt: retryBefore } }] }, { OR: [{ reminderAttemptedAt: null }, { reminderAttemptedAt: { lt: retryBefore } }] }], status: { in: ['SCHEDULED', 'CONFIRMED'] }, startsAt: { gt: new Date(now.getTime() + 2 * HOUR_MS), lte: new Date(now.getTime() + 24 * HOUR_MS) } }, orderBy: { startsAt: 'asc' }, take: 200 });
      if (!due.length) continue;
      let connection: Awaited<ReturnType<WaAkgService['getConnection']>> = null;
      let connectionError: string | null = null;
      try { connection = await this.whatsapp.getConnection(tenant.id); }
      catch (error) { connectionError = error instanceof Error ? error.message : 'WhatsApp indisponível.'; }
      for (const appointment of due) {
        // A short lease prevents concurrent workers from sending the same reminder.
        const claimed = await this.prisma.unscoped.appointment.updateMany({ where: { id: appointment.id, tenantId: tenant.id, reminderSentAt: null, reminderAttempts: { lt: MAX_REMINDER_ATTEMPTS }, OR: [{ reminderClaimedAt: null }, { reminderClaimedAt: { lt: retryBefore } }] }, data: { reminderClaimedAt: now, reminderAttemptedAt: now, reminderAttempts: { increment: 1 } } });
        if (claimed.count !== 1) continue;
        try {
          if (!connection) throw new Error(connectionError ?? 'WhatsApp indisponível.');
          const content = await this.content(appointment, 'REMINDER');
          if (!content) throw new Error('Cliente sem celular válido para o lembrete.');
          await this.whatsapp.sendNotice(connection, content.recipient, content.text);
          await this.prisma.unscoped.appointment.updateMany({ where: { id: appointment.id, tenantId: tenant.id, reminderClaimedAt: now }, data: { reminderSentAt: new Date(), reminderClaimedAt: null, reminderLastError: null } });
          sent++;
        } catch (error) {
          const reason = error instanceof Error ? error.message.slice(0, 500) : 'Provedor não confirmou o envio.';
          const uncertain = error instanceof BadGatewayException;
          await this.prisma.unscoped.appointment.updateMany({ where: { id: appointment.id, tenantId: tenant.id, reminderClaimedAt: now }, data: { reminderClaimedAt: null, reminderLastError: reason, ...(uncertain ? { reminderAttempts: MAX_REMINDER_ATTEMPTS } : {}) } });
          this.logger.warn(uncertain ? `Lembrete do agendamento ${appointment.id} não foi confirmado; verifique o histórico antes de reenviar.` : `Lembrete do agendamento ${appointment.id} falhou; nova tentativa será feita quando possível.`);
        }
      }
    }
    return { sent };
  }

  async reminderHealth(tenantId: string) {
    const now = new Date();
    const [failed, lastSent, lastFailure, items] = await Promise.all([
      this.prisma.client.appointment.count({ where: { tenantId, deletedAt: null, reminderSentAt: null, reminderAttempts: { gt: 0 }, startsAt: { gt: now } } }),
      this.prisma.client.appointment.findFirst({ where: { tenantId, reminderSentAt: { not: null } }, orderBy: { reminderSentAt: 'desc' }, select: { reminderSentAt: true } }),
      this.prisma.client.appointment.findFirst({ where: { tenantId, reminderLastError: { not: null } }, orderBy: { reminderAttemptedAt: 'desc' }, select: { reminderAttemptedAt: true, reminderLastError: true } }),
      this.prisma.client.appointment.findMany({ where: { tenantId, deletedAt: null, reminderSentAt: null, reminderAttempts: { gt: 0 }, startsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, take: 10, select: { id: true, startsAt: true, reminderAttempts: true, reminderLastError: true } }),
    ]);
    return { failed, lastSentAt: lastSent?.reminderSentAt?.toISOString() ?? null, lastFailureAt: lastFailure?.reminderAttemptedAt?.toISOString() ?? null, lastError: lastFailure?.reminderLastError ?? null, items: items.map((item) => ({ id: item.id, startsAt: item.startsAt.toISOString(), attempts: item.reminderAttempts, error: item.reminderLastError })) };
  }

  async retryReminder(tenantId: string, id: string) {
    const appointment = await this.prisma.client.appointment.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');
    if (appointment.reminderSentAt || appointment.reminderAttempts < 1 || !['SCHEDULED', 'CONFIRMED'].includes(appointment.status) || appointment.startsAt <= new Date()) throw new BadRequestException('Este agendamento não pode receber outro lembrete.');
    const now = new Date();
    if (appointment.reminderClaimedAt && appointment.reminderClaimedAt > new Date(now.getTime() - RETRY_DELAY_MS)) throw new ConflictException('Há uma tentativa em andamento. Aguarde alguns minutos.');
    const claimed = await this.prisma.client.appointment.updateMany({ where: { id, tenantId, reminderSentAt: null, OR: [{ reminderClaimedAt: null }, { reminderClaimedAt: { lt: new Date(now.getTime() - RETRY_DELAY_MS) } }] }, data: { reminderClaimedAt: now, reminderAttemptedAt: now, reminderAttempts: { increment: 1 } } });
    if (claimed.count !== 1) throw new ConflictException('O lembrete foi alterado. Atualize a página e tente novamente.');
    try {
      const connection = await this.whatsapp.getConnection(tenantId);
      if (!connection) throw new BadRequestException('Ative o WhatsApp da oficina antes de tentar novamente.');
      const content = await this.content(appointment, 'REMINDER');
      if (!content) throw new BadRequestException('Cliente sem celular válido para o lembrete.');
      await this.whatsapp.sendNotice(connection, content.recipient, content.text);
      await this.prisma.client.appointment.updateMany({ where: { id, tenantId, reminderClaimedAt: now }, data: { reminderSentAt: new Date(), reminderClaimedAt: null, reminderLastError: null } });
      return { sent: true };
    } catch (error) {
      await this.prisma.client.appointment.updateMany({ where: { id, tenantId, reminderClaimedAt: now }, data: { reminderClaimedAt: null, reminderLastError: error instanceof Error ? error.message.slice(0, 500) : 'Falha no envio do lembrete.' } });
      throw error;
    }
  }
}
