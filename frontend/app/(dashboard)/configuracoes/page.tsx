'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { ArrowRight, Buildings, Clock, Envelope, ShieldCheck, UsersThree, WhatsappLogo } from '@phosphor-icons/react';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding, useSettings } from '@/features/settings/hooks/use-settings';
import { settingsApi } from '@/features/settings/api/settings-api';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const canView = hasPermission(user, 'settings.view');
  const canViewTeam = hasPermission(user, 'team.view');
  const canRetry = Boolean(user && ['ADMIN', 'MANAGER'].includes(user.role) && hasPermission(user, 'appointments.manage'));
  const settings = useSettings(canView);
  const branding = useBranding();
  const whatsapp = useQuery({ queryKey: ['whatsapp-settings'], queryFn: settingsApi.whatsapp, enabled: canView });
  const reminders = useQuery({ queryKey: ['reminder-health'], queryFn: settingsApi.reminderHealth, enabled: canView });
  const queryClient = useQueryClient();
  const retryReminder = useMutation({ mutationFn: settingsApi.retryReminder, onSuccess: () => { toast.success('Lembrete enviado.'); void queryClient.invalidateQueries({ queryKey: ['reminder-health'] }); }, onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível reenviar o lembrete.')) });
  function retry(id: string) {
    if (!window.confirm('Confira o histórico do WhatsApp antes de reenviar: uma tentativa anterior pode ter chegado ao cliente sem confirmação do provedor. Continuar?')) return;
    retryReminder.mutate(id);
  }
  const cards = [
    { href: '/configuracoes/empresa', title: 'Empresa e marca', detail: settings.data?.company.name ? `${settings.data.company.name} · dados cadastrais e documentos` : 'Complete os dados da oficina', icon: Buildings, status: settings.isError ? 'Falha ao carregar' : settings.isPending ? 'Carregando' : settings.data?.company.document ? 'Configurado' : 'Pendente', show: canView },
    { href: '/configuracoes/operacao', title: 'Operação', detail: 'Horários, capacidade, lembretes e fotos da OS', icon: Clock, status: branding.isError ? 'Falha ao carregar' : reminders.data?.failed ? `${reminders.data.failed} lembrete(s) com falha` : branding.data?.agendaHours?.remindersEnabled && !whatsapp.data?.enabled ? 'Lembretes sem WhatsApp' : 'Consultar regras', show: canView },
    { href: '/configuracoes/email', title: 'E-mail', detail: 'Servidor, remetente e teste de envio', icon: Envelope, status: settings.isError ? 'Falha ao carregar' : settings.isPending ? 'Carregando' : settings.data?.email.lastTestError ? 'Último teste falhou' : settings.data?.email.enabled ? settings.data?.email.lastSuccessAt ? 'Ativo e testado' : 'Ativo · teste pendente' : 'Inativo', show: canView },
    { href: '/configuracoes/whatsapp', title: 'WhatsApp', detail: 'Conexão, webhook e respostas dos clientes', icon: WhatsappLogo, status: whatsapp.isError ? 'Falha ao carregar' : whatsapp.isPending ? 'Carregando' : whatsapp.data?.connectionTestError || whatsapp.data?.webhookTestError ? 'Teste com falha' : whatsapp.data?.enabled ? whatsapp.data?.connectionSuccessAt && whatsapp.data?.webhookSuccessAt ? 'Ativo e testado' : 'Ativo · teste pendente' : 'Inativo', show: canView },
    { href: '/configuracoes/equipe', title: 'Equipe e acesso', detail: 'Convites, usuários e perfis', icon: UsersThree, status: hasPermission(user, 'team.manage') ? 'Gerenciar equipe' : 'Consultar equipe', show: canViewTeam },
    { href: '/configuracoes/privacidade-da-oficina', title: 'Privacidade da oficina', detail: 'Pedidos e protocolos dos clientes', icon: ShieldCheck, status: 'Acompanhar solicitações', show: user?.role === 'ADMIN' && hasPermission(user, 'settings.manage') },
  ].filter((card) => card.show);

  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold">Estado da oficina</h2><p className="mt-1 text-sm text-text-muted">Acesse a área que deseja configurar e confira os pontos que pedem atenção.</p></div>
    {canView && reminders.isError && <div role="alert" className="rounded-card border border-danger/30 p-4 text-sm text-danger">Não foi possível consultar os lembretes. <button type="button" className="font-bold underline" onClick={() => reminders.refetch()}>Tentar novamente</button></div>}
    <div className="grid gap-3 md:grid-cols-2">{cards.map(({ href, title, detail, icon: Icon, status }) => <Link key={href} href={href} className="rounded-card border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"><div className="flex items-start gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-text-muted">{detail}</p><p className="mt-3 text-xs font-semibold text-primary">{status}</p></div><ArrowRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" /></div></Link>)}</div>
    {canView && reminders.data && <section className="rounded-card border border-border bg-card p-5"><h2 className="font-bold">Lembretes de agendamento</h2><p className="mt-2 text-sm text-text-muted">{reminders.data.failed ? `${reminders.data.failed} lembrete(s) aguardam nova tentativa ou precisam de atenção.` : 'Nenhuma falha pendente em agendamentos futuros.'}</p><p className="mt-1 text-xs text-text-muted">Último envio confirmado: {reminders.data.lastSentAt ? new Date(reminders.data.lastSentAt).toLocaleString('pt-BR') : 'nenhum ainda'}.</p>{reminders.data.items.length > 0 && <ul className="mt-3 space-y-2 text-sm">{reminders.data.items.map((item) => <li key={item.id} className="rounded-button border border-danger/20 p-3"><strong>Agendamento de {new Date(item.startsAt).toLocaleString('pt-BR')}</strong><span className="ml-2 text-text-muted">{item.attempts} tentativa(s)</span><p className="mt-1 text-danger">{item.error ?? 'Envio sem confirmação; uma nova tentativa será feita quando possível.'}</p>{item.attempts >= 4 && <p className="mt-1 text-xs text-text-muted">As tentativas automáticas pararam. Confira o histórico antes de reenviar.</p>}{canRetry && <Button variant="outline" size="sm" className="mt-2" disabled={retryReminder.isPending} onClick={() => retry(item.id)}>Tentar agora</Button>}</li>)}</ul>}</section>}
  </div>;
}
