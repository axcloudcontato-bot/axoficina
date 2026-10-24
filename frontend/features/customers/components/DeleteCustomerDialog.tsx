'use client';

import { toast } from 'sonner';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { useDeleteCustomer } from '../hooks/use-customers';

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerListItemResponse | null;
}

export function DeleteCustomerDialog({ open, onOpenChange, customer }: DeleteCustomerDialogProps) {
  const deleteCustomer = useDeleteCustomer();

  function handleConfirm() {
    if (!customer) {
      return;
    }
    deleteCustomer.mutate(
      { id: customer.id },
      {
        onSuccess: () => {
          toast.success(`Cliente ${customer.name} removido.`);
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
            Arquivar cliente
          </DialogTitle>
          <DialogDescription>
            Tem certeza que quer arquivar <strong>{customer?.name}</strong>? Este cliente pode ter veículos ou ordens de
            serviço vinculados — o histórico deles não é afetado, mas o cliente deixa de aparecer na lista.
            Isso não elimina os dados pessoais. Para solicitar exclusão pela LGPD, utilize a Central de privacidade nas configurações.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={deleteCustomer.isPending} onClick={handleConfirm}>
            {deleteCustomer.isPending ? 'Arquivando...' : 'Arquivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
