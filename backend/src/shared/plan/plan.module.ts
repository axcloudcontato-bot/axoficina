import { Global, Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { EntitlementsService } from './entitlements.service';
import { PlanUsageService } from './plan-usage.service';

@Global()
@Module({ controllers: [PlanController], providers: [EntitlementsService, PlanUsageService], exports: [EntitlementsService, PlanUsageService] })
export class PlanModule {}
