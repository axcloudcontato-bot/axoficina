'use client';

import { toast } from 'sonner';
import { Trash } from '@phosphor-icons/react';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { useDeleteServiceOrder } from '../hooks/use-service-orders';

interface DeleteServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrder: ServiceOrderListItemResponse | null;
  onDeleted?: () => void;
}

export function DeleteServiceOrderDialog({ open, onOpenChange, serviceOrder, onDeleted }: DeleteServiceOrderDialogProps) {
  const deleteServiceOrder = useDeleteServiceOrder();

  function handleConfirm() {
    if (!serviceOrder) {
      return;
    }
    deleteServiceOrder.mutate(
      { id: serviceOrder.id },
      {
        onSuccess: () => {
          toast.success('Ordem de serviço excluída.');
          onOpenChange(false);
          onDeleted?.();
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
            Excluir ordem de serviço
          </DialogTitle>
          <DialogDescription>
            Tem certeza que quer excluir a OS do veículo <strong>{serviceOrder?.vehiclePlate}</strong>? Esta ação não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={deleteServiceOrder.isPending} onClick={handleConfirm}>
            {deleteServiceOrder.isPending ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
