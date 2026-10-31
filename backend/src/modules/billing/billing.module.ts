import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { StripeClient } from './stripe.client';

@Module({ controllers: [BillingController, BillingWebhookController], providers: [StripeClient, BillingService], exports: [StripeClient] })
export class BillingModule {}
