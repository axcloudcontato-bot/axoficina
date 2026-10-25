import { Module } from '@nestjs/common';
import { SaasAdminGuard, SaasAdminService } from './saas-admin.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsManager } from './subscriptions.manager';
import { SubscriptionsRepository } from './subscriptions.repository';

@Module({
  controllers: [SubscriptionsController],
  providers: [SaasAdminService, SaasAdminGuard, SubscriptionsManager, SubscriptionsRepository],
})
export class SubscriptionsModule {}
