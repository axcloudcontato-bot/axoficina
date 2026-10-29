'use client';

import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hasPermission } from '@/features/auth/permissions';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { CustomersTable } from '@/features/customers/components/CustomersTable';
import { DeleteCustomerDialog } from '@/features/customers/components/DeleteCustomerDialog';
import { useCustomersList, useRestoreCustomer } from '@/features/customers/hooks/use-customers';
import { extractErrorMessage } from '@/lib/api/client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const user = useAuthStore((state) => state.user);
  // The mechanic can look customers up (to see who owns a vehicle) but not manage them. The backend
  // is the source of truth (`customers.manage`); this mirrors the same permission to hide the buttons.
  const canManage = hasPermission(user, 'customers.manage');

  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<'' | 'DEBT' | 'INACTIVE'>('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItemResponse | undefined>(undefined);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerListItemResponse | null>(null);
  const restore = useRestoreCustomer();

  // The list follows the box once typing pauses, not on every keystroke.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const { data, isLoading, isError, refetch } = useCustomersList({ offset, limit: PAGE_SIZE, search: search || undefined, archived: archived || undefined, filter: archived || !filter ? undefined : filter });

  function openCreateModal() {
    setEditingCustomer(undefined);
    setFormModalOpen(true);
  }

  function openEditModal(customer: CustomerListItemResponse) {
    setEditingCustomer(customer);
    setFormModalOpen(true);
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
            placeholder="Buscar por nome, telefone ou documento..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setOffset(0);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!archived && <select aria-label="Filtrar clientes" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setOffset(0); }}><option value="">Todos os clientes</option><option value="DEBT">Com valor a receber</option><option value="INACTIVE">Sem visita há mais de 6 meses</option></select>}
          {canManage && (
            <div role="tablist" aria-label="Situação do cadastro" className="flex gap-1 rounded-button bg-muted p-1">
              {[{ value: false, label: 'Ativos' }, { value: true, label: 'Arquivados' }].map((option) => (
                <button key={option.label} role="tab" aria-selected={archived === option.value} onClick={() => switchView(option.value)} className={`rounded-button px-3 py-1.5 text-sm font-semibold transition-colors ${archived === option.value ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {canManage && <Button onClick={openCreateModal}>Novo cliente</Button>}
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
        searching={Boolean(search) || Boolean(filter)}
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

      <CustomerFormModal open={formModalOpen} onOpenChange={setFormModalOpen} customer={editingCustomer} />
      <DeleteCustomerDialog open={Boolean(deletingCustomer)} onOpenChange={(open) => !open && setDeletingCustomer(null)} customer={deletingCustomer} />
    </div>
  );
}
