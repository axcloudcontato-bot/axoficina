'use client';

import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteVehicleDialog } from '@/features/vehicles/components/DeleteVehicleDialog';
import { VehicleFormModal } from '@/features/vehicles/components/VehicleFormModal';
import { VehiclesTable } from '@/features/vehicles/components/VehiclesTable';
import { useVehiclesList } from '@/features/vehicles/hooks/use-vehicles';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;

export default function VehiclesPage() {
  const user = useAuthStore((state) => state.user);
  // MECHANIC vê a tela mas não gerencia veículos — mesmo padrão de
  // Clientes; RolesGuard do backend é a fonte de verdade (ver spec
  // veiculos-crud-vinculado-cliente.md).
  const canManage = user?.role !== 'MECHANIC';

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleListItemResponse | undefined>(undefined);
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleListItemResponse | null>(null);

  const { data, isLoading, isError, refetch } = useVehiclesList({ offset, limit: PAGE_SIZE, search: search || undefined });

  function openCreateModal() {
    setEditingVehicle(undefined);
    setFormModalOpen(true);
  }

  function openEditModal(vehicle: VehicleListItemResponse) {
    setEditingVehicle(vehicle);
    setFormModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar por marca, modelo ou placa..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            className="pl-9"
          />
        </div>
        {canManage && <Button onClick={openCreateModal}>Novo veículo</Button>}
      </div>

      <VehiclesTable
        items={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        canManage={canManage}
        onEdit={openEditModal}
        onDelete={setDeletingVehicle}
      />

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{data.total} veículos no total</span>
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

      <VehicleFormModal open={formModalOpen} onOpenChange={setFormModalOpen} vehicle={editingVehicle} />
      <DeleteVehicleDialog open={Boolean(deletingVehicle)} onOpenChange={(open) => !open && setDeletingVehicle(null)} vehicle={deletingVehicle} />
    </div>
  );
}
