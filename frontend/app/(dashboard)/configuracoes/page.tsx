'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { ArrowRight } from '@phosphor-icons/react';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding, useSettings } from '@/features/settings/hooks/use-settings';
import { settingsApi } from '@/features/settings/api/settings-api';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const canView = hasPermission(user, 'settings.view');
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
  const company = settings.data?.company;
  const missingCompany = company ? [!company.logoDataUrl && 'logo', !company.document && 'CPF/CNPJ', !company.addressStreet && 'endereço', !(company.phone || company.whatsapp) && 'telefone'].filter(Boolean) as string[] : [];
  const agenda = branding.data?.agendaHours;

  // What a workshop needs before its customers see the system: each step links to where it is done.
  const defaults = branding.data?.orderDefaults;
  const checklist = canView && settings.data && branding.data ? [
    { label: 'Dados da empresa completos', done: missingCompany.length === 0, href: '/configuracoes/empresa' },
    { label: 'Logo enviada', done: Boolean(company?.logoDataUrl), href: '/configuracoes/empresa' },
    { label: 'Horário de funcionamento conferido', done: Boolean(agenda && (agenda.openHour !== 8 || agenda.closeHour !== 18 || agenda.workDays.join() !== '1,2,3,4,5,6' || Object.keys(agenda.dayHours ?? {}).length || (agenda.closedDates ?? []).length)), href: '/configuracoes/operacao' },
    { label: 'Garantia e termos dos documentos', done: Boolean(defaults?.defaultWarrantyDays != null && defaults?.documentTerms), href: '/configuracoes/operacao' },
    { label: 'E-mail testado', done: Boolean(settings.data.email.lastSuccessAt), href: '/configuracoes/email' },
    { label: 'WhatsApp conectado', done: Boolean(whatsapp.data?.enabled && whatsapp.data?.connectionSuccessAt), href: '/configuracoes/whatsapp' },
  ] : [];
  const doneSteps = checklist.filter((step) => step.done).length;
  const nextStep = checklist.find((step) => !step.done);

  // Settings that live next to the work they change, listed here so nobody has to hunt for them.
  const elsewhere = [
    { href: '/catalogo', label: 'Valor da hora da oficina', where: 'Peças e serviços', show: hasPermission(user, 'service_orders.prices') },
    { href: '/alertas-de-manutencao', label: 'Prazo dos alertas de manutenção', where: 'Alertas de manutenção', show: hasPermission(user, 'alerts.view') },
    { href: '/relacionamento', label: 'Régua de lembretes e aniversários', where: 'Cuidado com o cliente, aba Ajustes da régua', show: hasPermission(user, 'alerts.view') },
    { href: '/produtividade', label: 'Metas e comissões dos técnicos', where: 'Produtividade', show: hasPermission(user, 'service_orders.prices') && Boolean(user && ['ADMIN', 'MANAGER'].includes(user.role)) },
  ].filter(entry => entry.show);

  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold">Estado da oficina</h2><p className="mt-1 text-sm text-text-muted">Veja o que falta para a oficina estar pronta e os pontos que pedem atenção. As áreas de configuração ficam nas abas acima.</p></div>
    {checklist.length > 0 && <section aria-label="Implantação da oficina" className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-bold">{doneSteps === checklist.length ? 'Sua oficina está pronta' : `Sua oficina está ${Math.round(doneSteps * 100 / checklist.length)}% pronta`}</h2><span className="text-xs text-text-muted">{doneSteps} de {checklist.length} passos</span></div>
      <div className="mt-3 h-2 rounded-full bg-surface" role="progressbar" aria-label="Passos concluídos" aria-valuenow={doneSteps} aria-valuemin={0} aria-valuemax={checklist.length}><div className="h-2 rounded-full bg-primary" style={{ width: `${doneSteps * 100 / checklist.length}%` }} /></div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">{checklist.map((step) => <li key={step.label}><Link href={step.href} className={`flex items-center gap-2 ${step.done ? 'text-text-muted' : 'font-semibold hover:text-primary'}`}><span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${step.done ? 'border-success bg-success text-white' : 'border-border'}`}>{step.done ? '✓' : ''}</span><span>{step.label}</span><span className="sr-only">{step.done ? ' (feito)' : ' (pendente)'}</span></Link></li>)}</ul>
      {nextStep && <Button asChild size="sm" className="mt-4"><Link href={nextStep.href}>Próximo passo: {nextStep.label.toLowerCase()}</Link></Button>}
    </section>}
    {canView && reminders.isError && <div role="alert" className="rounded-card border border-danger/30 p-4 text-sm text-danger">Não foi possível consultar os lembretes. <button type="button" className="font-bold underline" onClick={() => reminders.refetch()}>Tentar novamente</button></div>}
    {elsewhere.length > 0 && <section className="rounded-card border border-border bg-card p-5"><h2 className="font-bold">Ajustes em outras telas</h2><p className="mt-1 text-sm text-text-muted">Estas regras ficam junto do trabalho que elas mudam.</p><ul className="mt-3 divide-y divide-border text-sm">{elsewhere.map(entry => <li key={entry.href}><Link href={entry.href} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary"><span><span className="font-semibold">{entry.label}</span><span className="block text-xs text-text-muted">{entry.where}</span></span><ArrowRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" /></Link></li>)}</ul><p className="mt-2 text-xs text-text-muted">O horário de fechamento, em Operação, também é onde o cronômetro dos técnicos para de contar.</p></section>}
    {canView && reminders.data && <section className="rounded-card border border-border bg-card p-5"><h2 className="font-bold">Lembretes de agendamento</h2><p className="mt-2 text-sm text-text-muted">{reminders.data.failed ? `${reminders.data.failed} lembrete(s) aguardam nova tentativa ou precisam de atenção.` : 'Nenhuma falha pendente em agendamentos futuros.'}</p><p className="mt-1 text-xs text-text-muted">Último envio confirmado: {reminders.data.lastSentAt ? new Date(reminders.data.lastSentAt).toLocaleString('pt-BR') : 'nenhum ainda'}.</p>{reminders.data.items.length > 0 && <ul className="mt-3 space-y-2 text-sm">{reminders.data.items.map((item) => <li key={item.id} className="rounded-button border border-danger/20 p-3"><strong>Agendamento de {new Date(item.startsAt).toLocaleString('pt-BR')}</strong><span className="ml-2 text-text-muted">{item.attempts} tentativa(s)</span><p className="mt-1 text-danger">{item.error ?? 'Envio sem confirmação; uma nova tentativa será feita quando possível.'}</p>{item.attempts >= 4 && <p className="mt-1 text-xs text-text-muted">As tentativas automáticas pararam. Confira o histórico antes de reenviar.</p>}{canRetry && <Button variant="outline" size="sm" className="mt-2" disabled={retryReminder.isPending} onClick={() => retry(item.id)}>Tentar agora</Button>}</li>)}</ul>}</section>}
  </div>;
}
