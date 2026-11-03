import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminSupportController, SupportController } from './support.controller';
import { SupportRepository } from './support.repository';
import { SupportService } from './support.service';

@Module({ imports: [SubscriptionsModule], controllers: [SupportController, AdminSupportController], providers: [SupportRepository, SupportService] })
export class SupportModule {}
