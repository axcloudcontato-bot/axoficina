import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseController } from '../api-docs/generate-api-docs';

const SOURCE_ROOT = join(__dirname, '..', '..');

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

// POSTs that only read: this API is RPC, so filters and reports travel in the body.
const READS = new Set([
  '/api/v1/appointments/list', '/api/v1/customer-care/preview', '/api/v1/customer-care/plans/contacts',
  '/api/v1/customers/archive-impact', '/api/v1/customers/export', '/api/v1/customers/list', '/api/v1/customers/overview',
  '/api/v1/financial/attachments/list', '/api/v1/financial/attachments/download', '/api/v1/financial/cash-flow',
  '/api/v1/maintenance-alerts/list', '/api/v1/maintenance-alerts/contacts',
  '/api/v1/service-orders/list', '/api/v1/service-orders/status-notifications/list', '/api/v1/service-orders/installments/due',
  '/api/v1/service-orders/technician-productivity', '/api/v1/service-orders/technician-productivity/me',
  '/api/v1/service-orders/technician-productivity/trend', '/api/v1/service-orders/technician-productivity/commissions',
  '/api/v1/service-orders/technician-productivity/orders',
  '/api/v1/users/list', '/api/v1/vehicles/archive-impact', '/api/v1/vehicles/list', '/api/v1/vehicles/overview',
  '/api/v1/settings/audit-log',
]);

// Writes that must keep working when the subscription is not active, each for a reason.
const ALLOWED_WHEN_VIEW_ONLY = new Set([
  // Paying again and leaving: nobody may be locked out of these.
  '/api/v1/billing/checkout', '/api/v1/billing/portal', '/api/v1/billing/cancel', '/api/v1/account/close',
  // Security: an ex-employee must still be removable, and a session or password still changeable.
  '/api/v1/users/disable', '/api/v1/users/delete', '/api/v1/users/password-reset-link',
  '/api/v1/auth/change-password', '/api/v1/auth/sessions', '/api/v1/auth/sessions/revoke', '/api/v1/auth/sessions/revoke-others',
  // First-access setup: the wizard blocks every screen, so it has to be finishable before reaching the subscription page.
  '/api/v1/settings/company', '/api/v1/settings/onboarding/complete',
  // Rights of the data subject and access to support do not depend on the subscription.
  '/api/v1/privacy/requests', '/api/v1/privacy/requests/resolve', '/api/v1/privacy/customers/export', '/api/v1/privacy/customers/erase', '/api/v1/privacy/account/erase',
  '/api/v1/support/tickets',
  // Closing what is already open adds nothing, and reading a notification changes no business data.
  '/api/v1/service-orders/work-sessions/stop', '/api/v1/service-orders/idle-time/stop', '/api/v1/customer-reply-notifications/:id/read',
  // Global catalog of vehicles, not the workshop's data.
  '/api/v1/fipe/sync',
]);

const routes = () => controllerFiles(SOURCE_ROOT).flatMap((file) => parseController(readFileSync(file, 'utf8')));

describe('view-only subscription', () => {
  it('every route that changes workshop data refuses it when the account is view-only', () => {
    const open = routes()
      .filter((route) => route.method !== 'GET' && route.access !== 'público' && route.access !== 'administrador do SaaS')
      .filter((route) => !route.extras.includes('limite') && !READS.has(route.path) && !ALLOWED_WHEN_VIEW_ONLY.has(route.path))
      .map((route) => `${route.method} ${route.path}`);
    expect(open).toEqual([]);
  });

  it('keeps its exceptions pointing at routes that exist', () => {
    const paths = new Set(routes().map((route) => route.path));
    expect([...READS, ...ALLOWED_WHEN_VIEW_ONLY].filter((path) => !paths.has(path))).toEqual([]);
  });
});
