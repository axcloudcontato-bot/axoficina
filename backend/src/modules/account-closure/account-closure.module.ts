import { InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ACCOUNT_CLOSURE_QUEUE } from '../../shared/queue/queue.module';
import { BillingModule } from '../billing/billing.module';
import { PasswordService } from '../iam/services/password.service';
import { AccountClosureController } from './account-closure.controller';
import { AccountClosureProcessor } from './account-closure.processor';
import { AccountClosureService } from './account-closure.service';

const DAILY_PURGE_CRON = '0 5 * * *';
// A real Worker connects to Redis as soon as the module exists; the e2e files each boot the whole app, so they skip it
// (same reasoning as the maintenance-alerts and FIPE modules).
const PROCESSORS = process.env.NODE_ENV === 'test' ? [] : [AccountClosureProcessor];

@Module({
  imports: [BillingModule],
  controllers: [AccountClosureController],
  providers: [AccountClosureService, PasswordService, ...PROCESSORS],
  exports: [AccountClosureService],
})
export class AccountClosureModule implements OnModuleInit {
  constructor(@InjectQueue(ACCOUNT_CLOSURE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.queue.add('purge-due', {}, { repeat: { pattern: DAILY_PURGE_CRON }, jobId: 'account-closure-daily-purge' });
  }
}
