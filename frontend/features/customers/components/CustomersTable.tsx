'use client';

import Link from 'next/link';
import * as Popover from '@radix-ui/react-popover';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { ChatCircleDots, ClipboardText, DotsThree } from '@phosphor-icons/react';
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
            <TableHead>Cliente</TableHead>
            <TableHead>Telefone</TableHead>
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
              <TableCell><div className="space-y-1"><div className="font-medium text-text">{archived ? customer.name : <Link href={`/clientes/${customer.id}`} className="hover:text-primary hover:underline">{customer.name}</Link>}</div><div className="flex flex-wrap items-center gap-2 text-xs text-text-muted"><Badge variant="outline">{TYPE_LABELS[customer.type] ?? customer.type}</Badge><span>{displayDocument(customer.document)}</span></div></div></TableCell>
              <TableCell className="text-text-muted">{displayPhone(customer.phone)}</TableCell>
              {!archived && <TableCell className="text-text-muted">{customer.stats?.plates.length ? customer.stats.plates.slice(0, 2).join(', ') + (customer.stats.plates.length > 2 ? ` +${customer.stats.plates.length - 2}` : '') : 'Nenhum veículo'}</TableCell>}
              {!archived && <TableCell className="text-text-muted">{customer.stats?.lastVisitAt ? dateOnly(customer.stats.lastVisitAt) : 'Nunca'}</TableCell>}
              {!archived && showSpend && <TableCell className="text-right tabular-nums text-text-muted">{customer.stats?.totalSpentCents !== undefined ? formatCurrencyBRL(customer.stats.totalSpentCents) : 'Não disponível'}</TableCell>}
              {archived && <TableCell className="text-text-muted">{customer.archivedAt ? new Date(customer.archivedAt).toLocaleDateString('pt-BR') : 'Data não informada'}</TableCell>}
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {archived ? (
                      <Button variant="outline" size="sm" onClick={() => onRestore?.(customer)}>
                        Reativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" asChild aria-label={`Nova OS para ${customer.name}`}><Link href={newServiceOrderHref(customer)}><ClipboardText className="size-4" aria-hidden="true" />Nova OS</Link></Button>
                        <Popover.Root><Popover.Trigger asChild><Button variant="ghost" size="icon" aria-label={`Mais ações para ${customer.name}`}><DotsThree className="size-5" aria-hidden="true" /></Button></Popover.Trigger><Popover.Portal><Popover.Content align="end" sideOffset={4} className="z-50 min-w-40 rounded-button border border-border bg-card p-1 shadow-lg"><div className="flex flex-col text-left text-sm">
                          {phoneDigits(customer.phone).length >= 10 && <Popover.Close asChild><a href={whatsappHref(customer.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-muted"><ChatCircleDots className="size-4" aria-hidden="true" />WhatsApp de {customer.name}</a></Popover.Close>}
                          <Popover.Close asChild><button type="button" onClick={() => onEdit(customer)} className="rounded-sm px-3 py-2 text-left hover:bg-muted">Editar</button></Popover.Close>
                          <Popover.Close asChild><button type="button" onClick={() => onDelete(customer)} className="rounded-sm px-3 py-2 text-left text-danger hover:bg-danger-subtle">Arquivar</button></Popover.Close>
                        </div></Popover.Content></Popover.Portal></Popover.Root>
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
