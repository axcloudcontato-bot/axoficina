'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { CustomersTable } from '@/features/customers/components/CustomersTable';
import { DeleteCustomerDialog } from '@/features/customers/components/DeleteCustomerDialog';
import { useCustomersList } from '@/features/customers/hooks/use-customers';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  // MECHANIC vê a tela (precisa consultar o dono do veículo numa OS), mas
  // não gerencia clientes — RolesGuard do backend é a fonte de verdade,
  // isto só espelha pra esconder os botões (ver spec clientes-crud-pf-pj.md).
  const canManage = user?.role !== 'MECHANIC';

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItemResponse | undefined>(undefined);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerListItemResponse | null>(null);

  const { data, isLoading, isError, refetch } = useCustomersList({ offset, limit: PAGE_SIZE, search: search || undefined });

  function openCreateModal() {
    router.push('/service-orders/new');
  }

  function openEditModal(customer: CustomerListItemResponse) {
    setEditingCustomer(customer);
    setFormModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            aria-label="Buscar clientes"
            placeholder="Buscar por nome ou documento..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            className="pl-9"
          />
        </div>
        {canManage && <Button onClick={openCreateModal}>Novo cliente</Button>}
      </div>

      <CustomersTable
        items={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        canManage={canManage}
        onEdit={openEditModal}
        onDelete={setDeletingCustomer}
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
