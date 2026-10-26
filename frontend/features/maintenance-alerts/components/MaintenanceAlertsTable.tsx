'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import type { MaintenanceAlertListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { extractErrorMessage } from '@/lib/api/client';
import { useResolveMaintenanceAlert } from '../hooks/use-maintenance-alerts';

interface MaintenanceAlertsTableProps {
  items: MaintenanceAlertListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function monthsLabel(months: number): string {
  return months === 1 ? '1 mês' : `${months} meses`;
}

export function MaintenanceAlertsTable({ items, isLoading, isError, onRetry }: MaintenanceAlertsTableProps) {
  const resolveAlert = useResolveMaintenanceAlert();

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando alertas de manutenção" className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-sm text-danger">Não foi possível carregar os alertas de manutenção.</p>
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">
        Nenhum veículo devendo revisão no momento.
      </div>
    );
  }

  function handleResolve(id: string) {
    resolveAlert.mutate(
      { id },
      {
        onSuccess: () => toast.success('Alerta marcado como resolvido.'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Veículo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Devendo há</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-medium text-text">
                {alert.vehicleBrand} {alert.vehicleModel} · {alert.vehiclePlate}
              </TableCell>
              <TableCell className="text-text-muted">
                <Link href="/clientes" className="hover:underline">
                  {alert.customerName}
                </Link>
              </TableCell>
              <TableCell className="text-text-muted">{monthsLabel(alert.monthsOverdue)}</TableCell>
              <TableCell className="text-right">
                {alert.status === 'OPEN' && (
                  <Button size="sm" variant="outline" disabled={resolveAlert.isPending} onClick={() => handleResolve(alert.id)}>
                    Marcar como resolvido
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
