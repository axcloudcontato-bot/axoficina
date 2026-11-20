import type { PermissionKey } from '@oficina/contracts';

// What the page search in the header finds: the same names as the menu, plus the words people type to look for them.
export const NAVIGATION_DESTINATIONS: Array<{ href: string; label: string; permission?: PermissionKey }> = [
  { href: '/painel', label: 'Visão da oficina', permission: 'dashboard.view' },
  { href: '/agenda', label: 'Agenda', permission: 'appointments.view' },
  { href: '/ordens-de-servico', label: 'Ordens de serviço', permission: 'service_orders.view' },
  { href: '/chat', label: 'Chat WhatsApp: conversas com clientes', permission: 'customers.view' },
  { href: '/clientes', label: 'Clientes', permission: 'customers.view' },
  { href: '/veiculos', label: 'Veículos', permission: 'vehicles.view' },
  { href: '/catalogo', label: 'Peças e serviços: catálogo, pacotes e valor da hora', permission: 'service_orders.prices' },
  { href: '/financeiro/fornecedores', label: 'Fornecedores', permission: 'finance.manage' },
  { href: '/relacionamento', label: 'Retornos e lembretes: cuidados, aniversários e mensagens', permission: 'alerts.view' },
  { href: '/alertas-de-manutencao', label: 'Retornos e lembretes: carros sem revisão (alertas de manutenção)', permission: 'alerts.view' },
  { href: '/financeiro', label: 'Financeiro', permission: 'finance.view' },
  { href: '/financeiro/contas-a-pagar', label: 'Financeiro: contas a pagar', permission: 'finance.view' },
  { href: '/financeiro/contas-a-receber', label: 'Financeiro: contas a receber', permission: 'finance.view' },
  { href: '/financeiro/fluxo-de-caixa', label: 'Financeiro: fluxo de caixa', permission: 'finance.view' },
  { href: '/financeiro/relatorios', label: 'Financeiro: relatórios', permission: 'finance.view' },
  { href: '/produtividade', label: 'Produtividade: metas e comissões', permission: 'service_orders.view' },
  { href: '/configuracoes', label: 'Configurações', permission: 'settings.view' },
  { href: '/configuracoes/empresa', label: 'Configurações: empresa e marca', permission: 'settings.view' },
  { href: '/configuracoes/operacao', label: 'Configurações: regras de trabalho (horário, garantia, fotos)', permission: 'settings.view' },
  { href: '/configuracoes/nota-fiscal', label: 'Configurações: nota fiscal', permission: 'settings.view' },
  { href: '/configuracoes/email', label: 'Configurações: e-mail', permission: 'settings.view' },
  { href: '/configuracoes/whatsapp', label: 'Configurações: WhatsApp', permission: 'settings.view' },
  { href: '/configuracoes/equipe', label: 'Configurações: usuários e permissões', permission: 'team.view' },
  { href: '/configuracoes/assinatura', label: 'Configurações: assinatura e exportação de dados', permission: 'settings.manage' },
  { href: '/configuracoes/historico', label: 'Configurações: histórico de alterações', permission: 'settings.manage' },
  { href: '/configuracoes/impressao', label: 'Configurações: impressão e impressoras' },
  { href: '/configuracoes/conta', label: 'Minha conta: senha e aparelhos' },
  { href: '/configuracoes/privacidade', label: 'Minha conta: privacidade e solicitações' },
  { href: '/suporte', label: 'Suporte: abrir e acompanhar chamados' },
];

export function normalizeNavigationSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
