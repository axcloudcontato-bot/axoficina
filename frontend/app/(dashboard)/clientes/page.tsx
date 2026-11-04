'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadSimple, MagnifyingGlass, UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { segmentedItem, segmentedList } from '@/components/ui/segmented';
import { hasPermission } from '@/features/auth/permissions';
import { CustomerImportModal } from '@/features/customers/components/CustomerImportModal';
import { customersToRows } from '@/features/customers/customer-csv';
import { customersApi } from '@/features/customers/api/customers-api';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { CustomersTable } from '@/features/customers/components/CustomersTable';
import { DeleteCustomerDialog } from '@/features/customers/components/DeleteCustomerDialog';
import { useCustomersList, useRestoreCustomer } from '@/features/customers/hooks/use-customers';
import { extractErrorMessage } from '@/lib/api/client';
import { downloadCsv } from '@/lib/csv';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX = 5000;

export default function CustomersPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  // The mechanic can look customers up (to see who owns a vehicle) but not manage them. The backend
  // is the source of truth (`customers.manage`); this mirrors the same permission to hide the buttons.
  const canManage = hasPermission(user, 'customers.manage');

  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<'' | 'DEBT' | 'INACTIVE' | 'NEVER_VISITED'>('');
  const [sort, setSort] = useState<'' | 'NAME'>('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItemResponse | undefined>(undefined);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerListItemResponse | null>(null);
  const restore = useRestoreCustomer();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // The list follows the box once typing pauses, not on every keystroke.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const { data, isLoading, isError, refetch } = useCustomersList({ offset, limit: PAGE_SIZE, search: search || undefined, archived: archived || undefined, filter: archived || !filter ? undefined : filter, sort: archived || !sort ? undefined : sort });

  function openCreateModal() {
    setEditingCustomer(undefined);
    setFormModalOpen(true);
  }

  function openEditModal(customer: CustomerListItemResponse) {
    setEditingCustomer(customer);
    setFormModalOpen(true);
  }

  // Everything the current search and filter show, not just the page on screen.
  async function exportList() {
    setExporting(true);
    try {
      const items: CustomerListItemResponse[] = [];
      let truncated = false;
      for (let from = 0; from < EXPORT_MAX; from += EXPORT_PAGE_SIZE) {
        const page = await customersApi.list({ offset: from, limit: EXPORT_PAGE_SIZE, search: search || undefined, archived: archived || undefined, filter: archived || !filter ? undefined : filter, sort: archived || !sort ? undefined : sort });
        items.push(...page.items);
        if (!page.hasMore) break;
        if (from + EXPORT_PAGE_SIZE >= EXPORT_MAX) truncated = true;
      }
      if (items.length === 0) return void toast.info('Não há clientes para exportar com essa busca.');
      downloadCsv(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, customersToRows(items));
      if (truncated) toast.warning(`O arquivo contém os primeiros ${items.length} clientes. Refine a busca para exportar os demais.`);
      else toast.success(`${items.length} ${items.length === 1 ? 'cliente exportado' : 'clientes exportados'}.`);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  function switchView(next: boolean) {
    setArchived(next);
    setOffset(0);
  }

  function restoreCustomer(customer: CustomerListItemResponse) {
    restore.mutate(customer.id, {
      onSuccess: () => toast.success(`${customer.name} voltou para a lista de clientes.`),
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            aria-label="Buscar clientes"
            placeholder="Nome, telefone, documento ou placa..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setOffset(0);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!archived && <select aria-label="Filtrar clientes" className="h-10 rounded-button border border-input bg-card px-3 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setOffset(0); }}><option value="">Todos os clientes</option><option value="DEBT">Com valor a receber</option><option value="INACTIVE">Sem visita há mais de 6 meses</option><option value="NEVER_VISITED">Sem primeira visita</option></select>}
          {!archived && <select aria-label="Ordenar clientes" className="h-10 rounded-button border border-input bg-card px-3 text-sm" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setOffset(0); }}><option value="">Mais recentes</option><option value="NAME">Nome A–Z</option></select>}
          {canManage && (
            <div role="tablist" aria-label="Situação do cadastro" className={segmentedList}>
              {[{ value: false, label: 'Ativos' }, { value: true, label: 'Arquivados' }].map((option) => (
                <button key={option.label} role="tab" aria-selected={archived === option.value} onClick={() => switchView(option.value)} className={segmentedItem(archived === option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {canManage && <Button variant="outline" onClick={exportList} disabled={exporting}><DownloadSimple className="size-4" aria-hidden="true" />{exporting ? 'Exportando...' : 'Exportar CSV'}</Button>}
          {canManage && !archived && <Button variant="outline" onClick={() => setImporting(true)}><UploadSimple className="size-4" aria-hidden="true" />Importar CSV</Button>}
          {canManage && !archived && <Button onClick={openCreateModal}>Novo cliente</Button>}
        </div>
      </div>

      <CustomersTable
        items={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        canManage={canManage}
        onEdit={openEditModal}
        onDelete={setDeletingCustomer}
        archived={archived}
        onRestore={restoreCustomer}
        searching={Boolean(search) || (!archived && Boolean(filter))}
      />

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{data.total} clientes no total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <CustomerImportModal open={importing} onOpenChange={setImporting} />
      <CustomerFormModal open={formModalOpen} onOpenChange={setFormModalOpen} customer={editingCustomer} onCreated={(customer) => router.push(`/clientes/${customer.id}`)} />
      <DeleteCustomerDialog open={Boolean(deletingCustomer)} onOpenChange={(open) => !open && setDeletingCustomer(null)} customer={deletingCustomer} />
    </div>
  );
}
