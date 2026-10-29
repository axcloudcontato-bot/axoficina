'use client';

import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle, Printer, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { ServiceOrderResponse, ServiceOrderStatus } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useUsersList } from '@/features/users/hooks/use-users';
import { usePhotoPolicy } from '@/features/settings/hooks/use-settings';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { extractErrorMessage } from '@/lib/api/client';
import { defaultWorkflowStep, quoteApprovalState, workflowPhotoCoverage, WORKFLOW_STEPS, type WorkflowStep } from '../service-order-workflow';
import { useServiceOrderDraft } from '../hooks/use-service-order-draft';
import { useCustomerMessages } from '../hooks/use-customer-messages';
import { useServiceOrderPhotos, useTransitionServiceOrder } from '../hooks/use-service-orders';
import { serviceOrdersApi } from '../api/service-orders-api';
import { customerMessagesApi } from '../api/customer-messages-api';
import { InspectionChecklist } from './InspectionChecklist';
import { ServiceOrderItemsSection } from './ServiceOrderItemsSection';
import { ServiceOrderQuoteActions } from './ServiceOrderQuoteActions';
import { CustomerPickupMessage } from './CustomerPickupMessage';
import { ServiceOrderStatusNotifications } from './ServiceOrderStatusNotifications';
import { ItemPhotosSection, VehiclePhotoSection } from './ServiceOrderPhotoGallery';
import { ServiceOrderPaymentSection } from './ServiceOrderPaymentSection';
import { StatusBadge } from './StatusBadge';
import { StatusHistoryTimeline } from './StatusHistoryTimeline';
import { DeleteServiceOrderDialog } from './DeleteServiceOrderDialog';
import { VehicleServiceHistoryDialog } from './VehicleServiceHistoryDialog';
import { ServiceOrderWorkSessions } from './ServiceOrderWorkSessions';

const NEXT_COPY = {
  OPEN: 'Registre a entrada, prepare os valores e solicite a aprovação do cliente.',
  AWAITING_APPROVAL: 'Confira a resposta do cliente antes de iniciar o serviço.',
  IN_PROGRESS: 'Registre a execução e as fotos de antes e depois. Ao terminar, confira a entrega.',
  WAITING_PARTS: 'O serviço está pausado. Retome a execução quando as peças chegarem.',
  COMPLETED: 'Serviços concluídos. Confira o recebimento e registre a retirada do veículo.',
  DELIVERED: 'Atendimento encerrado. Os registros e recebimentos estão disponíveis para consulta.',
  CANCELLED: 'Atendimento cancelado. Consulte os registros no histórico.',
};

export function ServiceOrderWorkspace({ serviceOrder: order }: { serviceOrder: ServiceOrderResponse }) {
  const user = useAuthStore(state => state.user);
  const router = useRouter();
  const client = useQueryClient();
  const canManage = hasPermission(user, 'service_orders.manage');
  const canViewPrices = hasPermission(user, 'service_orders.prices');
  const canManageReceipts = hasPermission(user, 'receipts.manage');
  const closed = ['DELIVERED', 'CANCELLED'].includes(order.status);
  const [editClosed, setEditClosed] = useState(false);
  const canEdit = canManage && (!closed || editClosed);
  // Delivered orders and orders that took money are financial records: cancel them, never erase them.
  const deleteBlocked = order.status === 'DELIVERED' || order.receivedAmountCents > 0;
  const [step, setStep] = useState<WorkflowStep>(() => defaultWorkflowStep(order.status));
  const navigation = useRef<HTMLElement>(null);
  const actionsMenu = useRef<HTMLDetailsElement>(null);
  const lastStep = useRef(step);
  const [confirm, setConfirm] = useState<{ target: ServiceOrderStatus; manual?: boolean } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [vehicleHistoryOpen, setVehicleHistoryOpen] = useState(false);
  const draft = useServiceOrderDraft(order);
  const photos = useServiceOrderPhotos(order.id);
  const messages = useCustomerMessages(order.id, canViewPrices);
  const users = useUsersList({ offset: 0, limit: 100, filters: { status: 'active' } });
  const transition = useTransitionServiceOrder();
  const photoPolicy = usePhotoPolicy();
  const coverage = workflowPhotoCoverage(order, photos.data?.photos ?? [], photoPolicy);
  const approval = quoteApprovalState(messages.data?.messages ?? [], Date.now(), order);
  const photoReady = !photos.isPending && !photos.isError;
  const entryReady = photoReady && coverage.entry.length === 0;
  const completionReady = photoReady && coverage.exit.length === 0 && coverage.items.length === 0;

  useEffect(() => {
    const locate = () => {
      const requested = new URLSearchParams(window.location.search).get('step');
      if (window.location.hash === '#customer-message-history') setStep('approval');
      else if (WORKFLOW_STEPS.some(item => item.id === requested)) setStep(requested as WorkflowStep);
    };
    locate(); window.addEventListener('hashchange', locate);
    return () => window.removeEventListener('hashchange', locate);
  }, []);

  useEffect(() => {
    if (lastStep.current !== step) {
      navigation.current?.scrollIntoView({ block: 'start' });
      navigation.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    lastStep.current = step;
    if (step === 'approval' && window.location.hash === '#customer-message-history') document.getElementById('customer-message-history')?.scrollIntoView({ block: 'start' });
  }, [step]);

  useEffect(() => {
    const close = (event: Event) => {
      const menu = actionsMenu.current;
      if (!menu?.open) return;
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'mousedown' && menu.contains(event.target as Node)) return;
      menu.open = false;
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);

  async function go(next: WorkflowStep) { if (await draft.save()) setStep(next); }
  function requestTransition(target: ServiceOrderStatus, manual = false) { setAcknowledged(false); setCancelReason(''); setConfirm({ target, manual }); }
  async function applyTransition() {
    if (!confirm || transition.isPending || !await draft.save()) return;
    try {
      if (confirm.target === 'IN_PROGRESS' && !confirm.manual && ['OPEN', 'AWAITING_APPROVAL'].includes(order.status)) {
        // Recheck before acting: another employee may have changed the quote
        // while this confirmation was open.
        const [current, replies] = await Promise.all([serviceOrdersApi.get(order.id), customerMessagesApi.list(order.id)]);
        if (quoteApprovalState(replies.messages, Date.now(), current.serviceOrder).state !== 'approved') {
          await client.invalidateQueries({ queryKey: ['customer-messages', order.id] });
          await client.invalidateQueries({ queryKey: ['service-order', order.id] });
          setConfirm(null); setStep('approval');
          toast.warning('O orçamento ou a resposta mudou. Confira a aprovação antes de iniciar.'); return;
        }
      }
      await transition.mutateAsync({ id: order.id, toStatus: confirm.target, ...(confirm.target === 'CANCELLED' ? { reason: cancelReason.trim() } : {}), ...(confirm.target === 'IN_PROGRESS' && ['OPEN', 'AWAITING_APPROVAL'].includes(order.status) ? { authorization: confirm.manual ? 'MANUAL' as const : 'CUSTOMER_MESSAGE' as const } : {}) });
      setStep(defaultWorkflowStep(confirm.target));
      toast.success(confirm.target === 'IN_PROGRESS' ? 'Serviço iniciado.' : confirm.target === 'COMPLETED' ? 'Veículo pronto para entrega.' : confirm.target === 'DELIVERED' ? 'Entrega registrada. Atendimento encerrado.' : confirm.target === 'WAITING_PARTS' ? 'Serviço pausado para aguardar peças.' : 'Atendimento cancelado.');
      setConfirm(null);
    } catch (error) { toast.error(extractErrorMessage(error)); }
  }

  const confirmationTitle = confirm?.target === 'IN_PROGRESS' ? confirm.manual ? 'Confirmar autorização e iniciar serviço' : 'Iniciar serviço autorizado' : confirm?.target === 'COMPLETED' ? 'Marcar veículo pronto para entrega' : confirm?.target === 'DELIVERED' ? 'Confirmar entrega do veículo' : confirm?.target === 'WAITING_PARTS' ? 'Pausar para aguardar peças' : 'Cancelar atendimento';
  const needsAcknowledgement = confirm?.manual || confirm?.target === 'DELIVERED' || confirm?.target === 'CANCELLED';

  return <div className="min-w-0 space-y-5 pb-6">
    <header className="border-b border-border pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" size="sm" className="-ml-3 text-text-muted" onClick={async () => { if (await draft.save()) router.push('/ordens-de-servico'); }}><ArrowLeft className="size-4" />Ordens de serviço</Button><details ref={actionsMenu} className="relative"><summary className="cursor-pointer rounded-button border border-border px-3 py-2 text-xs font-semibold text-text-muted">Mais ações</summary><div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-card border border-border bg-card p-2 shadow-lg"><Button variant="ghost" size="sm" className="justify-start" onClick={() => window.open(`/ordens-de-servico/${order.id}/imprimir?mode=summary`, '_blank', 'noopener,noreferrer')}><Printer className="size-4" />Imprimir resumo</Button><Button variant="ghost" size="sm" className="justify-start" onClick={() => window.open(`/ordens-de-servico/${order.id}/imprimir?mode=full`, '_blank', 'noopener,noreferrer')}>Imprimir detalhado</Button><Button variant="ghost" size="sm" className="justify-start" onClick={() => setVehicleHistoryOpen(true)}>Histórico do veículo</Button>{closed && canManage && <Button variant="ghost" size="sm" className="justify-start" onClick={() => setEditClosed(true)}>Editar registros encerrados</Button>}{canManage && <hr className="my-1 border-border" />}{canManage && !closed && order.status !== 'COMPLETED' && <Button variant="ghost" size="sm" className="justify-start text-danger" onClick={() => requestTransition('CANCELLED')}>Cancelar atendimento</Button>}{canManage && <Button variant="ghost" size="sm" className="justify-start text-danger" disabled={deleteBlocked} title={deleteBlocked ? 'OS entregue ou com recebimento não pode ser excluída. Use Cancelar atendimento.' : undefined} onClick={() => setDeleteOpen(true)}>Excluir OS</Button>}</div></details></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider text-primary">OS #{String(order.orderNumber).padStart(5, '0')}</span>{approval.state === 'approved' && ['OPEN', 'AWAITING_APPROVAL'].includes(order.status) ? <span className="rounded-full bg-success-subtle px-3 py-1 text-xs font-semibold text-success">Aprovado · aguardando início</span> : <StatusBadge status={order.status} />}</div>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-text sm:text-2xl">{order.vehicleBrand} {order.vehicleModel} <span className="whitespace-nowrap text-base text-text-muted">· {order.vehiclePlate}</span></h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-text-muted"><span>{order.customerName} ·</span><a href={`tel:${phoneDigits(order.customerPhone)}`} className="font-semibold text-primary underline-offset-2 hover:underline">{order.customerPhone}</a><a href={whatsappHref(order.customerPhone)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-text hover:bg-muted">WhatsApp</a></p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted"><span>Entrada: {new Date(order.openedAt).toLocaleString('pt-BR')}</span><span>Técnico: {order.technicianName ?? 'A definir'}</span><span>Previsão: {order.expectedDeliveryAt ? new Date(order.expectedDeliveryAt).toLocaleString('pt-BR') : 'A definir'}</span>{canViewPrices && <span className="font-semibold tabular-nums text-text">Total: {formatCurrencyBRL(order.totalAmountCents)}</span>}</div>
    </header>

    <div className={`flex items-start gap-3 rounded-card border p-4 ${closed ? 'border-border bg-surface' : 'border-primary/20 bg-selection/20'}`}><span className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true">{closed ? <CheckCircle className="size-5" /> : <ArrowRight className="size-5" />}</span><p className="text-sm text-text">{approval.state === 'approved' && ['OPEN', 'AWAITING_APPROVAL'].includes(order.status) ? 'O cliente aprovou o orçamento. Inicie o serviço quando a equipe começar a execução.' : NEXT_COPY[order.status]}</p></div>
    {draft.dirty && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning-subtle p-3"><p className="text-sm font-medium text-text">Alterações ainda não salvas</p><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={draft.saving} onClick={draft.discard}>Descartar</Button><Button variant="outline" size="sm" disabled={draft.saving} onClick={() => void draft.save()}>{draft.saving ? 'Salvando...' : 'Salvar alterações'}</Button></div></div>}
    {editClosed && <p className="rounded-button border border-border p-3 text-sm text-text-muted">Você está editando registros. O atendimento permanece encerrado.</p>}

    <nav ref={navigation} aria-label="Etapas do atendimento" className="scroll-mt-4 overflow-x-auto rounded-card border border-border bg-card p-2"><ol className="grid min-w-[440px] grid-cols-5 gap-1 sm:min-w-0">{WORKFLOW_STEPS.map((item, index) => <li key={item.id}><button type="button" aria-current={step === item.id ? 'step' : undefined} onClick={() => setStep(item.id)} className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-button px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:gap-2 sm:text-sm ${step === item.id ? 'bg-selection text-primary' : 'text-text-muted hover:bg-muted'}`}><span aria-hidden="true" className="text-[11px] opacity-70">{index + 1}</span>{item.label}</button></li>)}</ol></nav>

    {step === 'entry' && <div className="space-y-4"><Panel title="Entrada e solicitação" description="Registre o que trouxe o cliente à oficina e as condições do veículo."><fieldset disabled={!canEdit || draft.saving} className="grid gap-4 sm:grid-cols-2"><Field label="Solicitação do cliente"><Textarea value={draft.values.customerComplaint} onChange={event => draft.set('customerComplaint', event.target.value)} placeholder="O que o cliente relatou?" /></Field><Field label="Observações da recepção"><Textarea value={draft.values.receptionNotes} onChange={event => draft.set('receptionNotes', event.target.value)} placeholder="Condições de entrada e acordos com o cliente" /></Field><Field label="Quilometragem de entrada"><Input type="number" min="0" inputMode="numeric" value={draft.values.entryMileage} onChange={event => draft.set('entryMileage', event.target.value)} /></Field><Field label="Previsão de entrega"><Input type="datetime-local" value={draft.values.expectedDeliveryAt} onChange={event => draft.set('expectedDeliveryAt', event.target.value)} /></Field><div><label className="mb-2 block text-sm font-medium" htmlFor="order-technician">Técnico responsável</label><Select value={draft.values.technicianId} onValueChange={value => draft.set('technicianId', value)} disabled={!canEdit}><SelectTrigger id="order-technician" className="mt-0"><SelectValue placeholder="Selecionar técnico" /></SelectTrigger><SelectContent>{users.data?.items.map(technician => <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>)}</SelectContent></Select></div></fieldset></Panel>
      <details className="rounded-card border border-border bg-card p-4 sm:p-5"><summary className="cursor-pointer text-sm font-semibold">Inspeção de entrada · {draft.values.checklist.filter(item => item.status !== 'unchecked').length}/{draft.values.checklist.length} verificados</summary><div className="mt-4"><InspectionChecklist items={draft.values.checklist} onChange={items => draft.set('checklist', items)} disabled={!canEdit || draft.saving} /></div></details>
      <VehiclePhotoSection serviceOrderId={order.id} category="ENTRY" canManage={canEdit} />
      <StepFooter next="Preparar orçamento" onNext={() => void go('quote')} busy={draft.saving} />
    </div>}

    {step === 'quote' && <div className="space-y-4"><Panel title="Diagnóstico e orçamento" description="Descreva a solução e monte os serviços que o cliente vai aprovar."><fieldset disabled={!canEdit || draft.saving} className="grid gap-4 sm:grid-cols-2"><Field label="Diagnóstico técnico"><Textarea value={draft.values.diagnosis} onChange={event => draft.set('diagnosis', event.target.value)} placeholder="O que foi encontrado?" /></Field><Field label="Serviço recomendado"><Textarea value={draft.values.recommendedService} onChange={event => draft.set('recommendedService', event.target.value)} placeholder="Como o problema será resolvido?" /></Field></fieldset></Panel>
      {canViewPrices ? <ServiceOrderItemsSection serviceOrder={order} readOnly={closed && !editClosed} /> : <p className="rounded-card border border-border p-4 text-sm text-text-muted">Os itens e valores ficam disponíveis para a equipe com acesso ao orçamento.</p>}
      {approval.state === 'changed' && <Notice>O orçamento mudou desde a última solicitação. Envie os novos valores para aprovação.</Notice>}
      <StepFooter back="Entrada" onBack={() => setStep('entry')} next="Conferir aprovação" onNext={() => void go('approval')} busy={draft.saving} />
    </div>}

    {step === 'approval' && <div className="space-y-4">{canViewPrices ? <ServiceOrderQuoteActions serviceOrder={order} beforeSend={draft.save} entryReady={entryReady} onGoToEntry={() => setStep('entry')} onGoToQuote={() => setStep('quote')} onStart={manual => requestTransition('IN_PROGRESS', manual)} onCancelOrder={() => { requestTransition('CANCELLED'); setCancelReason('Cliente recusou o orçamento'); }} /> : <Panel title="Aprovação do cliente" description="A equipe com acesso ao orçamento acompanha os envios e respostas. Confirme a autorização antes de iniciar o serviço.">{canManage && ['OPEN', 'AWAITING_APPROVAL'].includes(order.status) && <Button variant="outline" disabled={!entryReady && order.status === 'OPEN'} onClick={() => requestTransition('IN_PROGRESS', true)}>Confirmar autorização com a equipe</Button>}</Panel>}<StepFooter back="Orçamento" onBack={() => setStep('quote')}  /></div>}

    {step === 'execution' && <div className="space-y-4"><Panel title={order.status === 'WAITING_PARTS' ? 'Aguardando peças' : 'Execução dos serviços'} description={order.status === 'IN_PROGRESS' ? 'Registre as evidências de cada serviço. Ao terminar, faça a conferência da entrega.' : order.status === 'WAITING_PARTS' ? 'Retome o serviço quando as peças estiverem disponíveis.' : closed || order.status === 'COMPLETED' ? 'Consulte as evidências registradas durante o serviço.' : 'O serviço ainda não foi iniciado. Confira a aprovação do cliente primeiro.'}>
      {['OPEN', 'AWAITING_APPROVAL'].includes(order.status) && <Button onClick={() => setStep('approval')}>Conferir aprovação</Button>}
      {canManage && order.status === 'WAITING_PARTS' && <Button onClick={() => requestTransition('IN_PROGRESS', true)}>Retomar serviço</Button>}
      {canManage && order.status === 'IN_PROGRESS' && <div className="flex flex-wrap gap-2"><Button onClick={() => void go('delivery')}>Conferir conclusão e entrega<ArrowRight className="size-4" /></Button><Button variant="outline" onClick={() => requestTransition('WAITING_PARTS')}>Pausar: aguardar peças</Button></div>}
      {approval.state === 'changed' && <div className="mt-4"><Notice>Os itens mudaram após a solicitação de aprovação. <button className="font-semibold underline" onClick={() => setStep('approval')}>Conferir novos valores com o cliente</button></Notice></div>}
    </Panel><ServiceOrderWorkSessions serviceOrderId={order.id} status={order.status} /><ItemPhotosSection serviceOrderId={order.id} items={order.items ?? []} canManage={canEdit} />
      <StepFooter back="Aprovação" onBack={() => setStep('approval')}  />
    </div>}

    {step === 'delivery' && <div className="space-y-4"><Panel title={order.status === 'DELIVERED' ? 'Veículo entregue' : order.status === 'CANCELLED' ? 'Atendimento cancelado' : order.status === 'COMPLETED' ? 'Pronto para entrega' : 'Conferência de saída'} description={closed ? `${order.closedAt ? `Encerrado em ${new Date(order.closedAt).toLocaleString('pt-BR')}. ` : ''}Consulte as fotos, o pagamento e o histórico abaixo.` : 'Confira as evidências, combine o pagamento e registre a entrega somente quando o veículo for retirado.'}>
      {!closed && <ul className="space-y-2 text-sm">{photoPolicy.exit && <li className="flex items-center gap-2"><CheckCircle className={`size-4 shrink-0 ${coverage.exit.length ? 'text-text-muted' : 'text-success'}`} />Fotos de saída: {6 - coverage.exit.length}/6</li>}{photoPolicy.items && <li className="flex items-center gap-2"><CheckCircle className={`size-4 shrink-0 ${coverage.items.length ? 'text-text-muted' : 'text-success'}`} />{coverage.items.length ? `${coverage.items.length} itens ainda precisam de foto de antes ou depois` : 'Fotos dos serviços conferidas'}</li>}{canViewPrices && <li>Saldo a receber: <strong className="tabular-nums">{formatCurrencyBRL(order.outstandingAmountCents)}</strong>{order.installments?.some(item => item.status === 'PENDING') ? ' · Há parcelas combinadas' : ''}</li>}</ul>}
      {order.status === 'IN_PROGRESS' && canManage && <div className="mt-4"><Button disabled={!completionReady || draft.saving} onClick={() => requestTransition('COMPLETED')}>Marcar pronto para entrega</Button>{!completionReady && <p className="mt-2 text-xs text-text-muted">Complete as fotos exigidas pela oficina antes de concluir.</p>}{coverage.items.length > 0 && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setStep('execution')}>Completar fotos dos serviços</Button>}</div>}
      {order.status === 'COMPLETED' && canManage && <Button className="mt-4" onClick={() => requestTransition('DELIVERED')}>Registrar retirada e encerrar OS</Button>}
      {!closed && !['IN_PROGRESS', 'COMPLETED'].includes(order.status) && <p className="mt-4 text-sm text-warning">{order.status === 'WAITING_PARTS' ? 'Retome e conclua o serviço antes da entrega.' : 'Confirme a aprovação e inicie o serviço antes da entrega.'} <button className="font-semibold underline" onClick={() => setStep(order.status === 'WAITING_PARTS' ? 'execution' : 'approval')}>Voltar à etapa atual</button></p>}
    </Panel>
      {canManage && ['IN_PROGRESS', 'COMPLETED'].includes(order.status) && <Panel title="Garantia e saída" description="O que fica combinado com o cliente na retirada. Aparece na impressão da OS."><fieldset disabled={!canEdit || draft.saving} className="grid gap-4 sm:grid-cols-2"><Field label="Garantia do serviço (dias)"><Input type="number" min="0" max="3650" inputMode="numeric" placeholder="Ex.: 90" value={draft.values.warrantyDays} onChange={event => draft.set('warrantyDays', event.target.value)} /></Field><Field label="Quilometragem de saída"><Input type="number" min="0" inputMode="numeric" placeholder={order.entryMileage ? `Entrada: ${order.entryMileage}` : undefined} value={draft.values.exitMileage} onChange={event => draft.set('exitMileage', event.target.value)} /></Field></fieldset></Panel>}
      {order.status !== 'CANCELLED' && <VehiclePhotoSection serviceOrderId={order.id} category="EXIT" canManage={canEdit} />}
      {order.status === 'COMPLETED' && canManage && canViewPrices && <CustomerPickupMessage serviceOrder={order} beforeSend={draft.save} />}
      {canManageReceipts && <ServiceOrderPaymentSection serviceOrder={order} />}
      <StepFooter back="Execução" onBack={() => setStep('execution')} />
    </div>}

    <ServiceOrderStatusNotifications serviceOrderId={order.id} canManage={canManage} />
    <details className="rounded-card border border-border bg-card p-4 sm:p-5"><summary className="cursor-pointer text-sm font-semibold">Histórico das etapas da OS</summary><div className="mt-4"><StatusHistoryTimeline history={order.statusHistory ?? []} /></div></details>
    <DeleteServiceOrderDialog open={deleteOpen} onOpenChange={setDeleteOpen} serviceOrder={order} onDeleted={() => router.push('/ordens-de-servico')} />
    <VehicleServiceHistoryDialog open={vehicleHistoryOpen} onOpenChange={setVehicleHistoryOpen} vehicleId={order.vehicleId} vehicleLabel={`${order.vehicleBrand} ${order.vehicleModel}`} plate={order.vehiclePlate} />

    <Dialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !transition.isPending) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmationTitle}</DialogTitle><DialogDescription>OS #{String(order.orderNumber).padStart(5, '0')} · {order.customerName} · {order.vehiclePlate}</DialogDescription></DialogHeader>
      {confirm?.target === 'IN_PROGRESS' && <p className="text-sm text-text-muted">{confirm.manual && ['OPEN', 'AWAITING_APPROVAL'].includes(order.status) ? 'Confirme que o cliente autorizou os serviços e valores atuais por telefone ou pessoalmente. Nenhuma resposta será criada em nome dele.' : order.status === 'WAITING_PARTS' ? 'O atendimento voltará para Em andamento.' : 'A aprovação do cliente será conferida novamente antes de iniciar.'}</p>}
      {confirm?.target === 'COMPLETED' && <p className="text-sm text-text-muted">O veículo ficará pronto para retirada. A entrega será registrada separadamente, quando o cliente buscá-lo.</p>}
      {confirm?.target === 'DELIVERED' && <><p className="text-sm text-text-muted">Registre a entrega somente após a retirada do veículo. Essa ação encerra o atendimento e mantém os recebimentos registrados.</p>{canViewPrices && order.outstandingAmountCents > 0 && <Notice>Saldo pendente de {formatCurrencyBRL(order.outstandingAmountCents)}. Confira o pagamento ou as parcelas combinadas antes de confirmar.</Notice>}</>}
      {confirm?.target === 'CANCELLED' && <><p className="text-sm text-text-muted">O atendimento será encerrado como cancelado. Os registros e recebimentos existentes serão mantidos.</p><label className="block space-y-1.5 text-sm font-medium">Motivo do cancelamento<Input aria-label="Motivo do cancelamento" maxLength={300} placeholder="Ex.: cliente recusou o orçamento" value={cancelReason} onChange={event => setCancelReason(event.target.value)} /><span className="block text-xs font-normal text-text-muted">Fica registrado na auditoria. Não inclua dados pessoais.</span></label></>}
      {needsAcknowledgement && <label className="flex items-start gap-3 rounded-button border border-border p-3 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{confirm?.target === 'DELIVERED' ? 'Confirmei a retirada do veículo e a condição de pagamento.' : confirm?.target === 'CANCELLED' ? 'Confirmo o cancelamento deste atendimento.' : order.status === 'WAITING_PARTS' ? 'As peças chegaram e o serviço pode continuar.' : 'O cliente autorizou os serviços e valores atuais.'}</label>}
      <DialogFooter><Button variant="outline" disabled={transition.isPending} onClick={() => setConfirm(null)}>Voltar</Button><Button variant={confirm?.target === 'CANCELLED' ? 'destructive' : 'default'} disabled={transition.isPending || draft.saving || Boolean(needsAcknowledgement && !acknowledged) || (confirm?.target === 'CANCELLED' && cancelReason.trim().length < 5)} onClick={() => void applyTransition()}>{transition.isPending ? 'Registrando...' : confirm?.target === 'DELIVERED' ? 'Confirmar entrega' : confirm?.target === 'CANCELLED' ? 'Cancelar atendimento' : 'Confirmar'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

const phoneDigits = (phone: string) => phone.replace(/\D/g, '');
// Brazilian numbers saved without the country code get 55 so wa.me resolves them.
function whatsappHref(phone: string) { const digits = phoneDigits(phone); return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`; }

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-card border border-border bg-card p-4 sm:p-5"><h3 className="text-lg font-bold text-text">{title}</h3><p className="mt-1 text-sm text-text-muted">{description}</p><div className="mt-4">{children}</div></section>;
}
function Field({ label, children }: { label: string; children: React.ReactElement<{ id?: string }> }) {
  const id = useId();
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-sm font-medium text-text">{label}</label>{cloneElement(children, { id })}</div>;
}
function Notice({ children }: { children: React.ReactNode }) { return <p className="flex items-start gap-2 rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm text-text"><WarningCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" /><span>{children}</span></p>; }
function StepFooter({ back, onBack, next, onNext, busy }: { back?: string; onBack?: () => void; next?: string; onNext?: () => void; busy?: boolean }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">{back ? <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />{back}</Button> : <span />}{next && <Button disabled={busy} onClick={onNext}>{busy ? 'Salvando...' : next}<ArrowRight className="size-4" /></Button>}</div>;
}
