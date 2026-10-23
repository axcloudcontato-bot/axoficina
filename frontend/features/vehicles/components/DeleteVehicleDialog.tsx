'use client';

import { toast } from 'sonner';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { useDeleteVehicle } from '../hooks/use-vehicles';

interface DeleteVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleListItemResponse | null;
}

export function DeleteVehicleDialog({ open, onOpenChange, vehicle }: DeleteVehicleDialogProps) {
  const deleteVehicle = useDeleteVehicle();

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
            Excluir veículo
          </DialogTitle>
          <DialogDescription>
            Tem certeza que quer excluir o veículo <strong>{vehicle?.plate}</strong>? Este veículo pode ter ordens de
            serviço vinculadas — o histórico delas não é afetado, mas o veículo deixa de aparecer na lista.
          </DialogDescription>
        </DialogHeader>
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
