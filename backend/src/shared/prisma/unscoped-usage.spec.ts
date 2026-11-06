import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// `prisma.unscoped` skips the automatic workshop filter, so each use is a place where a forgotten `tenantId` leaks
// another workshop's data. Jobs, webhooks, sign-in and invites have no workshop context and need it; everything else
// should use `prisma.client`. Adding a use, or removing one, changes the count below: the change then shows up in
// review, where the question is whether the query filters `tenantId` by hand or is cross-workshop on purpose.
const EXPECTED_USES: Record<string, number> = {
  'health/health.controller.ts': 1,
  'modules/account-closure/account-closure.service.ts': 8,
  'modules/appointments/services/appointment-notification.service.ts': 10,
  'modules/billing/billing.service.ts': 13,
  'modules/customer-care/customer-care-automation.service.ts': 29,
  'modules/customer-care/customer-care-forecast.service.ts': 5,
  'modules/customer-care/customer-care-plans.service.ts': 14,
  'modules/customer-care/customer-care.service.ts': 22,
  'modules/customers/repositories/customer.repository.ts': 2,
  'modules/fipe/repositories/fipe-brand.repository.ts': 2,
  'modules/fipe/repositories/fipe-model.repository.ts': 2,
  'modules/iam/repositories/refresh-token.repository.ts': 7,
  'modules/iam/repositories/role.repository.ts': 11,
  'modules/iam/repositories/tenant.repository.ts': 5,
  'modules/iam/repositories/user.repository.ts': 7,
  'modules/maintenance-alerts/repositories/maintenance-alert.repository.ts': 1,
  'modules/service-orders/managers/service-order.manager.ts': 1,
  'modules/service-orders/repositories/customer-message.repository.ts': 7,
  'modules/service-orders/repositories/service-order-status-notification.repository.ts': 4,
  'modules/service-orders/repositories/service-order.repository.ts': 2,
  'modules/service-orders/services/productivity.service.ts': 2,
  'modules/service-orders/services/service-order-status-notification.service.ts': 6,
  'modules/settings/services/workshop-account.service.ts': 1,
  'modules/support/support.repository.ts': 2,
  'modules/subscriptions/subscriptions.repository.ts': 2,
  'modules/vehicles/repositories/vehicle.repository.ts': 2,
  'shared/audit-log/audit-log.repository.ts': 1,
  'shared/plan/entitlements.service.ts': 1,
  'shared/plan/plan-usage.service.ts': 1,
};

const SOURCE_ROOT = join(__dirname, '..', '..');
const DEFINITION = 'shared/prisma/prisma.service.ts';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

function actualUses(): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const name = relative(SOURCE_ROOT, file).split(sep).join('/');
    if (name === DEFINITION) continue;
    const count = (readFileSync(file, 'utf8').match(/\.unscoped\b/g) ?? []).length;
    if (count > 0) uses[name] = count;
  }
  return uses;
}

describe('prisma.unscoped usage', () => {
  it('matches the reviewed list, so a new unfiltered query cannot slip in unnoticed', () => {
    expect(actualUses()).toEqual(EXPECTED_USES);
  });
});
