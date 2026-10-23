'use client';

import { ArrowLeft, CalendarBlank, CaretRight, Gauge, ClockCounterClockwise, User, Wrench } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from './StatusBadge';
import { useServiceOrder, useServiceOrdersList } from '../hooks/use-service-orders';
import { formatCurrencyBRL } from '@/lib/format-currency';

interface VehicleServiceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleLabel: string;
  plate: string;
}

export function VehicleServiceHistoryDialog({ open, onOpenChange, vehicleId, vehicleLabel, plate }: VehicleServiceHistoryDialogProps) {
  const [selectedId, setSelectedId] = useState('');
  const history = useServiceOrdersList({ offset: 0, limit: 100, vehicleId }, { enabled: open });
  const detail = useServiceOrder(selectedId);

  function handleOpenChange(next: boolean) {
    if (!next) setSelectedId('');
    onOpenChange(next);
  }

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <div className="flex items-center gap-3">
          {selectedId && <Button variant="ghost" size="icon" aria-label="Voltar para a linha do tempo" onClick={() => setSelectedId('')}><ArrowLeft className="size-4" /></Button>}
          <div>
            <DialogTitle className="flex items-center gap-2.5">
              <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
                <ClockCounterClockwise className="size-[18px]" aria-hidden="true" />
              </span>
              {selectedId ? 'Detalhes do atendimento' : 'Histórico do veículo'}
            </DialogTitle>
            <DialogDescription>{vehicleLabel} · {plate}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {selectedId ? <ServiceOrderHistoryDetail loading={detail.isLoading} order={detail.data?.serviceOrder} /> : (
        history.isLoading ? <TimelineSkeleton /> :
        history.isError ? <div className="rounded-button border border-danger/30 bg-danger-subtle p-5 text-sm text-danger">Não foi possível carregar o histórico deste veículo.</div> :
        (history.data?.items.length ?? 0) === 0 ? <div className="py-12 text-center"><ClockCounterClockwise className="mx-auto size-8 text-text-muted" /><p className="mt-3 font-semibold text-text">Nenhum atendimento encontrado</p></div> :
        <ol className="relative ml-3 border-l-2 border-border pl-6">
          {history.data?.items.map((order, index) => <li key={order.id} className="relative pb-4 last:pb-0">
            <span className="absolute -left-[31px] top-4 size-3 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
            <button type="button" onClick={() => setSelectedId(order.id)} className="group w-full rounded-card border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-selection/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-wide text-primary">OS #{String(order.orderNumber).padStart(5, '0')}</p><p className="mt-1 text-sm font-semibold text-text">{new Date(order.openedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
                <div className="flex items-center gap-2"><StatusBadge status={order.status} /><CaretRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" /></div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-text-muted">{order.diagnosis || order.customerComplaint || 'Atendimento sem descrição registrada.'}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
                <span>{order.technicianName || 'Sem técnico definido'}</span>
                {order.entryMileage != null && <span>{order.entryMileage.toLocaleString('pt-BR')} km</span>}
                <strong className="text-text">{formatCurrencyBRL(order.totalAmountCents)}</strong>
              </div>
            </button>
            {index === 0 && <span className="sr-only">Atendimento mais recente</span>}
          </li>)}
        </ol>
      )}
    </DialogContent>
  </Dialog>;
}

function ServiceOrderHistoryDetail({ loading, order }: { loading: boolean; order?: NonNullable<ReturnType<typeof useServiceOrder>['data']>['serviceOrder'] }) {
  if (loading) return <TimelineSkeleton />;
  if (!order) return <p className="py-8 text-center text-sm text-danger">Não foi possível carregar os detalhes deste atendimento.</p>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-muted/50 p-4"><div><p className="text-xs font-bold uppercase text-primary">OS #{String(order.orderNumber).padStart(5, '0')}</p><p className="mt-1 text-sm text-text-muted">{new Date(order.openedAt).toLocaleString('pt-BR')}</p></div><StatusBadge status={order.status} /></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Info icon={CalendarBlank} label="Entrada" value={new Date(order.openedAt).toLocaleDateString('pt-BR')} />
      <Info icon={Gauge} label="Quilometragem" value={order.entryMileage != null ? `${order.entryMileage.toLocaleString('pt-BR')} km` : 'Não informada'} />
      <Info icon={User} label="Técnico" value={order.technicianName || 'Não definido'} />
    </div>
    <TextBlock title="Solicitação do cliente" text={order.customerComplaint} />
    <TextBlock title="Diagnóstico" text={order.diagnosis} />
    <TextBlock title="Serviço recomendado" text={order.recommendedService} />
    <section><h4 className="mb-2 text-sm font-bold text-text">Peças e mão de obra</h4>
      {(order.items?.length ?? 0) === 0 ? <p className="rounded-button border border-dashed border-border p-4 text-sm text-text-muted">Nenhum item registrado.</p> :
      <div className="divide-y divide-border rounded-button border border-border">{order.items?.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-text">{item.description}</p><p className="text-xs text-text-muted">{item.quantity} × {formatCurrencyBRL(item.unitPriceCents)}</p></div><strong className="text-sm text-text">{formatCurrencyBRL(item.lineTotalCents)}</strong></div>)}</div>}
      <div className="mt-3 flex justify-end text-sm"><span className="mr-3 text-text-muted">Total do atendimento</span><strong className="text-base text-text">{formatCurrencyBRL(order.totalAmountCents)}</strong></div>
    </section>
  </div>;
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-button border border-border p-3"><Icon className="size-4 text-primary" /><p className="mt-2 text-xs font-bold uppercase text-text-muted">{label}</p><p className="mt-1 text-sm font-semibold text-text">{value}</p></div>;
}
function TextBlock({ title, text }: { title: string; text?: string }) {
  return <section><h4 className="text-sm font-bold text-text">{title}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-muted">{text || 'Não informado.'}</p></section>;
}
function TimelineSkeleton() { return <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-card bg-muted" />)}</div>; }
