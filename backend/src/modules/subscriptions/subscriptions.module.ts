import { Module } from '@nestjs/common';
import { AccountClosureModule } from '../account-closure/account-closure.module';
import { SaasAdminGuard, SaasAdminService } from './saas-admin.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsManager } from './subscriptions.manager';
import { SubscriptionsRepository } from './subscriptions.repository';

@Module({
  imports: [AccountClosureModule],
  controllers: [SubscriptionsController],
  providers: [SaasAdminService, SaasAdminGuard, SubscriptionsManager, SubscriptionsRepository],
})
export class SubscriptionsModule {}
