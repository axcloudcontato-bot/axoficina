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

describe('StripeClient plan products', () => {
  afterEach(() => jest.restoreAllMocks());

  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  function client() {
    return new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }));
  }
  const callsOf = (fetchMock: jest.SpyInstance) => fetchMock.mock.calls.map((call) => `${(call[1] as { method: string }).method} ${String(call[0]).replace('https://api.stripe.com/v1', '')}`);
  const bodyOf = (fetchMock: jest.SpyInstance, index: number) => new URLSearchParams(String((fetchMock.mock.calls[index][1] as { body: string }).body));

  it('creates the plan product once, with a fixed id, when Stripe does not have it yet', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(answer(404, { error: { code: 'resource_missing' } }))
      .mockResolvedValueOnce(answer(200, { id: 'ofix_plan_essencial' }));
    const stripe = client();
    await expect(stripe.ensureProduct('essencial', 'Essencial')).resolves.toBe('ofix_plan_essencial');
    expect(callsOf(fetchMock)).toEqual(['GET /products/ofix_plan_essencial', 'POST /products']);
    expect(bodyOf(fetchMock, 1).get('id')).toBe('ofix_plan_essencial');
    expect(bodyOf(fetchMock, 1).get('name')).toBe('Ofix, plano Essencial');
    await stripe.ensureProduct('essencial', 'Essencial');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('leaves an active product alone and turns an archived one back on', async () => {
    const active = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(answer(200, { id: 'ofix_plan_completo', active: true }));
    await client().ensureProduct('completo', 'Completo');
    expect(callsOf(active)).toEqual(['GET /products/ofix_plan_completo']);
    jest.restoreAllMocks();
    const archived = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(answer(200, { id: 'ofix_plan_completo', active: false }))
      .mockResolvedValueOnce(answer(200, { id: 'ofix_plan_completo', active: true }));
    await client().ensureProduct('completo', 'Completo');
    expect(callsOf(archived)).toEqual(['GET /products/ofix_plan_completo', 'POST /products/ofix_plan_completo']);
    expect(bodyOf(archived, 1).get('active')).toBe('true');
  });

  it('moves a subscription onto the target plan product, never the old inactive one', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(answer(200, { id: 'sub_1', items: { data: [{ id: 'si_1', price: { product: 'prod_inactive' } }] } }))
      .mockResolvedValueOnce(answer(200, { id: 'ofix_plan_essencial', active: true }))
      .mockResolvedValueOnce(answer(200, { id: 'sub_1' }));
    await client().changeSubscription('sub_1', { plan: 'essencial', unitAmountCents: 12990, interval: 'month', planName: 'Essencial', chargeNow: false });
    const update = bodyOf(fetchMock, 2);
    expect(update.get('items[0][price_data][product]')).toBe('ofix_plan_essencial');
    expect(update.get('items[0][id]')).toBe('si_1');
    expect(update.get('proration_behavior')).toBe('none');
  });

  function checkoutFetch(options: { uploads: boolean }) {
    return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/products/')) return answer(200, { id: 'ofix_plan_profissional', active: true });
      if (url.startsWith('https://ofix.test/')) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
      if (url.startsWith('https://files.stripe.com/')) return options.uploads ? answer(200, { id: url.includes('x') ? 'file_1' : 'file_2' }) : answer(403, { error: { code: 'permission_error', message: 'sem permissão para arquivos' } });
      return answer(200, { url: 'https://checkout.stripe.com/c/pay/abc' });
    });
  }
  const checkoutInput = { customerId: 'cus_1', tenantId: 't1', plan: 'profissional', planName: 'Profissional', cycle: 'monthly', unitAmountCents: 15990, interval: 'month' as const, successUrl: 'https://x/y', cancelUrl: 'https://x/z' };
  const sessionBody = (fetchMock: jest.SpyInstance) => {
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/checkout/sessions'));
    return new URLSearchParams(String((call?.[1] as { body: string }).body));
  };
  const withSite = () => new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', FRONTEND_URL: 'https://ofix.test' }));

  it('puts the plan product, not an inline one, in the checkout, with the Ofix name and colour', async () => {
    const fetchMock = checkoutFetch({ uploads: true });
    await withSite().checkoutSession(checkoutInput);
    const session = sessionBody(fetchMock);
    expect(session.get('line_items[0][price_data][product]')).toBe('ofix_plan_profissional');
    expect(session.has('line_items[0][price_data][product_data][name]')).toBe(false);
    expect(session.get('branding_settings[display_name]')).toBe('Ofix (Ax Cloud)');
    expect(session.get('branding_settings[button_color]')).toBe('#ffbe00');
  });

  it('uploads the logo and the icon once and shows them on the checkout page', async () => {
    const fetchMock = checkoutFetch({ uploads: true });
    const stripe = withSite();
    await stripe.checkoutSession(checkoutInput);
    const session = sessionBody(fetchMock);
    expect(session.get('branding_settings[logo][type]')).toBe('file');
    expect(session.get('branding_settings[logo][file]')).toMatch(/^file_/);
    expect(session.get('branding_settings[icon][file]')).toMatch(/^file_/);
    const uploads = () => fetchMock.mock.calls.filter((c) => String(c[0]).startsWith('https://files.stripe.com/')).length;
    expect(uploads()).toBe(2);
    await stripe.checkoutSession(checkoutInput);
    expect(uploads()).toBe(2);
  });

  it('still opens the checkout, without the images, when Stripe refuses the upload, and does not hammer it', async () => {
    const fetchMock = checkoutFetch({ uploads: false });
    const stripe = withSite();
    await expect(stripe.checkoutSession(checkoutInput)).resolves.toBe('https://checkout.stripe.com/c/pay/abc');
    const session = sessionBody(fetchMock);
    expect(session.get('branding_settings[display_name]')).toBe('Ofix (Ax Cloud)');
    expect(session.has('branding_settings[logo][file]')).toBe(false);
    expect(session.has('branding_settings[icon][file]')).toBe(false);
    const attempts = fetchMock.mock.calls.filter((c) => String(c[0]).startsWith('https://files.stripe.com/')).length;
    await stripe.checkoutSession(checkoutInput);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).startsWith('https://files.stripe.com/')).length).toBe(attempts);
  });
});
