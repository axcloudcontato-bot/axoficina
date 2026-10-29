'use client';

import Link from 'next/link';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { ChatCircleDots, ClipboardText } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { displayDocument, displayPhone, newServiceOrderHref, phoneDigits, whatsappHref } from '../format-customer';

const TYPE_LABELS: Record<string, string> = {
  PF: 'Pessoa física',
  PJ: 'Pessoa jurídica',
};

interface CustomersTableProps {
  items: CustomerListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canManage: boolean;
  onEdit: (customer: CustomerListItemResponse) => void;
  onDelete: (customer: CustomerListItemResponse) => void;
  /** Showing the archived customers: the only action is to bring one back. */
  archived?: boolean;
  onRestore?: (customer: CustomerListItemResponse) => void;
  /** A search is active, so an empty list means "nothing matched", not "nothing registered". */
  searching?: boolean;
}

const dateOnly = (value: string) => new Date(value).toLocaleDateString('pt-BR');

export function CustomersTable({ items, isLoading, isError, onRetry, canManage, onEdit, onDelete, archived = false, onRestore, searching = false }: CustomersTableProps) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando clientes" className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-sm text-danger">Não foi possível carregar os clientes.</p>
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
          ? 'Nenhum cliente encontrado para essa busca. Confira o nome, o telefone ou o documento.'
          : archived
            ? 'Nenhum cliente arquivado.'
            : <>Nenhum cliente ainda.{canManage && ' Cadastre o primeiro clicando em "Novo cliente".'}</>}
      </div>
    );
  }

  const showSpend = items.some((customer) => customer.stats?.totalSpentCents !== undefined);

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Tipo</TableHead>
            {!archived && <TableHead>Veículos</TableHead>}
            {!archived && <TableHead>Última visita</TableHead>}
            {!archived && showSpend && <TableHead className="text-right">Total gasto</TableHead>}
            {archived && <TableHead>Arquivado em</TableHead>}
            {canManage && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium text-text">{archived ? customer.name : <Link href={`/clientes/${customer.id}`} className="hover:text-primary hover:underline">{customer.name}</Link>}</TableCell>
              <TableCell className="text-text-muted">{displayDocument(customer.document)}</TableCell>
              <TableCell className="text-text-muted">{displayPhone(customer.phone)}</TableCell>
              <TableCell>
                <Badge variant="outline">{TYPE_LABELS[customer.type] ?? customer.type}</Badge>
              </TableCell>
              {!archived && <TableCell className="text-text-muted">{customer.stats?.plates.length ? customer.stats.plates.slice(0, 2).join(', ') + (customer.stats.plates.length > 2 ? ` +${customer.stats.plates.length - 2}` : '') : '—'}</TableCell>}
              {!archived && <TableCell className="text-text-muted">{customer.stats?.lastVisitAt ? dateOnly(customer.stats.lastVisitAt) : 'Nunca'}</TableCell>}
              {!archived && showSpend && <TableCell className="text-right tabular-nums text-text-muted">{customer.stats?.totalSpentCents !== undefined ? formatCurrencyBRL(customer.stats.totalSpentCents) : '—'}</TableCell>}
              {archived && <TableCell className="text-text-muted">{customer.archivedAt ? new Date(customer.archivedAt).toLocaleDateString('pt-BR') : '—'}</TableCell>}
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {archived ? (
                      <Button variant="outline" size="sm" onClick={() => onRestore?.(customer)}>
                        Reativar
                      </Button>
                    ) : (
                      <>
                        {phoneDigits(customer.phone).length >= 10 && <Button variant="ghost" size="icon" asChild aria-label={`WhatsApp de ${customer.name}`}><a href={whatsappHref(customer.phone)} target="_blank" rel="noopener noreferrer"><ChatCircleDots className="size-4" aria-hidden="true" /></a></Button>}
                        <Button variant="ghost" size="icon" asChild aria-label={`Nova OS para ${customer.name}`}><Link href={newServiceOrderHref(customer)}><ClipboardText className="size-4" aria-hidden="true" /></Link></Button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(customer)}>
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(customer)}>
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
