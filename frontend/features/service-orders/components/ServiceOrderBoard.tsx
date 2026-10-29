'use client';

import Link from 'next/link';
import { useState, type DragEvent } from 'react';
import { Warning, ArrowRight, CalendarDot, CaretRight, Clock, DotsSixVertical, Hash, User, Wrench, ClipboardText } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { ServiceOrderListItemResponse, ServiceOrderStatus } from '@oficina/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { extractErrorMessage } from '@/lib/api/client';
import { isOverdueServiceOrder } from '../service-orders-view-model';
import { useTransitionServiceOrder } from '../hooks/use-service-orders';
import { canTransitionServiceOrder, SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TRANSITIONS } from '../state-machine';
import { StatusBadge } from './StatusBadge';

interface ServiceOrderBoardProps {
  items: ServiceOrderListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canManage: boolean;
  canViewPrices: boolean;
}

const BOARD_COLUMNS: Array<{ statuses: ServiceOrderStatus[]; label: string; description: string; accent: string }> = [
  { statuses: ['OPEN'], label: 'Entrada', description: 'Aguardando início', accent: 'bg-slate-400' },
  { statuses: ['AWAITING_APPROVAL'], label: 'Aguardando aprovação', description: 'Orçamento com o cliente', accent: 'bg-primary' },
  { statuses: ['IN_PROGRESS'], label: 'Em execução', description: 'Serviços em andamento', accent: 'bg-info' },
  { statuses: ['WAITING_PARTS'], label: 'Aguardando peças', description: 'Execução bloqueada', accent: 'bg-warning' },
  { statuses: ['COMPLETED'], label: 'Pronto para entrega', description: 'Contatar o cliente', accent: 'bg-success' },
];

const QUICK_NEXT_STATUS: Partial<Record<ServiceOrderStatus, ServiceOrderStatus>> = {
  OPEN: 'AWAITING_APPROVAL',
  AWAITING_APPROVAL: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  WAITING_PARTS: 'IN_PROGRESS',
  COMPLETED: 'DELIVERED',
};

function reviewStep(from: ServiceOrderStatus, target: ServiceOrderStatus) {
  if (target === 'AWAITING_APPROVAL') return 'approval';
  if (target === 'IN_PROGRESS') return from === 'WAITING_PARTS' ? 'execution' : 'approval';
  if (target === 'COMPLETED' || target === 'DELIVERED') return 'delivery';
  return undefined;
}

const QUICK_ACTIONS: Partial<Record<ServiceOrderStatus, { label: string; step: string }>> = {
  OPEN: { label: 'Preparar atendimento', step: 'entry' }, AWAITING_APPROVAL: { label: 'Conferir aprovação', step: 'approval' },
  IN_PROGRESS: { label: 'Conferir conclusão', step: 'delivery' }, WAITING_PARTS: { label: 'Retomar execução', step: 'execution' },
  COMPLETED: { label: 'Conferir entrega', step: 'delivery' },
};

const PAYMENT_LABELS = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PARTIALLY_PAID: 'Parcialmente recebido',
  PAID: 'Pago',
} as const;

// How long the order has been sitting in its current column.
function elapsedSince(date: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000));
  if (hours < 1) return 'nesta etapa agora';
  if (hours < 24) return `nesta etapa há ${hours}h`;
  return `nesta etapa há ${Math.floor(hours / 24)}d`;
}

// Overdue first, then the nearest promised delivery, then whoever waited longest.
export function sortByUrgency(items: ServiceOrderListItemResponse[]): ServiceOrderListItemResponse[] {
  const late = (item: ServiceOrderListItemResponse) => (isOverdueServiceOrder(item) ? 0 : 1);
  const promised = (item: ServiceOrderListItemResponse) => (item.expectedDeliveryAt ? new Date(item.expectedDeliveryAt).getTime() : Number.POSITIVE_INFINITY);
  const since = (item: ServiceOrderListItemResponse) => new Date(item.statusSince ?? item.openedAt).getTime();
  return [...items].sort((a, b) => late(a) - late(b) || promised(a) - promised(b) || since(a) - since(b));
}

export function ServiceOrderBoard({ items, isLoading, isError, onRetry, canManage, canViewPrices }: ServiceOrderBoardProps) {
  const transition = useTransitionServiceOrder();
  const [draggedItem, setDraggedItem] = useState<ServiceOrderListItemResponse>();
  const [dragOverStatus, setDragOverStatus] = useState<ServiceOrderStatus>();
  const [pendingMove, setPendingMove] = useState<{ item: ServiceOrderListItemResponse; toStatus: ServiceOrderStatus }>();

  function dropOn(event: DragEvent<HTMLElement>, toStatus: ServiceOrderStatus) {
    event.preventDefault();
    setDragOverStatus(undefined);
    if (!draggedItem || draggedItem.status === toStatus) return;
    if (!canTransitionServiceOrder(draggedItem.status, toStatus)) {
      toast.error(`Não é possível mover de ${SERVICE_ORDER_STATUS_LABELS[draggedItem.status]} para ${SERVICE_ORDER_STATUS_LABELS[toStatus]}.`);
      setDraggedItem(undefined);
      return;
    }
    setPendingMove({ item: draggedItem, toStatus });
    setDraggedItem(undefined);
  }

  function confirmDrop() {
    if (!pendingMove) return;
    transition.mutate({ id: pendingMove.item.id, toStatus: pendingMove.toStatus }, {
      onSuccess: () => {
        toast.success(`OS #${pendingMove.item.orderNumber} movida para ${SERVICE_ORDER_STATUS_LABELS[pendingMove.toStatus]}.`);
        setPendingMove(undefined);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  if (isLoading) {
    return <div role="status" aria-label="Carregando quadro de ordens de serviço" className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">{BOARD_COLUMNS.map((column) => <div key={column.label} className="h-64 animate-pulse rounded-card bg-surface motion-reduce:animate-none" />)}</div>;
  }
  if (isError) {
    return <div className="rounded-card border border-danger/30 bg-danger-subtle p-10 text-center"><p className="text-sm font-semibold text-danger-strong">Não foi possível carregar o quadro.</p><Button variant="outline" className="mt-4" onClick={onRetry}>Tentar novamente</Button></div>;
  }
  if (items.length === 0) {
    return <div className="rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center"><ClipboardEmpty /><p className="mt-3 text-sm font-semibold text-text">Nenhuma OS nesta visualização</p><p className="mt-1 text-xs text-text-muted">Ajuste os filtros ou crie um novo atendimento.</p></div>;
  }

  return <>
    <p className="mb-3 hidden text-xs text-text-muted md:block">Arraste um cartão para uma etapa válida ou use o botão no próprio cartão.</p>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-5">
      {BOARD_COLUMNS.map((column) => {
        const targetStatus = column.statuses[0];
        const validTarget = Boolean(draggedItem && draggedItem.status !== targetStatus && canTransitionServiceOrder(draggedItem.status, targetStatus));
        return <BoardColumn
          key={column.label}
          column={column}
          items={sortByUrgency(items.filter((item) => column.statuses.includes(item.status)))}
          canManage={canManage}
          canViewPrices={canViewPrices}
          dragging={Boolean(draggedItem)}
          activeDropTarget={dragOverStatus === targetStatus && validTarget}
          validDropTarget={validTarget}
          onDragEnter={() => validTarget && setDragOverStatus(targetStatus)}
          onDrop={(event) => dropOn(event, targetStatus)}
          onCardDragStart={(item, event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedItem(item); }}
          onCardDragEnd={() => { setDraggedItem(undefined); setDragOverStatus(undefined); }}
        />;
      })}
    </div>
    <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => !open && setPendingMove(undefined)}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><ClipboardText className="size-[18px]" aria-hidden="true" /></span>Confirmar mudança de etapa</DialogTitle><DialogDescription>{pendingMove ? `Mover a OS #${pendingMove.item.orderNumber}, placa ${pendingMove.item.vehiclePlate}, de ${SERVICE_ORDER_STATUS_LABELS[pendingMove.item.status]} para ${SERVICE_ORDER_STATUS_LABELS[pendingMove.toStatus]}?` : ''}</DialogDescription></DialogHeader>
        {pendingMove && reviewStep(pendingMove.item.status, pendingMove.toStatus) && <p className="text-sm text-text-muted">Confira a aprovação, as fotos ou a entrega dentro do atendimento antes de confirmar esta mudança.</p>}
        <DialogFooter><Button variant="outline" onClick={() => setPendingMove(undefined)}>Voltar</Button>{pendingMove && reviewStep(pendingMove.item.status, pendingMove.toStatus) ? <Button asChild><Link href={`/ordens-de-servico/${pendingMove.item.id}?step=${reviewStep(pendingMove.item.status, pendingMove.toStatus)}`}>Conferir atendimento</Link></Button> : <Button onClick={confirmDrop} disabled={transition.isPending}>{transition.isPending ? 'Movendo...' : 'Confirmar mudança'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function ClipboardEmpty() {
  return <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-text-muted"><Hash className="size-5" aria-hidden="true" /></span>;
}

function BoardColumn({ column, items, canManage, canViewPrices, dragging, activeDropTarget, validDropTarget, onDragEnter, onDrop, onCardDragStart, onCardDragEnd }: {
  column: (typeof BOARD_COLUMNS)[number];
  items: ServiceOrderListItemResponse[];
  canManage: boolean;
  canViewPrices: boolean;
  dragging: boolean;
  activeDropTarget: boolean;
  validDropTarget: boolean;
  onDragEnter: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onCardDragStart: (item: ServiceOrderListItemResponse, event: DragEvent<HTMLElement>) => void;
  onCardDragEnd: () => void;
}) {
  const id = `board-${column.statuses[0].toLocaleLowerCase()}`;
  return <section aria-labelledby={id} onDragOver={(event) => { if (validDropTarget) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDragEnter={onDragEnter} onDrop={onDrop} className={`min-w-0 rounded-card border p-3 transition-[border-color,background-color,box-shadow] ${activeDropTarget ? 'border-primary bg-primary-subtle shadow-md' : validDropTarget ? 'border-primary/40 bg-surface' : dragging ? 'border-border bg-muted/30 opacity-70' : 'border-border bg-surface/70'}`}>
    <header className="flex items-start justify-between gap-3 px-1 pb-3">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${column.accent}`} aria-hidden="true" /><h3 id={id} className="text-sm font-bold text-text">{column.label}</h3></div><p className="mt-1 pl-4 text-[11px] text-text-muted">{column.description}</p></div>
      <Badge variant="neutral" className="tabular-nums">{items.length}</Badge>
    </header>
    {activeDropTarget && <div className="mb-2 rounded-button border border-dashed border-primary bg-card px-3 py-3 text-center text-xs font-bold text-primary">Solte para mover para {column.label}</div>}
    <div className="space-y-2">{items.length === 0 ? <div className="rounded-button border border-dashed border-border px-3 py-8 text-center text-xs text-text-muted">Nenhuma OS nesta etapa</div> : items.map((item) => <BoardCard key={item.id} item={item} canManage={canManage} canViewPrices={canViewPrices} onDragStart={(event) => onCardDragStart(item, event)} onDragEnd={onCardDragEnd} />)}</div>
  </section>;
}

function BoardCard({ item, canManage, canViewPrices, onDragStart, onDragEnd }: { item: ServiceOrderListItemResponse; canManage: boolean; canViewPrices: boolean; onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void }) {
  const transition = useTransitionServiceOrder();
  const [confirming, setConfirming] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ServiceOrderStatus | null>(null);
  const nextStatus = QUICK_NEXT_STATUS[item.status] ?? null;
  const quickAction = QUICK_ACTIONS[item.status];
  const targetStatus = selectedStatus ?? nextStatus;
  const overdue = isOverdueServiceOrder(item);

  function advance() {
    if (!targetStatus) return;
    transition.mutate({ id: item.id, toStatus: targetStatus }, {
      onSuccess: () => { toast.success(`OS #${item.orderNumber} movida para ${SERVICE_ORDER_STATUS_LABELS[targetStatus]}.`); setConfirming(false); setSelectedStatus(null); },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return <>
    <article draggable={canManage} onDragStart={onDragStart} onDragEnd={onDragEnd} className={`rounded-button border bg-card p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-fast hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${canManage ? 'cursor-grab active:cursor-grabbing' : ''} ${overdue ? 'border-danger/40' : 'border-border hover:border-primary/30'}`}>
      <Link href={`/ordens-de-servico/${item.id}`} className="group block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="flex items-center gap-1 text-[11px] font-bold text-primary">{canManage && <DotsSixVertical className="size-3.5 text-text-muted" aria-hidden="true" />}<Hash className="size-3" aria-hidden="true" />OS {item.orderNumber}</p><p className="mt-1 truncate text-sm font-bold text-text">{item.vehicleBrand} {item.vehicleModel}</p><p className="mt-0.5 font-mono text-[11px] font-semibold tracking-wide text-text-muted">{item.vehiclePlate}</p></div>
          <StatusBadge status={item.status} />
        </div>
        {overdue && <div className="mt-2 flex items-center gap-1.5 rounded-sm bg-danger-subtle px-2 py-1.5 text-[11px] font-bold text-danger"><Warning className="size-3.5" aria-hidden="true" />Entrega atrasada</div>}
        <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
          <InfoLine icon={User}>{item.customerName}</InfoLine>
          <InfoLine icon={Wrench}>{item.technicianName ?? 'Sem técnico atribuído'}</InfoLine>
          <InfoLine icon={CalendarDot}>{item.expectedDeliveryAt ? `Entrega: ${new Date(item.expectedDeliveryAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Entrega sem previsão'}</InfoLine>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-text-muted">
          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{elapsedSince(item.statusSince ?? item.openedAt)}</span>
          <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
        {canViewPrices && <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px]"><span className={item.paymentStatus === 'PAID' ? 'font-bold text-success' : 'font-semibold text-warning'}>{PAYMENT_LABELS[item.paymentStatus]}</span><span className="font-bold tabular-nums text-text">{formatCurrencyBRL(item.totalAmountCents)}</span></div>}
      </Link>
      {canManage && quickAction && <Link href={`/ordens-de-servico/${item.id}?step=${quickAction.step}`} className="mt-3 flex h-9 w-full items-center justify-center gap-1 rounded-button border border-primary/20 bg-primary-subtle px-2 text-xs font-bold text-primary-strong transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{quickAction.label}<CaretRight className="size-3.5" aria-hidden="true" /></Link>}
      {canManage && SERVICE_ORDER_TRANSITIONS[item.status].some((status) => status !== 'CANCELLED') && <select value="" aria-label={`Mover OS #${item.orderNumber} para outra etapa`} className="mt-2 h-9 w-full rounded-button border border-input bg-background px-2 text-xs text-text" onChange={(event) => { if (event.target.value) { setSelectedStatus(event.target.value as ServiceOrderStatus); setConfirming(true); } }}><option value="" disabled>Mover para outra etapa...</option>{SERVICE_ORDER_TRANSITIONS[item.status].filter((status) => status !== 'CANCELLED').map((status) => <option key={status} value={status}>{SERVICE_ORDER_STATUS_LABELS[status]}</option>)}</select>}
    </article>

    <Dialog open={confirming} onOpenChange={(open) => { setConfirming(open); if (!open) setSelectedStatus(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><ClipboardText className="size-[18px]" aria-hidden="true" /></span>Confirmar mudança de etapa</DialogTitle><DialogDescription>Você está alterando a OS #{item.orderNumber}, do veículo {item.vehiclePlate}, de {SERVICE_ORDER_STATUS_LABELS[item.status]} para {targetStatus ? SERVICE_ORDER_STATUS_LABELS[targetStatus] : ''}.</DialogDescription></DialogHeader>
        {targetStatus === 'DELIVERED' && item.outstandingAmountCents > 0 && <div className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm font-semibold text-warning-strong">Atenção: esta OS ainda possui {formatCurrencyBRL(item.outstandingAmountCents)} pendente de recebimento.</div>}
        {targetStatus && reviewStep(item.status, targetStatus) && <p className="text-sm text-text-muted">Você será levado à conferência desta etapa. Nenhuma mensagem será enviada apenas por mudar o status.</p>}
        <DialogFooter><Button variant="outline" onClick={() => { setConfirming(false); setSelectedStatus(null); }}>Voltar</Button>{targetStatus && reviewStep(item.status, targetStatus) ? <Button asChild><Link href={`/ordens-de-servico/${item.id}?step=${reviewStep(item.status, targetStatus)}`}>Conferir atendimento</Link></Button> : <Button onClick={advance} disabled={transition.isPending}>{transition.isPending ? 'Atualizando...' : 'Confirmar mudança'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function InfoLine({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-xs text-text-muted"><Icon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{children}</span></div>;
}
