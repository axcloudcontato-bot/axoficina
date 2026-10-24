import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import { WaAkgService } from '../../settings/services/wa-akg.service';
import { CustomerMessageManager } from '../managers/customer-message.manager';

class WaAkgWebhookParams { @IsUUID() tenantId!: string; }

@Controller('api/v1/webhooks/wa-akg')
export class WaAkgWebhookController {
  constructor(private readonly whatsapp: WaAkgService, private readonly messages: CustomerMessageManager) {}

  @Public()
  @Post(':tenantId')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async receive(@Param() params: WaAkgWebhookParams, @Headers('x-webhook-signature') signature: string | undefined, @Req() req: Request & { rawBody?: Buffer }) {
    if (!req.rawBody) throw new BadRequestException('Payload do webhook indisponível.');
    const connection = await this.whatsapp.verifyWebhook(params.tenantId, signature, req.rawBody);
    const payload: unknown = JSON.parse(req.rawBody.toString('utf8'));
    if (!isRecord(payload)) throw new BadRequestException('Payload inválido.');
    if (payload.event === 'test') return { received: true, recorded: false };
    if (payload.event !== 'message.received' || payload.sessionId !== connection.sessionId || !isRecord(payload.data)) return { received: true, recorded: false };
    const data = payload.data;
    if (data.isGroup === true || (isRecord(data.key) && data.key.fromMe === true) || !['INTERACTIVE_RESPONSE', 'BUTTON_RESPONSE'].includes(String(data.type))) return { received: true, recorded: false };
    if (typeof data.from !== 'string' || typeof data.content !== 'string' || !/^\d{10,15}@s\.whatsapp\.net$/.test(data.from)) return { received: true, recorded: false };
    return this.messages.answerFromWhatsApp(params.tenantId, String(payload.sessionId), data.from, data.content);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
