// What each recorded action means for the workshop, in the words used on screen.
const LABELS: Record<string, string> = {
  'auth.login': 'Entrou no sistema', 'auth.logout': 'Saiu do sistema', 'auth.signup': 'Criou a conta da oficina',
  'auth.password_changed': 'Trocou a própria senha', 'auth.password_reset_requested': 'Pediu para redefinir a senha', 'auth.password_reset': 'Criou uma nova senha pelo link',
  'auth.session_revoked': 'Desconectou um aparelho', 'auth.other_sessions_revoked': 'Desconectou os outros aparelhos',
  'user.invited': 'Convidou um usuário', 'user.invite_accepted': 'Aceitou o convite e ativou a conta', 'user.invite_resent': 'Reenviou um convite', 'user.renamed': 'Mudou o nome de um usuário',
  'user.disabled': 'Bloqueou um usuário', 'user.enabled': 'Reativou um usuário', 'user.deleted': 'Excluiu um usuário', 'user.password_reset_link_created': 'Gerou um link de nova senha para um usuário',
  'settings.company_updated': 'Alterou os dados da empresa', 'settings.email_updated': 'Alterou a configuração de e-mail', 'settings.whatsapp_updated': 'Alterou a configuração do WhatsApp',
  'settings.agenda_hours_updated': 'Alterou o horário de funcionamento', 'settings.photo_policy_updated': 'Alterou a exigência de fotos', 'settings.order_defaults_updated': 'Alterou os padrões da OS',
  'settings.labor_rate_updated': 'Alterou o valor da hora', 'settings.onboarding_completed': 'Concluiu a configuração inicial da oficina', 'settings.maintenance_alert_months_updated': 'Alterou o prazo dos alertas de manutenção', 'settings.data_exported': 'Exportou os dados da oficina',
  'subscription.updated': 'Plano atualizado pelo Ofix',
  'account.closed': 'Encerrou a conta da oficina', 'account.restored': 'Conta da oficina restaurada pelo Ofix',
  'billing.checkout_started': 'Contratou um plano', 'billing.plan_upgraded': 'Subiu de plano', 'billing.plan_change_scheduled': 'Agendou a troca de plano para o próximo pagamento',
  'billing.canceled': 'Cancelou a assinatura', 'billing.payment_confirmed': 'Pagamento da assinatura confirmado', 'billing.payment_overdue': 'Pagamento da assinatura em atraso', 'billing.subscription_ended': 'Assinatura encerrada',
  'customer.created': 'Cadastrou um cliente', 'customer.updated': 'Alterou um cliente', 'customer.deleted': 'Arquivou um cliente', 'customer.restored': 'Restaurou um cliente', 'customer.merged': 'Uniu clientes duplicados', 'customer.imported': 'Importou clientes',
  'vehicle.created': 'Cadastrou um veículo', 'vehicle.updated': 'Alterou um veículo', 'vehicle.deleted': 'Arquivou um veículo', 'vehicle.restored': 'Restaurou um veículo', 'vehicle.transferred': 'Transferiu um veículo de dono', 'vehicle.imported': 'Importou veículos',
  'service_order.created': 'Abriu uma OS', 'service_order.updated': 'Alterou uma OS', 'service_order.transitioned': 'Mudou a situação de uma OS', 'service_order.deleted': 'Excluiu uma OS', 'service_order.closed_items_changed': 'Corrigiu itens de uma OS já entregue',
  'service_order.payment_configured': 'Combinou o pagamento de uma OS', 'service_order.receipt_confirmed': 'Confirmou um recebimento', 'service_order.receipt_reversed': 'Estornou um recebimento', 'service_order.installment_confirmed': 'Confirmou uma parcela',
  'service_order.photo_added': 'Anexou uma foto na OS', 'service_order.photo_deleted': 'Removeu uma foto da OS',
  'catalog.item_created': 'Cadastrou um item no catálogo', 'catalog.item_updated': 'Alterou um item do catálogo', 'catalog.item_deleted': 'Excluiu um item do catálogo', 'catalog.stock_adjusted': 'Ajustou o estoque', 'catalog.imported': 'Importou o catálogo', 'catalog.package_deleted': 'Excluiu um pacote do catálogo',
  'financial.entry_created': 'Lançou no financeiro', 'financial.entry_updated': 'Alterou um lançamento', 'financial.entry_payment_added': 'Registrou um pagamento', 'financial.entry_payment_reversed': 'Estornou um pagamento',
  'financial.category_created': 'Criou uma categoria financeira', 'financial.category_updated': 'Alterou uma categoria financeira', 'financial.category_deleted': 'Excluiu uma categoria financeira', 'financial.supplier_deleted': 'Excluiu um fornecedor',
  'financial.attachment_added': 'Anexou um comprovante', 'financial.movement_reconciled': 'Conciliou um movimento', 'financial.cash_baseline_updated': 'Ajustou o saldo inicial do caixa',
  'productivity.target_set': 'Definiu uma meta de produtividade', 'productivity.targets_copied': 'Copiou as metas do mês anterior', 'productivity.commission_rule_set': 'Definiu uma comissão', 'productivity.session_corrected': 'Corrigiu o tempo de trabalho de um técnico',
  'privacy.customer_erased': 'Apagou os dados de um cliente', 'privacy.account_erased': 'Apagou a própria conta', 'privacy.request_reviewed': 'Respondeu a um pedido de privacidade',
  'customer_care.settings_updated': 'Alterou a régua de cuidado com o cliente', 'customer_care.contact_recorded': 'Registrou um contato de cuidado', 'customer_care.service_recorded': 'Registrou um cuidado realizado',
  'maintenance_alert.resolved': 'Resolveu um alerta de manutenção', 'maintenance_alert.dismissed': 'Dispensou um alerta de manutenção', 'maintenance_alert.snoozed': 'Adiou um alerta de manutenção', 'maintenance_alert.reopened': 'Reabriu um alerta de manutenção', 'maintenance_alert.contact_recorded': 'Registrou contato de um alerta',
  'email.sent': 'Enviou um e-mail pelo sistema',
};

export const AUDIT_AREAS: Array<{ prefix: string; label: string }> = [
  { prefix: '', label: 'Tudo' },
  { prefix: 'settings.', label: 'Configurações' },
  { prefix: 'user.', label: 'Equipe e acessos' },
  { prefix: 'auth.', label: 'Entradas e senhas' },
  { prefix: 'financial.', label: 'Financeiro' },
  { prefix: 'service_order.', label: 'Ordens de serviço' },
  { prefix: 'catalog.', label: 'Catálogo' },
  { prefix: 'customer.', label: 'Clientes' },
  { prefix: 'vehicle.', label: 'Veículos' },
  { prefix: 'privacy.', label: 'Privacidade' },
];

export function auditLabel(action: string): string {
  return LABELS[action] ?? action.replace('.', ': ').replaceAll('_', ' ');
}
