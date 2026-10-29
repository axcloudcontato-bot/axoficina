'use client';

import { useState } from 'react';
import { DownloadSimple, MagnifyingGlass, UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteVehicleDialog } from '@/features/vehicles/components/DeleteVehicleDialog';
import { VehicleImportModal } from '@/features/vehicles/components/VehicleImportModal';
import { vehiclesToRows } from '@/features/vehicles/vehicle-csv';
import { vehiclesApi } from '@/features/vehicles/api/vehicles-api';
import { VehicleFormModal } from '@/features/vehicles/components/VehicleFormModal';
import { VehiclesTable } from '@/features/vehicles/components/VehiclesTable';
import { useRestoreVehicle, useVehiclesList } from '@/features/vehicles/hooks/use-vehicles';
import { hasPermission } from '@/features/auth/permissions';
import { extractErrorMessage } from '@/lib/api/client';
import { downloadCsv } from '@/lib/csv';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX = 5000;
type SortColumn = 'plate' | 'year' | 'mileage';
// The first click on a column puts the most useful end first: A to Z for plates, the newest and highest for the rest.
const FIRST_DIRECTION: Record<SortColumn, 'asc' | 'desc'> = { plate: 'asc', year: 'desc', mileage: 'desc' };

export default function VehiclesPage() {
  const user = useAuthStore((state) => state.user);
  // The mechanic can look vehicles up but not manage them. The backend is the source of truth
  // (`vehicles.manage`); this mirrors the same permission to hide the buttons.
  const canManage = hasPermission(user, 'vehicles.manage');

  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<'' | 'INACTIVE' | 'IN_SERVICE'>('');
  const restore = useRestoreVehicle();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sort, setSort] = useState<'recent' | SortColumn>('recent');
  const [direction, setDirection] = useState<'asc' | 'desc'>();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleListItemResponse | undefined>(undefined);
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleListItemResponse | null>(null);

  // The list follows the box once typing pauses, not on every keystroke. The owner's name and document match too.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const { data, isLoading, isError, refetch } = useVehiclesList({ offset, limit: PAGE_SIZE, search: search || undefined, matchOwner: search ? true : undefined, archived: archived || undefined, withStats: archived ? undefined : true, filter: archived || !filter ? undefined : filter, sort: archived || sort === 'recent' ? undefined : sort, direction: archived || sort === 'recent' ? undefined : direction });

  function openCreateModal() {
    setEditingVehicle(undefined);
    setFormModalOpen(true);
  }

  function openEditModal(vehicle: VehicleListItemResponse) {
    setEditingVehicle(vehicle);
    setFormModalOpen(true);
  }

  // A second click on the same column flips the direction; a click on another starts at its natural end.
  function sortBy(column: SortColumn) {
    const same = sort === column;
    setDirection(same ? ((direction ?? FIRST_DIRECTION[column]) === 'asc' ? 'desc' : 'asc') : FIRST_DIRECTION[column]);
    setSort(column);
    setOffset(0);
  }

  // Everything the current search, filter and order show, not just the page on screen.
  async function exportList() {
    setExporting(true);
    try {
      const items: VehicleListItemResponse[] = [];
      for (let from = 0; from < EXPORT_MAX; from += EXPORT_PAGE_SIZE) {
        const page = await vehiclesApi.list({ offset: from, limit: EXPORT_PAGE_SIZE, search: search || undefined, matchOwner: search ? true : undefined, archived: archived || undefined, withStats: archived ? undefined : true, filter: archived || !filter ? undefined : filter, sort: archived || sort === 'recent' ? undefined : sort, direction: archived || sort === 'recent' ? undefined : direction });
        items.push(...page.items);
        if (!page.hasMore) break;
      }
      if (items.length === 0) return void toast.info('Não há veículos para exportar com essa busca.');
      downloadCsv(`veiculos-${new Date().toISOString().slice(0, 10)}.csv`, vehiclesToRows(items));
      toast.success(`${items.length} ${items.length === 1 ? 'veículo exportado' : 'veículos exportados'}.`);
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

  function restoreVehicle(vehicle: VehicleListItemResponse) {
    restore.mutate(vehicle.id, {
      onSuccess: () => toast.success(`O veículo ${vehicle.plate} voltou para a lista.`),
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            aria-label="Buscar veículos"
            placeholder="Buscar por placa, modelo, marca ou dono..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setOffset(0);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!archived && <select aria-label="Filtrar veículos" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setOffset(0); }}><option value="">Todos os veículos</option><option value="IN_SERVICE">Em andamento na oficina</option><option value="INACTIVE">Sem visita há mais de 6 meses</option></select>}
          {canManage && (
            <div role="tablist" aria-label="Situação do cadastro" className="flex gap-1 rounded-button bg-muted p-1">
              {[{ value: false, label: 'Ativos' }, { value: true, label: 'Arquivados' }].map((option) => (
                <button key={option.label} role="tab" aria-selected={archived === option.value} onClick={() => switchView(option.value)} className={`rounded-button px-3 py-1.5 text-sm font-semibold transition-colors ${archived === option.value ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {canManage && <Button variant="outline" onClick={exportList} disabled={exporting}><DownloadSimple className="size-4" aria-hidden="true" />{exporting ? 'Exportando...' : 'Exportar CSV'}</Button>}
          {canManage && !archived && <Button variant="outline" onClick={() => setImporting(true)}><UploadSimple className="size-4" aria-hidden="true" />Importar planilha</Button>}
          {canManage && <Button onClick={openCreateModal}>Novo veículo</Button>}
        </div>
      </div>

      <VehiclesTable
        items={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        canManage={canManage}
        onEdit={openEditModal}
        onDelete={setDeletingVehicle}
        archived={archived}
        onRestore={restoreVehicle}
        searching={Boolean(search) || Boolean(filter)}
        sort={sort}
        direction={direction}
        onSort={sortBy}
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

      <VehicleImportModal open={importing} onOpenChange={setImporting} />
      <VehicleFormModal open={formModalOpen} onOpenChange={setFormModalOpen} vehicle={editingVehicle} />
      <DeleteVehicleDialog open={Boolean(deletingVehicle)} onOpenChange={(open) => !open && setDeletingVehicle(null)} vehicle={deletingVehicle} />
    </div>
  );
}
