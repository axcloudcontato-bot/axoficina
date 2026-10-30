import { Global, Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({ controllers: [PlanController], providers: [EntitlementsService], exports: [EntitlementsService] })
export class PlanModule {}
