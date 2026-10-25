import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { SERVICE_ORDER_STATUS_QUEUE } from '../../../shared/queue/queue.module';
import { ServiceOrderStatusNotificationService } from '../services/service-order-status-notification.service';

@Processor(SERVICE_ORDER_STATUS_QUEUE, { concurrency: 1 })
export class ServiceOrderStatusNotificationProcessor extends WorkerHost implements OnModuleInit {
  constructor(private readonly notifications: ServiceOrderStatusNotificationService, @InjectQueue(SERVICE_ORDER_STATUS_QUEUE) private readonly queue: Queue) { super(); }
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    await this.queue.add('dispatch', {}, { repeat: { every: 5_000 }, jobId: 'status-notification-scan', removeOnComplete: 10, removeOnFail: 20 });
  }
  async process() {
    // Tests dispatch explicitly against their mocked provider; another test
    // application must never consume their data through a background sender.
    if (process.env.NODE_ENV !== 'test') await this.notifications.dispatchPending();
  }
}
