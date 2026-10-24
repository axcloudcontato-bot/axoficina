import type { PermissionKey } from '@oficina/contracts';

export const NAVIGATION_DESTINATIONS: Array<{ href: string; label: string; permission?: PermissionKey }> = [
  { href: '/dashboard', label: 'Visão da oficina', permission: 'dashboard.view' },
  { href: '/service-orders', label: 'Ordens de serviço', permission: 'service_orders.view' },
  { href: '/appointments', label: 'Agenda', permission: 'appointments.view' },
  { href: '/customers', label: 'Clientes', permission: 'customers.view' },
  { href: '/vehicles', label: 'Veículos', permission: 'vehicles.view' },
  { href: '/maintenance-alerts', label: 'Alertas de manutenção', permission: 'alerts.view' },
  { href: '/financial', label: 'Financeiro', permission: 'finance.view' },
  { href: '/financial/suppliers', label: 'Fornecedores', permission: 'finance.manage' },
  { href: '/productivity', label: 'Produtividade', permission: 'service_orders.prices' },
  { href: '/settings/company', label: 'Configurações: empresa e marca', permission: 'settings.view' },
  { href: '/settings/email', label: 'Configurações: e-mail', permission: 'settings.view' },
  { href: '/settings/team', label: 'Equipe e acesso', permission: 'team.view' },
  { href: '/settings/privacy', label: 'Privacidade e solicitações' },
];

export function normalizeNavigationSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
