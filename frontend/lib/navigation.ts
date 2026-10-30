import type { PermissionKey } from '@oficina/contracts';

export const NAVIGATION_DESTINATIONS: Array<{ href: string; label: string; permission?: PermissionKey }> = [
  { href: '/relacionamento', label: 'Cuidado com o cliente: aniversários e lembretes', permission: 'alerts.view' },
  { href: '/painel', label: 'Visão da oficina', permission: 'dashboard.view' },
  { href: '/ordens-de-servico', label: 'Ordens de serviço', permission: 'service_orders.view' },
  { href: '/agenda', label: 'Agenda', permission: 'appointments.view' },
  { href: '/clientes', label: 'Clientes', permission: 'customers.view' },
  { href: '/veiculos', label: 'Veículos', permission: 'vehicles.view' },
  { href: '/alertas-de-manutencao', label: 'Alertas de manutenção', permission: 'alerts.view' },
  { href: '/catalogo', label: 'Catálogo de peças, produtos e serviços', permission: 'service_orders.prices' },
  { href: '/financeiro', label: 'Financeiro', permission: 'finance.view' },
  { href: '/financeiro/fornecedores', label: 'Fornecedores', permission: 'finance.manage' },
  { href: '/produtividade', label: 'Produtividade', permission: 'service_orders.view' },
  { href: '/configuracoes/empresa', label: 'Configurações: empresa e marca', permission: 'settings.view' },
  { href: '/configuracoes/email', label: 'Configurações: e-mail', permission: 'settings.view' },
  { href: '/configuracoes/equipe', label: 'Equipe e acesso', permission: 'team.view' },
  { href: '/configuracoes/conta', label: 'Minha conta: trocar senha e aparelhos' },
  { href: '/configuracoes/assinatura', label: 'Assinatura e exportação de dados', permission: 'settings.manage' },
  { href: '/configuracoes/historico', label: 'Histórico de alterações', permission: 'settings.manage' },
  { href: '/configuracoes/privacidade', label: 'Privacidade e solicitações' },
];

export function normalizeNavigationSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
