'use client';

import Link from 'next/link';
import { ClipboardText } from '@phosphor-icons/react';
import { formatPlate, type VehicleListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { newServiceOrderHref } from '@/features/customers/format-customer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface VehiclesTableProps {
  items: VehicleListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canManage: boolean;
  onEdit: (vehicle: VehicleListItemResponse) => void;
  onDelete: (vehicle: VehicleListItemResponse) => void;
  /** Showing the archived vehicles: the only action is to bring one back. */
  archived?: boolean;
  onRestore?: (vehicle: VehicleListItemResponse) => void;
  /** A search is active, so an empty list means "nothing matched", not "nothing registered". */
  searching?: boolean;
  /** Which column the list is sorted by, and how; clicking a sortable header asks to change it. */
  sort?: 'recent' | 'plate' | 'year' | 'mileage';
  direction?: 'asc' | 'desc';
  onSort?: (column: 'plate' | 'year' | 'mileage') => void;
}

export function VehiclesTable({ items, isLoading, isError, onRetry, canManage, onEdit, onDelete, archived = false, onRestore, searching = false, sort = 'recent', direction, onSort }: VehiclesTableProps) {
  const header = (column: 'plate' | 'year' | 'mileage', label: string, className?: string) => {
    const active = sort === column;
    const ascending = (direction ?? (column === 'plate' ? 'asc' : 'desc')) === 'asc';
    if (!onSort) return <TableHead className={className}>{label}</TableHead>;
    return <TableHead className={className} aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 font-medium hover:text-text">{label}{active && <span aria-hidden="true">{ascending ? '↑' : '↓'}</span>}</button></TableHead>;
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando veículos" className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-sm text-danger">Não foi possível carregar os veículos.</p>
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">
        {searching
          ? 'Nenhum veículo encontrado para essa busca. Confira a placa, o modelo ou o nome do dono.'
          : archived
            ? 'Nenhum veículo arquivado.'
            : <>Nenhum veículo ainda.{canManage && ' Cadastre o primeiro clicando em "Novo veículo".'}</>}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Marca</TableHead>
            <TableHead>Modelo</TableHead>
            {archived ? <TableHead>Placa</TableHead> : header('plate', 'Placa')}
            {!archived && header('year', 'Ano')}
            {!archived && header('mileage', 'Km', 'text-right')}
            <TableHead>Cliente</TableHead>
            {!archived && <TableHead className="text-right">OS</TableHead>}
            {!archived && <TableHead>Última visita</TableHead>}
            {archived && <TableHead>Arquivado em</TableHead>}
            {canManage && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((vehicle) => (
            <TableRow key={vehicle.id}>
              <TableCell className="font-medium text-text">{vehicle.brand}</TableCell>
              <TableCell className="text-text-muted">{vehicle.model}</TableCell>
              <TableCell className="text-text-muted">{archived ? formatPlate(vehicle.plate) : <Link href={`/veiculos/${vehicle.id}`} className="font-semibold hover:text-primary hover:underline">{formatPlate(vehicle.plate)}</Link>}</TableCell>
              {!archived && <TableCell className="text-text-muted">{vehicle.year ?? '—'}</TableCell>}
              {!archived && <TableCell className="text-right tabular-nums text-text-muted">{vehicle.mileage != null ? vehicle.mileage.toLocaleString('pt-BR') : '—'}</TableCell>}
              <TableCell className="text-text-muted">{archived ? vehicle.customerName : <Link href={`/clientes/${vehicle.customerId}`} className="hover:text-primary hover:underline">{vehicle.customerName}</Link>}</TableCell>
              {!archived && <TableCell className="text-right tabular-nums text-text-muted">{vehicle.stats?.orderCount ?? '—'}</TableCell>}
              {!archived && <TableCell className="text-text-muted">{vehicle.stats ? (vehicle.stats.lastVisitAt ? new Date(vehicle.stats.lastVisitAt).toLocaleDateString('pt-BR') : 'Nunca') : '—'}</TableCell>}
              {archived && <TableCell className="text-text-muted">{vehicle.archivedAt ? new Date(vehicle.archivedAt).toLocaleDateString('pt-BR') : '—'}</TableCell>}
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {archived ? (
                      <Button variant="outline" size="sm" onClick={() => onRestore?.(vehicle)}>
                        Reativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" asChild aria-label={`Nova OS para ${vehicle.plate}`}><Link href={newServiceOrderHref({ id: vehicle.customerId, name: vehicle.customerName }, { id: vehicle.id, label: `${vehicle.brand} ${vehicle.model} · ${formatPlate(vehicle.plate)}` })}><ClipboardText className="size-4" aria-hidden="true" /></Link></Button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(vehicle)}>
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(vehicle)}>
                          Arquivar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
