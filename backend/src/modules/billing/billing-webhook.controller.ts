import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../shared/decorators/public.decorator';
import { BillingService, type StripeEvent } from './billing.service';
import { StripeClient, verifyStripeSignature } from './stripe.client';

// Stripe calls this when a checkout ends or a charge changes. It carries no session, only a signature of the exact body.
@Controller('api/v1/webhooks/billing')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService, private readonly stripe: StripeClient) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async receive(@Headers('stripe-signature') signature: string | undefined, @Req() req: Request & { rawBody?: Buffer }) {
    if (!req.rawBody) throw new BadRequestException('Payload do webhook indisponível.');
    if (!verifyStripeSignature(req.rawBody, signature, this.stripe.webhookSecret)) throw new UnauthorizedException('Assinatura inválida.');
    const event: unknown = JSON.parse(req.rawBody.toString('utf8'));
    if (typeof event !== 'object' || event === null || Array.isArray(event)) throw new BadRequestException('Payload inválido.');
    // A failure here answers 5xx on purpose: Stripe retries, and every step is safe to repeat.
    return this.billing.handleEvent(event as StripeEvent);
  }
}
