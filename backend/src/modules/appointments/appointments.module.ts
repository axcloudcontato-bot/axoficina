import { Module, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { APPOINTMENT_REMINDERS_QUEUE } from '../../shared/queue/queue.module';
import { SettingsModule } from '../settings/settings.module';
import { AppointmentNotificationService } from './services/appointment-notification.service';
import { CustomersModule } from '../customers/customers.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { IamModule } from '../iam/iam.module';
import { ServiceOrdersModule } from '../service-orders/service-orders.module';
import { AppointmentsController } from './controllers/appointments.controller';
import { AppointmentManager } from './managers/appointment.manager';
import { AppointmentRepository } from './repositories/appointment.repository';

@Processor(APPOINTMENT_REMINDERS_QUEUE, { concurrency: 1 })
class AppointmentRemindersProcessor extends WorkerHost {
  constructor(private readonly notifications: AppointmentNotificationService) { super(); }
  async process() { return this.notifications.sendDueReminders(); }
}

@Module({
  imports: [CustomersModule, VehiclesModule, IamModule, ServiceOrdersModule, SettingsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentManager, AppointmentRepository, AppointmentNotificationService, ...(process.env.NODE_ENV === 'test' ? [] : [AppointmentRemindersProcessor])],
})
export class AppointmentsModule implements OnModuleInit {
  constructor(@InjectQueue(APPOINTMENT_REMINDERS_QUEUE) private readonly queue: Queue) {}
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    await this.queue.add('reminders', {}, { jobId: 'appointment-reminders-hourly', repeat: { pattern: '5 * * * *' }, removeOnComplete: 50, removeOnFail: 50 });
  }
}
