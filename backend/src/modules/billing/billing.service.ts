import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLANS, planPriceCents, resolvePlan, type BillingCycle, type BillingInvoiceResponse, type BillingStatusResponse, type CheckoutRequest, type CheckoutResponse, type InvoiceStatus, type PlanCode } from '@oficina/contracts';
import { AuditLogService } from '../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { EntitlementsService } from '../../shared/plan/entitlements.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StripeClient } from './stripe.client';

interface StripeLine { period?: { end?: number } }
export interface StripeObject {
  id?: string; mode?: string; customer?: string | null; subscription?: string | null; client_reference_id?: string | null;
  status?: string; amount_paid?: number; amount_due?: number; due_date?: number | null; created?: number; hosted_invoice_url?: string | null;
  status_transitions?: { paid_at?: number | null }; lines?: { data?: StripeLine[] };
  metadata?: Record<string, string>; subscription_details?: { metadata?: Record<string, string> };
  parent?: { subscription_details?: { subscription?: string } };
}
export interface StripeEvent { id?: string; type?: string; data?: { object?: StripeObject } }

// The invoice page is opened by the workshop, so only Stripe pages are kept.
export function safeStripeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)stripe\.com$/.test(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

// São Paulo calendar date (UTC-3) of a moment, as YYYY-MM-DD.
export function saoPauloDate(moment: Date = new Date()): string {
  return new Date(moment.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function invoiceStatusOf(status: string | undefined): InvoiceStatus | null {
  if (status === 'paid') return 'paid';
  if (status === 'open') return 'pending';
  if (status === 'void' || status === 'uncollectible') return 'canceled';
  return null; // draft: nothing to show yet
}

const RANK: Record<PlanCode, number> = { essencial: 0, profissional: 1, completo: 2 };
const interval = (cycle: BillingCycle) => (cycle === 'yearly' ? 'year' : 'month');

const BILLING_SELECT = { id: true, name: true, legalName: true, email: true, plan: true, pendingPlan: true, billingCustomerId: true, billingSubscriptionId: true, subscriptionStatus: true, subscriptionCycle: true, subscriptionDueAt: true } as const;
interface TenantBilling { id: string; name: string; legalName: string | null; email: string | null; plan: string; pendingPlan: string | null; billingCustomerId: string | null; billingSubscriptionId: string | null; subscriptionStatus: string; subscriptionCycle: string; subscriptionDueAt: Date | null }

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService, private readonly stripe: StripeClient, private readonly entitlements: EntitlementsService, private readonly audit: AuditLogService, private readonly config: ConfigService) {}

  async status(user: AuthenticatedUser): Promise<BillingStatusResponse> {
    const tenant = await this.tenant(user.tenantId);
    return {
      enabled: this.stripe.enabled,
      hasSubscription: Boolean(tenant.billingSubscriptionId) && tenant.subscriptionStatus !== 'canceled',
      hasCustomer: Boolean(tenant.billingCustomerId),
      pendingPlan: (tenant.pendingPlan as PlanCode | null) ?? null,
    };
  }

  async invoices(user: AuthenticatedUser): Promise<{ items: BillingInvoiceResponse[] }> {
    const rows = await this.prisma.unscoped.billingInvoice.findMany({ where: { tenantId: user.tenantId }, orderBy: { dueDate: 'desc' }, take: 36 });
    return { items: rows.map((row) => ({ id: row.id, amountCents: row.amountCents, dueDate: row.dueDate.toISOString().slice(0, 10), status: row.status as InvoiceStatus, paidAt: row.paidAt?.toISOString() ?? null, invoiceUrl: row.invoiceUrl })) };
  }

  async checkout(user: AuthenticatedUser, request: CheckoutRequest): Promise<CheckoutResponse> {
    this.requireEnabled();
    const tenant = await this.tenant(user.tenantId);
    const cycle = request.cycle;
    const plan = PLANS[request.plan];
    const unitAmountCents = planPriceCents(request.plan, cycle);
    const resumable = Boolean(tenant.billingSubscriptionId) && tenant.subscriptionStatus !== 'canceled';

    if (!resumable) {
      const customerId = tenant.billingCustomerId ?? await this.newCustomer(user, tenant);
      const page = `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')}/configuracoes/assinatura`;
      const url = await this.stripe.checkoutSession({ customerId, tenantId: tenant.id, plan: plan.code, planName: plan.name, cycle, unitAmountCents, interval: interval(cycle), successUrl: `${page}?contratado=1`, cancelUrl: page });
      await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { billingCustomerId: customerId, pendingPlan: plan.code, subscriptionCycle: cycle } });
      await this.record(user, 'billing.checkout_started', tenant.id, plan.code, cycle);
      return { checkoutUrl: safeStripeUrl(url), appliedNow: false };
    }

    const current = resolvePlan(tenant.plan).code;
    if (request.plan === current && cycle === tenant.subscriptionCycle && !tenant.pendingPlan) throw new ConflictException('Esta já é a sua assinatura atual.');
    const upgrade = RANK[request.plan] > RANK[current];
    await this.stripe.changeSubscription(tenant.billingSubscriptionId!, { plan: plan.code, unitAmountCents, interval: interval(cycle), planName: plan.name, chargeNow: upgrade });
    const now = upgrade || request.plan === current;
    const data = now
      ? { plan: request.plan, pendingPlan: null, subscriptionCycle: cycle, subscriptionAmountCents: unitAmountCents }
      : { pendingPlan: request.plan, subscriptionCycle: cycle };
    await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data });
    this.entitlements.forget(tenant.id);
    await this.record(user, upgrade ? 'billing.plan_upgraded' : 'billing.plan_change_scheduled', tenant.id, request.plan, cycle);
    return { checkoutUrl: null, appliedNow: now };
  }

  // Stops renewing. What was already paid keeps working until its date.
  async cancel(user: AuthenticatedUser): Promise<void> {
    this.requireEnabled();
    const tenant = await this.tenant(user.tenantId);
    if (!tenant.billingSubscriptionId || tenant.subscriptionStatus === 'canceled') throw new BadRequestException('Não há uma assinatura automática para cancelar.');
    const endsAt = await this.stripe.cancelAtPeriodEnd(tenant.billingSubscriptionId);
    await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { pendingPlan: null, subscriptionStatus: 'canceled', ...(endsAt ? { subscriptionDueAt: endsAt } : {}) } });
    this.entitlements.forget(tenant.id);
    await this.record(user, 'billing.canceled', tenant.id);
  }

  // Stripe's page to update the card and see receipts.
  async portal(user: AuthenticatedUser): Promise<{ url: string }> {
    this.requireEnabled();
    const tenant = await this.tenant(user.tenantId);
    if (!tenant.billingCustomerId) throw new BadRequestException('Contrate um plano antes de gerenciar o pagamento.');
    const url = safeStripeUrl(await this.stripe.portalSession(tenant.billingCustomerId, `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')}/configuracoes/assinatura`));
    if (!url) throw new BadRequestException('Não foi possível abrir a página de pagamento.');
    return { url };
  }

  // Stripe tells us when a checkout ends, a charge is paid or fails, and a subscription ends; the workshop's plan follows.
  async handleEvent(event: StripeEvent): Promise<{ handled: boolean }> {
    const object = event.data?.object;
    if (!event.type || !object) return { handled: false };
    const tenant = await this.tenantOf(object);
    if (!tenant) return { handled: false };

    switch (event.type) {
      case 'checkout.session.completed':
        if (object.mode !== 'subscription' || !object.subscription) return { handled: false };
        await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { billingSubscriptionId: object.subscription, ...(object.customer && !tenant.billingCustomerId ? { billingCustomerId: object.customer } : {}) } });
        return { handled: true };
      case 'invoice.finalized':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
        return { handled: await this.mirror(tenant, object, invoiceStatusOf(object.status)) };
      case 'invoice.paid':
        if (!(await this.mirror(tenant, object, 'paid'))) return { handled: false };
        await this.applyPayment(tenant, this.periodEnd(object));
        return { handled: true };
      case 'invoice.payment_failed':
        await this.mirror(tenant, object, 'overdue');
        await this.applyOverdue(tenant, object);
        return { handled: true };
      case 'customer.subscription.deleted':
        // An old subscription ending after the workshop already started a new one must not undo the new one.
        if (tenant.billingSubscriptionId && tenant.billingSubscriptionId !== object.id) return { handled: false };
        await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { billingSubscriptionId: null, pendingPlan: null, subscriptionStatus: 'canceled' } });
        this.entitlements.forget(tenant.id);
        await this.audit.record({ tenantId: tenant.id, action: 'billing.subscription_ended', entity: 'tenant', entityId: tenant.id, metadata: { status: 'canceled' } });
        return { handled: true };
      default:
        return { handled: false };
    }
  }

  private async mirror(tenant: TenantBilling, invoice: StripeObject, status: InvoiceStatus | null): Promise<boolean> {
    if (!invoice.id || !status) return false;
    const amountCents = (invoice.amount_paid ?? 0) > 0 ? invoice.amount_paid! : (invoice.amount_due ?? 0);
    const dueDate = new Date(`${saoPauloDate(new Date((invoice.due_date ?? invoice.created ?? Date.now() / 1000) * 1000))}T00:00:00.000Z`);
    const paidAt = status === 'paid' ? new Date((invoice.status_transitions?.paid_at ?? Date.now() / 1000) * 1000) : null;
    const invoiceUrl = safeStripeUrl(invoice.hosted_invoice_url);
    await this.prisma.unscoped.billingInvoice.upsert({
      where: { providerPaymentId: invoice.id },
      create: { tenantId: tenant.id, providerPaymentId: invoice.id, amountCents, dueDate, status, paidAt, invoiceUrl },
      update: { amountCents, dueDate, status, paidAt, ...(invoiceUrl ? { invoiceUrl } : {}) },
    });
    return true;
  }

  // The end of the period this charge pays for, which is the date the next one is due.
  private periodEnd(invoice: StripeObject): Date | null {
    const ends = (invoice.lines?.data ?? []).map((line) => line.period?.end ?? 0).filter((end) => end > 0);
    return ends.length ? new Date(Math.max(...ends) * 1000) : null;
  }

  private async applyPayment(tenant: TenantBilling, nextDue: Date | null) {
    const cycle = tenant.subscriptionCycle as BillingCycle;
    const plan = resolvePlan(tenant.pendingPlan ?? tenant.plan).code;
    // A late notice for an older charge must not pull the next due date back.
    const keep = !nextDue || (tenant.subscriptionStatus === 'active' && tenant.subscriptionDueAt !== null && tenant.subscriptionDueAt > nextDue);
    await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { plan, pendingPlan: null, subscriptionStatus: 'active', subscriptionAmountCents: planPriceCents(plan, cycle), ...(keep ? {} : { subscriptionDueAt: nextDue }) } });
    this.entitlements.forget(tenant.id);
    await this.audit.record({ tenantId: tenant.id, action: 'billing.payment_confirmed', entity: 'tenant', entityId: tenant.id, metadata: { plan, cycle, amountCents: planPriceCents(plan, cycle) } });
  }

  private async applyOverdue(tenant: TenantBilling, invoice: StripeObject) {
    const due = new Date(`${saoPauloDate(new Date((invoice.due_date ?? invoice.created ?? Date.now() / 1000) * 1000))}T12:00:00.000Z`);
    if (tenant.subscriptionStatus === 'past_due' && tenant.subscriptionDueAt && tenant.subscriptionDueAt <= due) return;
    await this.prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { subscriptionStatus: 'past_due', subscriptionDueAt: due } });
    this.entitlements.forget(tenant.id);
    await this.audit.record({ tenantId: tenant.id, action: 'billing.payment_overdue', entity: 'tenant', entityId: tenant.id, metadata: { status: 'past_due' } });
  }

  private async tenantOf(object: StripeObject): Promise<TenantBilling | null> {
    const db = this.prisma.unscoped.tenant;
    const find = (where: Record<string, unknown>) => db.findFirst({ where: { ...where, deletedAt: null }, select: BILLING_SELECT });
    if (object.customer) {
      const byCustomer = await find({ billingCustomerId: object.customer });
      if (byCustomer) return byCustomer;
    }
    const subscription = object.subscription ?? object.parent?.subscription_details?.subscription;
    if (subscription) {
      const bySubscription = await find({ billingSubscriptionId: subscription });
      if (bySubscription) return bySubscription;
    }
    // The reference we put on the checkout ties it back to the workshop.
    const reference = object.client_reference_id ?? object.metadata?.tenant_id ?? object.subscription_details?.metadata?.tenant_id;
    return reference && /^[0-9a-f-]{36}$/i.test(reference) ? find({ id: reference }) : null;
  }

  private async newCustomer(user: AuthenticatedUser, tenant: TenantBilling): Promise<string> {
    const admin = await this.prisma.unscoped.user.findFirst({ where: { id: user.userId, tenantId: tenant.id }, select: { email: true } });
    return this.stripe.createCustomer({ name: tenant.legalName || tenant.name, email: tenant.email ?? admin?.email ?? undefined, tenantId: tenant.id });
  }

  private requireEnabled() {
    if (!this.stripe.enabled) throw new BadRequestException('A cobrança automática ainda não está disponível. Fale com o suporte do Ofix para contratar ou trocar de plano.');
  }

  private async tenant(id: string): Promise<TenantBilling> {
    const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id, deletedAt: null }, select: BILLING_SELECT });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    return tenant;
  }

  private record(user: AuthenticatedUser, action: string, tenantId: string, plan?: string, cycle?: string) {
    return this.audit.record({ tenantId, userId: user.userId, action, entity: 'tenant', entityId: tenantId, metadata: { ...(plan ? { plan } : {}), ...(cycle ? { cycle } : {}) } });
  }
}
