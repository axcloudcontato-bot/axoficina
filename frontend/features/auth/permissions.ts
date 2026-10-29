import { PERMISSION_KEYS, type PermissionKey, type UserResponse } from '@oficina/contracts';

const LEGACY_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  ADMIN: PERMISSION_KEYS,
  MANAGER: PERMISSION_KEYS.filter((key) => !['finance.view', 'finance.manage', 'profiles.manage'].includes(key)),
  MECHANIC: ['dashboard.view', 'service_orders.view', 'service_orders.manage', 'appointments.view', 'customers.view', 'vehicles.view', 'alerts.view'],
  FRONT_DESK: ['dashboard.view', 'service_orders.view', 'service_orders.manage', 'service_orders.prices', 'receipts.manage', 'appointments.view', 'appointments.manage', 'customers.view', 'customers.manage', 'vehicles.view', 'vehicles.manage', 'alerts.view', 'alerts.manage'],
};

export function hasPermission(user: UserResponse | null, permission: PermissionKey): boolean {
  if (!user) return false;
  // Compatibilidade para sessões de administradores emitidas antes da
  // introdução do módulo de configurações. O backend continua sendo a fonte
  // de verdade e consulta as permissões atuais no banco a cada requisição.
  if (user.role === 'ADMIN' && permission.startsWith('settings.') && user.permissions === undefined) return true;
  return (user.permissions ?? LEGACY_PERMISSIONS[user.role] ?? []).includes(permission);
}
