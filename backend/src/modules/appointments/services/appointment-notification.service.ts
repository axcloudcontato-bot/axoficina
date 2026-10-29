import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Appointment } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { WaAkgService } from '../../settings/services/wa-akg.service';
import { whatsappRecipient } from '../../settings/services/whatsapp-recipient';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const HOUR_MS = 3_600_000;

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
      const due = await this.prisma.unscoped.appointment.findMany({ where: { tenantId: tenant.id, deletedAt: null, reminderSentAt: null, status: { in: ['SCHEDULED', 'CONFIRMED'] }, startsAt: { gt: new Date(now.getTime() + 2 * HOUR_MS), lte: new Date(now.getTime() + 24 * HOUR_MS) } }, orderBy: { startsAt: 'asc' }, take: 200 });
      if (!due.length) continue;
      let connection;
      try { connection = await this.whatsapp.getConnection(tenant.id); } catch { continue; }
      if (!connection) continue;
      for (const appointment of due) {
        const content = await this.content(appointment, 'REMINDER');
        if (!content) continue;
        // Claim first: a reminder is never sent twice, even if the provider fails.
        const claimed = await this.prisma.unscoped.appointment.updateMany({ where: { id: appointment.id, tenantId: tenant.id, reminderSentAt: null }, data: { reminderSentAt: now } });
        if (claimed.count !== 1) continue;
        try { await this.whatsapp.sendNotice(connection, content.recipient, content.text); sent++; }
        catch { this.logger.warn(`Lembrete do agendamento ${appointment.id} não confirmado pelo provedor.`); }
      }
    }
    return { sent };
  }
}
