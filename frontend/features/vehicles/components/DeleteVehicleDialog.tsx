'use client';

import { toast } from 'sonner';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { useDeleteVehicle, useVehicleArchiveImpact } from '../hooks/use-vehicles';

interface DeleteVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleListItemResponse | null;
}

export function DeleteVehicleDialog({ open, onOpenChange, vehicle }: DeleteVehicleDialogProps) {
  const deleteVehicle = useDeleteVehicle();
  const impact = useVehicleArchiveImpact(vehicle?.id, open).data;
  const hasPending = Boolean(impact && (impact.openServiceOrders > 0 || impact.upcomingAppointments > 0));

  function handleConfirm() {
    if (!vehicle) {
      return;
    }
    deleteVehicle.mutate(
      { id: vehicle.id },
      {
        onSuccess: () => {
          toast.success(`Veículo ${vehicle.plate} removido.`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-danger-subtle text-danger">
              <Trash className="size-[18px]" aria-hidden="true" />
            </span>
            Arquivar veículo
          </DialogTitle>
          <DialogDescription>
            Tem certeza que quer arquivar o veículo <strong>{vehicle?.plate}</strong>? O histórico das ordens de serviço
            não é afetado, mas o veículo deixa de aparecer na lista. Dá para reativar depois em "Arquivados".
          </DialogDescription>
        </DialogHeader>
        {hasPending && impact && (
          <div role="alert" className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm">
            <p className="font-semibold">Este veículo ainda tem pendências:</p>
            <ul className="mt-1 list-disc pl-5">
              {impact.openServiceOrders > 0 && <li>{impact.openServiceOrders} {impact.openServiceOrders === 1 ? 'ordem de serviço em andamento' : 'ordens de serviço em andamento'}</li>}
              {impact.upcomingAppointments > 0 && <li>{impact.upcomingAppointments} {impact.upcomingAppointments === 1 ? 'agendamento futuro' : 'agendamentos futuros'}</li>}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={deleteVehicle.isPending} onClick={handleConfirm}>
            {deleteVehicle.isPending ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
