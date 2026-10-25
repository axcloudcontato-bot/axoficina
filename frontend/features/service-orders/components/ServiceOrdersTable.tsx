'use client';

import Link from 'next/link';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { StatusBadge } from './StatusBadge';

interface ServiceOrdersTableProps {
  items: ServiceOrderListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyMessage?: string;
  canViewPrices?: boolean;
}

export function ServiceOrdersTable({
  items,
  isLoading,
  isError,
  onRetry,
  emptyMessage = 'Nenhuma ordem de serviço ainda. Crie o primeiro atendimento para iniciar a operação.',
  canViewPrices = true,
}: ServiceOrdersTableProps) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando ordens de serviço" className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-sm text-danger">Não foi possível carregar as ordens de serviço.</p>
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>OS</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Técnico</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Entrega / cancelamento</TableHead>
            <TableHead>Previsão de entrega</TableHead>
            {canViewPrices && <TableHead>Pagamento</TableHead>}
            {canViewPrices && <TableHead className="text-right">Valor</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((serviceOrder) => (
            <TableRow key={serviceOrder.id}>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`} className="font-bold text-primary">#{serviceOrder.orderNumber}</LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`} className="min-w-48 font-medium text-text">{serviceOrder.vehicleBrand} {serviceOrder.vehicleModel}<span className="mt-0.5 block font-mono text-[11px] text-text-muted">{serviceOrder.vehiclePlate}</span></LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`}>{serviceOrder.customerName}</LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`}>{serviceOrder.technicianName ?? 'Sem técnico'}</LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`}><StatusBadge status={serviceOrder.status} /></LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`}>{formatHistoryDate(serviceOrder.openedAt)}</LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`}>{formatHistoryDate(serviceOrder.closedAt)}</LinkedCell>
              <LinkedCell href={`/service-orders/${serviceOrder.id}`} className={serviceOrder.expectedDeliveryAt && new Date(serviceOrder.expectedDeliveryAt) < new Date() && !['DELIVERED', 'CANCELLED'].includes(serviceOrder.status) ? 'font-semibold text-danger' : undefined}>{serviceOrder.expectedDeliveryAt ? new Date(serviceOrder.expectedDeliveryAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem previsão'}</LinkedCell>
              {canViewPrices && <LinkedCell href={`/service-orders/${serviceOrder.id}`}><span className={serviceOrder.paymentStatus === 'PAID' ? 'text-success' : 'text-warning'}>{serviceOrder.paymentStatus === 'PAID' ? 'Pago' : serviceOrder.paymentStatus === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendente'}</span></LinkedCell>}
              {canViewPrices && <LinkedCell href={`/service-orders/${serviceOrder.id}`} className="text-right font-semibold text-text">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</LinkedCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatHistoryDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function LinkedCell({ href, className = '', children }: { href: string; className?: string; children: React.ReactNode }) {
  return <TableCell className="p-0"><Link href={href} className={`block min-h-12 px-4 py-3 text-text-muted outline-none hover:bg-muted/40 focus-visible:bg-selection focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${className}`}>{children}</Link></TableCell>;
}
