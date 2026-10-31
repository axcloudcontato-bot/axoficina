import { Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_SECONDS = 300;

// The Stripe account is shared with another product, so the Ofix look is set per Checkout session and the account-wide
// branding in the Dashboard is left alone. The name carries the company that charges, which is what the card statement
// shows, so the payer recognizes the charge.
const CHECKOUT_BRANDING = { display_name: 'Ofix (Ax Cloud)', button_color: '#ffbe00' };

export type StripeInterval = 'month' | 'year';

// Stripe takes form bodies; nested values are written as a[b][c]=value.
export function formEncode(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, item]) => {
    if (item === undefined || item === null) return [];
    const name = prefix ? `${prefix}[${key}]` : key;
    return typeof item === 'object' ? formEncode(item as Record<string, unknown>, name) : [`${encodeURIComponent(name)}=${encodeURIComponent(String(item))}`];
  });
}

// Checks the Stripe-Signature header against the exact bytes Stripe sent: t=<time>,v1=<hmac of "<time>.<body>">.
export function verifyStripeSignature(rawBody: Buffer, header: string | undefined, secret: string, now: number = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((part) => part.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature ?? '', 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

interface StripeSubscription { id: string; current_period_end?: number; items: { data: Array<{ id: string; current_period_end?: number; price: { product: string } }> } }

// The only place that talks to Stripe. The secret key comes from the server environment and goes nowhere else.
// Failures answer 422 or 503, never 502/504: the edge in front of the site replaces those with its own error page,
// and the workshop would never see the reason.
@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);
  private readonly knownProducts = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY')) && Boolean(this.config.get<string>('STRIPE_WEBHOOK_SECRET'));
  }

  get webhookSecret(): string {
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');
  }

  async createCustomer(input: { name: string; email?: string; tenantId: string }): Promise<string> {
    const body = { name: input.name, email: input.email, metadata: { tenant_id: input.tenantId } };
    // The same workshop clicking twice must not end up with two customers.
    return (await this.request<{ id: string }>('POST', '/customers', body, `ofix-customer-${input.tenantId}`)).id;
  }

  // Stripe-hosted page where the payer chooses the payment method and pays; the subscription is created there.
  async checkoutSession(input: { customerId: string; tenantId: string; plan: string; planName: string; cycle: string; unitAmountCents: number; interval: StripeInterval; successUrl: string; cancelUrl: string }): Promise<string> {
    const metadata = { tenant_id: input.tenantId, plan: input.plan, cycle: input.cycle };
    const product = await this.ensureProduct(input.plan, input.planName);
    const session = await this.request<{ url?: string }>('POST', '/checkout/sessions', {
      mode: 'subscription', customer: input.customerId, client_reference_id: input.tenantId, locale: 'pt-BR',
      success_url: input.successUrl, cancel_url: input.cancelUrl, allow_promotion_codes: true,
      line_items: [{ quantity: 1, price_data: { currency: 'brl', unit_amount: input.unitAmountCents, recurring: { interval: input.interval }, product } }],
      metadata, subscription_data: { metadata }, branding_settings: CHECKOUT_BRANDING,
    });
    if (!session.url) throw new UnprocessableEntityException('O serviço de cobrança não devolveu a página de pagamento.');
    return session.url;
  }

  // Moves an existing subscription to another price. An upgrade is charged now (prorated); otherwise the new value starts with the next invoice.
  async changeSubscription(subscriptionId: string, input: { plan: string; unitAmountCents: number; interval: StripeInterval; planName: string; chargeNow: boolean }): Promise<void> {
    const current = await this.request<StripeSubscription>('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
    const item = current.items.data[0];
    if (!item) throw new UnprocessableEntityException('A assinatura não tem itens para alterar.');
    const product = await this.ensureProduct(input.plan, input.planName);
    await this.request('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      items: [{ id: item.id, price_data: { currency: 'brl', product, unit_amount: input.unitAmountCents, recurring: { interval: input.interval } } }],
      proration_behavior: input.chargeNow ? 'always_invoice' : 'none',
      metadata: { plan_name: input.planName },
    });
  }

  // Stops renewing at the end of the period already paid.
  async cancelAtPeriodEnd(subscriptionId: string): Promise<Date | null> {
    const subscription = await this.request<StripeSubscription>('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: true });
    const end = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
    return end ? new Date(end * 1000) : null;
  }

  // One active product per plan, with a fixed id. A product created inline by Checkout is born inactive, and Stripe
  // refuses to move a subscription onto an inactive product, so the plan change would never work.
  async ensureProduct(plan: string, planName: string): Promise<string> {
    const id = `ofix_plan_${plan}`;
    if (this.knownProducts.has(id)) return id;
    const existing = await this.request<{ active?: boolean } | null>('GET', `/products/${id}`, undefined, undefined, true);
    if (!existing) await this.request('POST', '/products', { id, name: `Ofix, plano ${planName}`, metadata: { plan } });
    else if (existing.active === false) await this.request('POST', `/products/${id}`, { active: true });
    this.knownProducts.add(id);
    return id;
  }

  // Stripe's own page to update the card and see receipts. The account's default portal is shared with every other
  // product on it, so the Ofix uses its own configuration (STRIPE_PORTAL_CONFIGURATION) when one is set.
  async portalSession(customerId: string, returnUrl: string): Promise<string> {
    const configuration = this.config.get<string>('STRIPE_PORTAL_CONFIGURATION') || undefined;
    const session = await this.request<{ url?: string }>('POST', '/billing_portal/sessions', { customer: customerId, return_url: returnUrl, configuration });
    if (!session.url) throw new UnprocessableEntityException('O serviço de cobrança não devolveu a página.');
    return session.url;
  }

  private async request<T = unknown>(method: string, path: string, body?: Record<string, unknown>, idempotencyKey?: string, nullOn404 = false): Promise<T> {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new ServiceUnavailableException('A cobrança automática ainda não está configurada.');
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
        body: body ? formEncode(body).join('&') : undefined,
      });
    } catch (error) {
      this.logger.warn(`${method} ${path} sem resposta: ${error instanceof Error ? error.name : 'erro'}`);
      throw new ServiceUnavailableException('Não foi possível falar com o serviço de cobrança agora. Tente novamente em instantes.');
    }
    if (nullOn404 && response.status === 404) return null as T;
    const payload = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!response.ok || !payload) {
      // The provider's reason goes to the server log (never the key or the body we sent), so a failed call can be diagnosed.
      const reason = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      this.logger.warn(`${method} ${path} -> ${response.status} ${reason?.code ?? ''} ${reason?.message ?? ''}`.trim());
    }
    if (!response.ok || !payload) throw new UnprocessableEntityException(payload?.error?.message ?? 'O serviço de cobrança recusou a operação.');
    return payload;
  }
}
