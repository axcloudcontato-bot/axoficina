'use client';

import { toast } from 'sonner';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useCustomerArchiveImpact, useDeleteCustomer } from '../hooks/use-customers';

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerListItemResponse | null;
}

export function DeleteCustomerDialog({ open, onOpenChange, customer }: DeleteCustomerDialogProps) {
  const deleteCustomer = useDeleteCustomer();
  const impact = useCustomerArchiveImpact(customer?.id, open).data;
  const hasPending = Boolean(impact && (impact.openServiceOrders > 0 || impact.pendingCents > 0));

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
            Tem certeza que quer arquivar <strong>{customer?.name}</strong>? O histórico de veículos e ordens de serviço
            não é afetado, mas o cliente deixa de aparecer na lista. Dá para reativar depois em "Arquivados".
            Isso não elimina os dados pessoais. Para solicitar exclusão pela LGPD, utilize a Central de privacidade nas configurações.
          </DialogDescription>
        </DialogHeader>
        {hasPending && impact && (
          <div role="alert" className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm">
            <p className="font-semibold">Este cliente ainda tem pendências:</p>
            <ul className="mt-1 list-disc pl-5">
              {impact.openServiceOrders > 0 && <li>{impact.openServiceOrders} {impact.openServiceOrders === 1 ? 'ordem de serviço em andamento' : 'ordens de serviço em andamento'}</li>}
              {impact.pendingCents > 0 && <li>{formatCurrencyBRL(impact.pendingCents)} a receber</li>}
            </ul>
          </div>
        )}
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
