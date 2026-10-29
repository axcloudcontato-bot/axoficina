import { Module, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { CUSTOMER_CARE_QUEUE } from '../../shared/queue/queue.module';
import { SettingsModule } from '../settings/settings.module';
import { CustomerCareService } from './customer-care.service';
import { CustomerCarePlansService } from './customer-care-plans.service';
import { CustomerCareAutomationService } from './customer-care-automation.service';
import { CustomerCareForecastService } from './customer-care-forecast.service';
import { CustomerCareController, CustomerCarePreferencesController } from './customer-care.controller';

@Processor(CUSTOMER_CARE_QUEUE, { concurrency: 1 })
class CustomerCareProcessor extends WorkerHost {
  constructor(private readonly automation: CustomerCareAutomationService) { super(); }
  async process(job: Job) { if (job.name === 'scan') return this.automation.scan(); return this.automation.dispatch(); }
}

@Module({
  imports: [SettingsModule],
  controllers: [CustomerCareController, CustomerCarePreferencesController],
  providers: [CustomerCareService, CustomerCarePlansService, CustomerCareAutomationService, CustomerCareForecastService, ...(process.env.NODE_ENV === 'test' ? [] : [CustomerCareProcessor])],
  exports: [CustomerCarePlansService],
})
export class CustomerCareModule implements OnModuleInit {
  constructor(@InjectQueue(CUSTOMER_CARE_QUEUE) private readonly queue: Queue) {}
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    await this.queue.add('scan', {}, { jobId: 'customer-care-hourly-scan', repeat: { pattern: '0 * * * *' }, removeOnComplete: 50, removeOnFail: 50 });
    await this.queue.add('dispatch', {}, { jobId: 'customer-care-outbox-dispatch', repeat: { every: 60_000 }, removeOnComplete: 50, removeOnFail: 50 });
  }
}
