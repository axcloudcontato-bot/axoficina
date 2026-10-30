import { ConfigService } from '@nestjs/config';
import { BillingService, invoiceStatusOf, safeStripeUrl, saoPauloDate } from './billing.service';

const user = { userId: 'u1', tenantId: 't1', role: 'ADMIN' as const };
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function tenantRow(overrides: Record<string, unknown> = {}) {
  return { id: TENANT_ID, name: 'Oficina Boa', legalName: null, email: 'contato@oficina.com', plan: 'completo', pendingPlan: null, billingCustomerId: null, billingSubscriptionId: null, subscriptionStatus: 'trial', subscriptionCycle: 'monthly', subscriptionDueAt: null, ...overrides };
}

function build(tenant: Record<string, unknown> | null = tenantRow(), enabled = true) {
  const db = {
    tenant: { findFirst: jest.fn().mockResolvedValue(tenant), update: jest.fn().mockResolvedValue({}) },
    user: { findFirst: jest.fn().mockResolvedValue({ email: 'admin@oficina.com' }) },
    billingInvoice: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
  const stripe = {
    enabled, createCustomer: jest.fn().mockResolvedValue('cus_1'), checkoutSession: jest.fn().mockResolvedValue('https://checkout.stripe.com/c/pay/abc'),
    changeSubscription: jest.fn(), cancelAtPeriodEnd: jest.fn().mockResolvedValue(new Date('2026-11-30T12:00:00Z')), portalSession: jest.fn().mockResolvedValue('https://billing.stripe.com/p/session/abc'),
  };
  const entitlements = { forget: jest.fn() };
  const audit = { record: jest.fn() };
  const config = new ConfigService({ FRONTEND_URL: 'https://ofix.test' });
  const service = new BillingService({ unscoped: db } as never, stripe as never, entitlements as never, audit as never, config);
  return { service, db, stripe, entitlements, audit };
}

describe('billing helpers', () => {
  it('maps a Stripe invoice status and ignores drafts', () => {
    expect(invoiceStatusOf('paid')).toBe('paid');
    expect(invoiceStatusOf('open')).toBe('pending');
    expect(invoiceStatusOf('void')).toBe('canceled');
    expect(invoiceStatusOf('uncollectible')).toBe('canceled');
    expect(invoiceStatusOf('draft')).toBeNull();
  });

  it('only keeps links that are Stripe pages over HTTPS', () => {
    expect(safeStripeUrl('https://invoice.stripe.com/i/acct/abc')).toBe('https://invoice.stripe.com/i/acct/abc');
    expect(safeStripeUrl('https://checkout.stripe.com/c/pay/abc')).toBe('https://checkout.stripe.com/c/pay/abc');
    for (const bad of ['http://invoice.stripe.com/i', 'https://stripe.com.evil.test/i', 'javascript:alert(1)', 'nope', undefined, 5]) expect(safeStripeUrl(bad)).toBeNull();
  });

  it('reads the date in São Paulo', () => {
    expect(saoPauloDate(new Date('2026-10-31T01:00:00Z'))).toBe('2026-10-30');
  });
});

describe('BillingService checkout', () => {
  it('opens the Stripe payment page and leaves the plan alone until the first payment', async () => {
    const { service, db, stripe } = build();
    const result = await service.checkout(user, { plan: 'profissional', cycle: 'monthly' });
    expect(stripe.createCustomer).toHaveBeenCalledWith({ name: 'Oficina Boa', email: 'contato@oficina.com', tenantId: TENANT_ID });
    expect(stripe.checkoutSession).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cus_1', unitAmountCents: 15990, interval: 'month', planName: 'Profissional', successUrl: 'https://ofix.test/configuracoes/assinatura?contratado=1', cancelUrl: 'https://ofix.test/configuracoes/assinatura' }));
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { billingCustomerId: 'cus_1', pendingPlan: 'profissional', subscriptionCycle: 'monthly' } });
    expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/c/pay/abc', appliedNow: false });
  });

  it('charges a year as ten months, once a year', async () => {
    const { service, stripe } = build();
    await service.checkout(user, { plan: 'essencial', cycle: 'yearly' });
    expect(stripe.checkoutSession).toHaveBeenCalledWith(expect.objectContaining({ unitAmountCents: 129900, interval: 'year' }));
  });

  it('reuses the customer it already created', async () => {
    const { service, stripe } = build(tenantRow({ billingCustomerId: 'cus_9' }));
    await service.checkout(user, { plan: 'essencial', cycle: 'monthly' });
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(stripe.checkoutSession).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cus_9' }));
  });

  it('does not hand out a payment page that is not Stripe', async () => {
    const { service, stripe } = build();
    stripe.checkoutSession.mockResolvedValue('https://evil.example/pay');
    await expect(service.checkout(user, { plan: 'essencial', cycle: 'monthly' })).resolves.toEqual({ checkoutUrl: null, appliedNow: false });
  });

  it('says so when billing is not set up on the server', async () => {
    const { service } = build(tenantRow(), false);
    await expect(service.checkout(user, { plan: 'essencial', cycle: 'monthly' })).rejects.toThrow('cobrança automática ainda não está disponível');
  });

  it('applies an upgrade of a paid subscription at once and charges the difference now', async () => {
    const { service, db, stripe, entitlements } = build(tenantRow({ plan: 'essencial', billingCustomerId: 'cus_1', billingSubscriptionId: 'sub_1', subscriptionStatus: 'active' }));
    const result = await service.checkout(user, { plan: 'completo', cycle: 'monthly' });
    expect(stripe.changeSubscription).toHaveBeenCalledWith('sub_1', { unitAmountCents: 19990, interval: 'month', planName: 'Completo', chargeNow: true });
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { plan: 'completo', pendingPlan: null, subscriptionCycle: 'monthly', subscriptionAmountCents: 19990 } });
    expect(entitlements.forget).toHaveBeenCalledWith(TENANT_ID);
    expect(result).toEqual({ checkoutUrl: null, appliedNow: true });
  });

  it('schedules a downgrade for the next payment, without a refund or a charge now', async () => {
    const { service, db, stripe } = build(tenantRow({ plan: 'completo', billingCustomerId: 'cus_1', billingSubscriptionId: 'sub_1', subscriptionStatus: 'active' }));
    const result = await service.checkout(user, { plan: 'essencial', cycle: 'monthly' });
    expect(stripe.changeSubscription).toHaveBeenCalledWith('sub_1', expect.objectContaining({ chargeNow: false }));
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { pendingPlan: 'essencial', subscriptionCycle: 'monthly' } });
    expect(result.appliedNow).toBe(false);
  });

  it('refuses to "change" to the plan already paid for', async () => {
    const { service } = build(tenantRow({ plan: 'essencial', billingCustomerId: 'cus_1', billingSubscriptionId: 'sub_1', subscriptionStatus: 'active' }));
    await expect(service.checkout(user, { plan: 'essencial', cycle: 'monthly' })).rejects.toThrow('assinatura atual');
  });

  it('starts a new checkout after a cancellation instead of editing the ending subscription', async () => {
    const { service, stripe } = build(tenantRow({ billingCustomerId: 'cus_1', billingSubscriptionId: 'sub_old', subscriptionStatus: 'canceled' }));
    await service.checkout(user, { plan: 'profissional', cycle: 'monthly' });
    expect(stripe.changeSubscription).not.toHaveBeenCalled();
    expect(stripe.checkoutSession).toHaveBeenCalled();
  });

  it('cancels at the end of the paid period and keeps access until then', async () => {
    const { service, db, stripe } = build(tenantRow({ billingSubscriptionId: 'sub_1', subscriptionStatus: 'active' }));
    await service.cancel(user);
    expect(stripe.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { pendingPlan: null, subscriptionStatus: 'canceled', subscriptionDueAt: new Date('2026-11-30T12:00:00Z') } });
  });

  it('opens the card and receipts page only for a workshop that already has a customer', async () => {
    await expect(build(tenantRow()).service.portal(user)).rejects.toThrow('Contrate um plano');
    await expect(build(tenantRow({ billingCustomerId: 'cus_1' })).service.portal(user)).resolves.toEqual({ url: 'https://billing.stripe.com/p/session/abc' });
  });

  it('reports whether a subscription is running', async () => {
    expect(await build(tenantRow({ billingSubscriptionId: 'sub_1', billingCustomerId: 'cus_1', subscriptionStatus: 'active' })).service.status(user)).toEqual({ enabled: true, hasSubscription: true, hasCustomer: true, pendingPlan: null });
    expect((await build(tenantRow({ billingSubscriptionId: 'sub_1', subscriptionStatus: 'canceled' })).service.status(user)).hasSubscription).toBe(false);
  });
});

describe('BillingService webhook', () => {
  const NEXT = Math.floor(new Date('2026-11-30T12:00:00Z').getTime() / 1000);
  const invoice = { id: 'in_1', customer: 'cus_1', subscription: 'sub_1', status: 'paid', amount_paid: 15990, amount_due: 15990, created: Math.floor(new Date('2026-10-30T15:00:00Z').getTime() / 1000), hosted_invoice_url: 'https://invoice.stripe.com/i/abc', status_transitions: { paid_at: Math.floor(new Date('2026-10-30T15:05:00Z').getTime() / 1000) }, lines: { data: [{ period: { end: NEXT } }] } };

  it('remembers the subscription when the checkout is completed', async () => {
    const { service, db } = build(tenantRow({ billingCustomerId: 'cus_1' }));
    await expect(service.handleEvent({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1', client_reference_id: TENANT_ID } } })).resolves.toEqual({ handled: true });
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { billingSubscriptionId: 'sub_1' } });
  });

  it('activates the plan chosen at checkout when the first invoice is paid, due again at the end of the period', async () => {
    const { service, db, entitlements } = build(tenantRow({ billingCustomerId: 'cus_1', billingSubscriptionId: 'sub_1', pendingPlan: 'profissional' }));
    await expect(service.handleEvent({ type: 'invoice.paid', data: { object: invoice } })).resolves.toEqual({ handled: true });
    expect(db.billingInvoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { providerPaymentId: 'in_1' }, create: expect.objectContaining({ amountCents: 15990, status: 'paid', tenantId: TENANT_ID, invoiceUrl: 'https://invoice.stripe.com/i/abc' }) }));
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { plan: 'profissional', pendingPlan: null, subscriptionStatus: 'active', subscriptionAmountCents: 15990, subscriptionDueAt: new Date(NEXT * 1000) } });
    expect(entitlements.forget).toHaveBeenCalledWith(TENANT_ID);
  });

  it('applies a scheduled downgrade with the next payment', async () => {
    const { service, db } = build(tenantRow({ billingCustomerId: 'cus_1', plan: 'completo', pendingPlan: 'essencial', subscriptionStatus: 'active', subscriptionDueAt: new Date('2026-10-30T12:00:00Z') }));
    await service.handleEvent({ type: 'invoice.paid', data: { object: invoice } });
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: expect.objectContaining({ plan: 'essencial', pendingPlan: null, subscriptionAmountCents: 12990 }) });
  });

  it('does not pull the due date back when a late notice for an older invoice arrives', async () => {
    const { service, db } = build(tenantRow({ billingCustomerId: 'cus_1', subscriptionStatus: 'active', subscriptionDueAt: new Date('2027-02-28T12:00:00Z') }));
    await service.handleEvent({ type: 'invoice.paid', data: { object: invoice } });
    expect(db.tenant.update.mock.calls[0][0].data).not.toHaveProperty('subscriptionDueAt');
  });

  it('finds the workshop by the subscription when the customer is not the one on file', async () => {
    const { service, db } = build();
    db.tenant.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(tenantRow({ billingSubscriptionId: 'sub_1' }));
    await expect(service.handleEvent({ type: 'invoice.paid', data: { object: invoice } })).resolves.toEqual({ handled: true });
    expect(db.tenant.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { billingSubscriptionId: 'sub_1', deletedAt: null } }));
  });

  it('marks the workshop late when a payment fails, keeping the earliest date', async () => {
    const failed = { ...invoice, status: 'open', due_date: null };
    const { service, db } = build(tenantRow({ billingCustomerId: 'cus_1', subscriptionStatus: 'active' }));
    await service.handleEvent({ type: 'invoice.payment_failed', data: { object: failed } });
    expect(db.billingInvoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: 'overdue' }) }));
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { subscriptionStatus: 'past_due', subscriptionDueAt: new Date('2026-10-30T12:00:00.000Z') } });
    const again = build(tenantRow({ billingCustomerId: 'cus_1', subscriptionStatus: 'past_due', subscriptionDueAt: new Date('2026-10-20T12:00:00Z') }));
    await again.service.handleEvent({ type: 'invoice.payment_failed', data: { object: failed } });
    expect(again.db.tenant.update).not.toHaveBeenCalled();
  });

  it('only records an invoice that was just issued, and skips drafts', async () => {
    const { service, db } = build(tenantRow({ billingCustomerId: 'cus_1' }));
    await service.handleEvent({ type: 'invoice.finalized', data: { object: { ...invoice, status: 'open', amount_paid: 0 } } });
    expect(db.billingInvoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: 'pending', amountCents: 15990 }) }));
    expect(db.tenant.update).not.toHaveBeenCalled();
    db.billingInvoice.upsert.mockClear();
    await expect(service.handleEvent({ type: 'invoice.finalized', data: { object: { ...invoice, status: 'draft' } } })).resolves.toEqual({ handled: false });
    expect(db.billingInvoice.upsert).not.toHaveBeenCalled();
  });

  it('ends the subscription when Stripe says it ended, but not an old one after a new start', async () => {
    const { service, db } = build(tenantRow({ billingCustomerId: 'cus_1', billingSubscriptionId: 'sub_1', subscriptionStatus: 'active' }));
    await service.handleEvent({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1' } } });
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { billingSubscriptionId: null, pendingPlan: null, subscriptionStatus: 'canceled' } });
    db.tenant.update.mockClear();
    await expect(service.handleEvent({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_old', customer: 'cus_1' } } })).resolves.toEqual({ handled: false });
    expect(db.tenant.update).not.toHaveBeenCalled();
  });

  it('ignores events it does not follow and charges of unknown customers', async () => {
    const { service, db } = build(null);
    await expect(service.handleEvent({ type: 'charge.succeeded', data: { object: { id: 'ch_1' } } })).resolves.toEqual({ handled: false });
    await expect(service.handleEvent({ type: 'invoice.paid', data: { object: invoice } })).resolves.toEqual({ handled: false });
    await expect(service.handleEvent({})).resolves.toEqual({ handled: false });
    expect(db.billingInvoice.upsert).not.toHaveBeenCalled();
  });
});
