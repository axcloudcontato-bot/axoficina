import { Injectable } from '@nestjs/common';
import type { AppointmentStatus } from '@oficina/contracts';
import type { Appointment } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface AppointmentWriteInput {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  technicianId?: string | null;
  startsAt: Date;
  endsAt: Date;
  serviceDescription: string;
  notes?: string | null;
  createdBy: string;
}

@Injectable()
export class AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  insert(input: AppointmentWriteInput): Promise<Appointment> {
    return this.prisma.client.appointment.create({ data: { ...input, status: 'SCHEDULED' } });
  }

  byId(id: string): Promise<Appointment | null> {
    return this.prisma.client.appointment.findFirst({ where: { id, deletedAt: null } });
  }

  async update(id: string, input: Omit<AppointmentWriteInput, 'tenantId' | 'createdBy'>, resetReminder = false) {
    return this.prisma.client.appointment.updateMany({
      where: { id, deletedAt: null },
      data: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        technicianId: input.technicianId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        serviceDescription: input.serviceDescription,
        notes: input.notes,
        ...(resetReminder ? { reminderSentAt: null, reminderClaimedAt: null, reminderAttemptedAt: null, reminderAttempts: 0, reminderLastError: null } : {}),
      },
    });
  }

  async transition(id: string, fromStatus: AppointmentStatus, toStatus: AppointmentStatus) {
    return this.prisma.client.appointment.updateMany({
      where: { id, status: fromStatus, deletedAt: null },
      data: { status: toStatus, cancelledAt: toStatus === 'CANCELLED' ? new Date() : undefined },
    });
  }

  async linkServiceOrder(id: string, serviceOrderId: string) {
    return this.prisma.client.appointment.updateMany({
      where: { id, serviceOrderId: null, deletedAt: null },
      data: { serviceOrderId, status: 'IN_SERVICE' },
    });
  }

  listByPeriod(startsAt: Date, endsAt: Date, technicianId?: string, status?: AppointmentStatus): Promise<Appointment[]> {
    return this.prisma.client.appointment.findMany({
      where: {
        deletedAt: null,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(technicianId ? { technicianId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  // Vehicles expected in the workshop during the interval.
  overlapping(startsAt: Date, endsAt: Date, excludeId?: string): Promise<number> {
    return this.prisma.client.appointment.count({
      where: {
        deletedAt: null,
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  conflicts(startsAt: Date, endsAt: Date, technicianId: string, excludeId?: string): Promise<Appointment[]> {
    return this.prisma.client.appointment.findMany({
      where: {
        deletedAt: null,
        technicianId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
  }
}
