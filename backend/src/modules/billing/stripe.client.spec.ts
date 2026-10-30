import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { BillingWebhookController } from './billing-webhook.controller';
import { formEncode, StripeClient, verifyStripeSignature } from './stripe.client';

const secret = 'whsec_teste';
const body = Buffer.from('{"id":"evt_1","type":"invoice.paid"}');
const now = 1_790_000_000_000;
function sign(payload: Buffer, at = now / 1000, key = secret) {
  return `t=${at},v1=${createHmac('sha256', key).update(`${at}.`).update(payload).digest('hex')}`;
}

describe('formEncode', () => {
  it('writes nested values the way Stripe reads them and skips empty ones', () => {
    expect(formEncode({ mode: 'subscription', email: undefined, line_items: [{ quantity: 1, price_data: { currency: 'brl', recurring: { interval: 'month' } } }], metadata: { tenant_id: 'a b' } })).toEqual([
      'mode=subscription',
      'line_items%5B0%5D%5Bquantity%5D=1',
      'line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=brl',
      'line_items%5B0%5D%5Bprice_data%5D%5Brecurring%5D%5Binterval%5D=month',
      'metadata%5Btenant_id%5D=a%20b',
    ]);
  });
});

describe('verifyStripeSignature', () => {
  it('accepts the signature of the exact body', () => {
    expect(verifyStripeSignature(body, sign(body), secret, now)).toBe(true);
  });

  it('accepts when one of several signatures matches (secret rotation)', () => {
    expect(verifyStripeSignature(body, `${sign(body)},v1=${'0'.repeat(64)}`, secret, now)).toBe(true);
  });

  it('refuses a changed body, a wrong secret, a missing header and a missing secret', () => {
    expect(verifyStripeSignature(Buffer.from('{"id":"evt_2"}'), sign(body), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, now / 1000, 'outro'), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, undefined, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body), '', now)).toBe(false);
    expect(verifyStripeSignature(body, 'lixo', secret, now)).toBe(false);
  });

  it('refuses a signature older than five minutes, so a captured call cannot be replayed', () => {
    expect(verifyStripeSignature(body, sign(body, now / 1000 - 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, now / 1000 - 299), secret, now)).toBe(true);
  });
});

describe('StripeClient', () => {
  it('stays off until both the key and the webhook secret are set', () => {
    expect(new StripeClient(new ConfigService({})).enabled).toBe(false);
    expect(new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_x' })).enabled).toBe(false);
    expect(new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' })).enabled).toBe(true);
  });
});

describe('BillingWebhookController', () => {
  function build() {
    const billing = { handleEvent: jest.fn().mockResolvedValue({ handled: true }) };
    const stripe = { webhookSecret: secret };
    return { controller: new BillingWebhookController(billing as never, stripe as never), billing };
  }
  const request = (rawBody?: Buffer) => ({ rawBody }) as never;

  it('hands a signed event to the billing service', async () => {
    const { controller, billing } = build();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await expect(controller.receive(sign(body), request(body))).resolves.toEqual({ handled: true });
    expect(billing.handleEvent).toHaveBeenCalledWith({ id: 'evt_1', type: 'invoice.paid' });
    jest.restoreAllMocks();
  });

  it('refuses a bad signature without reading the event', async () => {
    const { controller, billing } = build();
    await expect(controller.receive('t=1,v1=00', request(body))).rejects.toThrow('Assinatura inválida');
    await expect(controller.receive(undefined, request(body))).rejects.toThrow('Assinatura inválida');
    expect(billing.handleEvent).not.toHaveBeenCalled();
  });

  it('refuses a call whose body could not be kept for checking', async () => {
    const { controller } = build();
    await expect(controller.receive(sign(body), request(undefined))).rejects.toThrow('indisponível');
  });
});

describe('StripeClient portal session', () => {
  const body = (call: unknown[]) => new URLSearchParams(String((call[1] as { body: string }).body));
  afterEach(() => jest.restoreAllMocks());

  function client(env: Record<string, string>) {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/abc' }), { status: 200 }));
    return { stripe: new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', ...env })), fetchMock };
  }

  it('uses the Ofix portal configuration when one is set, so the shared default is left alone', async () => {
    const { stripe, fetchMock } = client({ STRIPE_PORTAL_CONFIGURATION: 'bpc_ofix' });
    await expect(stripe.portalSession('cus_1', 'https://ofix.test/x')).resolves.toBe('https://billing.stripe.com/p/session/abc');
    expect(body(fetchMock.mock.calls[0]).get('configuration')).toBe('bpc_ofix');
    expect(body(fetchMock.mock.calls[0]).get('customer')).toBe('cus_1');
  });

  it('falls back to the account default when none is set', async () => {
    const { stripe, fetchMock } = client({});
    await stripe.portalSession('cus_1', 'https://ofix.test/x');
    expect(body(fetchMock.mock.calls[0]).has('configuration')).toBe(false);
  });
});
