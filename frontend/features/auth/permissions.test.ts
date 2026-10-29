import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions';

describe('hasPermission', () => {
  const user = { id: 'u1', tenantId: 't1', name: 'Admin', email: 'admin@example.invalid', role: 'ADMIN' as const, status: 'active' as const, createdAt: new Date().toISOString() };

  it('honors an explicit profile with no settings permission', () => {
    expect(hasPermission({ ...user, permissions: [] }, 'settings.manage')).toBe(false);
    expect(hasPermission({ ...user, permissions: ['settings.view'] }, 'settings.manage')).toBe(false);
  });

  it('keeps the legacy fallback only for sessions without a permission list', () => {
    expect(hasPermission(user, 'settings.view')).toBe(true);
  });
});
