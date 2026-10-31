import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOSURE_GRACE_DAYS, type CloseAccountRequest, type CloseAccountResponse, type ClosedBy } from '@oficina/contracts';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { EntitlementsService } from '../../shared/plan/entitlements.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StripeClient } from '../billing/stripe.client';
import { PasswordService } from '../iam/services/password.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const DAY_MS = 86_400_000;
const PURGE_BATCH = 20;

// Rows that belong to a workshop only through their parent (they carry no tenant_id of their own).
const CHILDREN_OF_TENANT_ROWS: ReadonlyArray<readonly [table: string, column: string, parent: string]> = [
  ['service_order_items', 'service_order_id', 'service_orders'],
  ['service_order_status_history', 'service_order_id', 'service_orders'],
  ['catalog_package_items', 'package_id', 'catalog_packages'],
];
// These point at financial_entries, so they go first.
const FIRST = ['financial_entry_payments', 'financial_entry_attachments', 'financial_reconciliations'];
// Handled on their own, in a fixed place of the order.
const SPECIAL = new Set(['users', 'roles', 'tenants', 'account_closures']);

export const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

@Injectable()
export class AccountClosureService {
  private readonly logger = new Logger(AccountClosureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeClient,
    private readonly entitlements: EntitlementsService,
    private readonly passwords: PasswordService,
  ) {}

  // The workshop's administrator closing their own account. Password and the typed name stop an accidental click.
  async closeAsOwner(user: AuthenticatedUser, input: CloseAccountRequest): Promise<CloseAccountResponse> {
    const tenant = await this.activeTenant(user.tenantId);
    const actor = await this.prisma.unscoped.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId, status: 'active', deletedAt: null }, select: { passwordHash: true } });
    if (!actor?.passwordHash || !(await this.passwords.verify(input.password, actor.passwordHash))) throw new ForbiddenException('Confirme sua senha atual para encerrar a conta.');
    this.requireName(tenant.name, input.confirmName);
    return this.close(tenant, 'owner', user.userId, null);
  }

  async closeAsManager(tenantId: string, reason: string | null | undefined, actor: AuthenticatedUser): Promise<CloseAccountResponse> {
    return this.close(await this.activeTenant(tenantId), 'saas_admin', actor.userId, reason ?? null);
  }

  // Undoes a closure while the data is still there. The subscription is not revived: the workshop contracts a plan again.
  async restore(tenantId: string, actor: AuthenticatedUser): Promise<void> {
    const tenant = await this.closedTenant(tenantId);
    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: tenant.id }, data: { deletedAt: null, closedBy: null, closureReason: null, purgeAfter: null } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, userId: actor.userId, action: 'account.restored', entity: 'tenant', entityId: tenant.id, metadata: {} } });
    });
    this.entitlements.forget(tenant.id);
  }

  // The manager erasing a closed workshop for good, before the 30 days are up.
  async purgeAsManager(tenantId: string, confirmName: string): Promise<void> {
    const tenant = await this.closedTenant(tenantId);
    this.requireName(tenant.name, confirmName);
    await this.purge(tenant.id);
  }

  // The daily job: erases the workshops whose grace period is over.
  async purgeDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.unscoped.tenant.findMany({ where: { deletedAt: { not: null }, purgeAfter: { lte: now } }, select: { id: true }, take: PURGE_BATCH });
    let erased = 0;
    for (const { id } of due) {
      try {
        await this.purge(id);
        erased += 1;
      } catch (error) {
        this.logger.error(`Não foi possível apagar a oficina ${id}: ${error instanceof Error ? error.message : 'erro'}`);
      }
    }
    return erased;
  }

  private async close(tenant: ClosableTenant, by: ClosedBy, userId: string, reason: string | null): Promise<CloseAccountResponse> {
    // The billing stops first: a closed account must never keep being charged.
    if (tenant.billingSubscriptionId) await this.endBilling(tenant.billingSubscriptionId);
    const now = new Date();
    const purgeAfter = new Date(now.getTime() + CLOSURE_GRACE_DAYS * DAY_MS);
    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: tenant.id }, data: { deletedAt: now, closedBy: by, closureReason: reason?.trim().slice(0, 500) || null, purgeAfter, subscriptionStatus: 'canceled', billingSubscriptionId: null, pendingPlan: null } });
      const users = await tx.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      await tx.refreshToken.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, userId, action: 'account.closed', entity: 'tenant', entityId: tenant.id, metadata: { closedBy: by } } });
    });
    this.entitlements.forget(tenant.id);
    return { purgeAfter: purgeAfter.toISOString() };
  }

  private async endBilling(subscriptionId: string): Promise<void> {
    if (!this.stripe.enabled) throw new ConflictException('A cobrança automática está indisponível e esta oficina tem uma assinatura. Cancele a assinatura no painel do Stripe e tente de novo.');
    try {
      await this.stripe.cancelNow(subscriptionId);
    } catch (error) {
      // Already gone on Stripe's side: nothing left to stop.
      if (error instanceof HttpException && /no such subscription/i.test(error.message)) return;
      throw error;
    }
  }

  // Removes everything of a closed workshop: its rows, its files and the tenant itself.
  private async purge(tenantId: string): Promise<void> {
    if (!UUID.test(tenantId)) throw new BadRequestException('Identificador inválido.');
    const tenant = await this.closedTenant(tenantId);
    const tables = await this.tenantTables();
    await this.prisma.unscoped.$transaction(async (tx) => {
      for (const [table, column, parent] of CHILDREN_OF_TENANT_ROWS) await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "${column}" IN (SELECT id FROM "${parent}" WHERE tenant_id = $1::uuid)`, tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "role_permissions" WHERE role_id IN (SELECT id FROM "roles" WHERE tenant_id = $1::uuid)', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "refresh_tokens" WHERE user_id IN (SELECT id FROM "users" WHERE tenant_id = $1::uuid)', tenantId);
      for (const table of orderTables(tables)) await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE tenant_id = $1::uuid`, tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "users" WHERE tenant_id = $1::uuid', tenantId);
      await tx.$executeRawUnsafe('DELETE FROM "roles" WHERE tenant_id = $1::uuid', tenantId);
      await tx.accountClosure.create({ data: { tenantId, closedBy: tenant.closedBy ?? 'saas_admin', closedAt: tenant.deletedAt ?? new Date() } });
      await tx.$executeRawUnsafe('DELETE FROM "tenants" WHERE id = $1::uuid', tenantId);
    }, { timeout: 120_000 });
    await this.removeFiles(tenantId);
    this.entitlements.forget(tenantId);
    this.logger.log(`Oficina ${tenantId} apagada definitivamente.`);
  }

  // Every table that carries a tenant_id, found in the database itself so a table added later is covered too.
  private async tenantTables(): Promise<string[]> {
    const rows = await this.prisma.unscoped.$queryRawUnsafe<Array<{ table_name: string }>>("SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'tenant_id'");
    return rows.map((row) => row.table_name).filter((name) => IDENTIFIER.test(name) && !SPECIAL.has(name));
  }

  // Photos live on disk under the workshop's id.
  private async removeFiles(tenantId: string): Promise<void> {
    const root = resolve(this.config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads')));
    await rm(join(root, tenantId), { recursive: true, force: true });
  }

  private async activeTenant(id: string): Promise<ClosableTenant> {
    const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id, deletedAt: null }, select: CLOSABLE });
    if (!tenant) throw new NotFoundException('Oficina não encontrada.');
    return tenant;
  }

  private async closedTenant(id: string) {
    const tenant = await this.prisma.unscoped.tenant.findFirst({ where: { id, deletedAt: { not: null } }, select: { id: true, name: true, closedBy: true, deletedAt: true } });
    if (!tenant) throw new NotFoundException('Não há oficina encerrada com este identificador.');
    return tenant;
  }

  private requireName(actual: string, typed: string) {
    if (!sameName(actual, typed)) throw new BadRequestException('O nome digitado não confere com o nome da oficina.');
  }
}

export function orderTables(tables: string[]): string[] {
  return [...FIRST.filter((table) => tables.includes(table)), ...tables.filter((table) => !FIRST.includes(table)).sort()];
}

const CLOSABLE = { id: true, name: true, billingSubscriptionId: true } as const;
interface ClosableTenant { id: string; name: string; billingSubscriptionId: string | null }
