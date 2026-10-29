'use client';

import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { CustomerListItemResponse, VehicleResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { displayDocument, displayPhone } from '@/features/customers/format-customer';
import { useCustomersList } from '@/features/customers/hooks/use-customers';
import { extractErrorMessage } from '@/lib/api/client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTransferVehicle } from '../hooks/use-vehicles';

// The car was sold: it passes to another customer. Two steps on purpose: pick who, then confirm what happens.
export function TransferVehicleDialog({ vehicle, open, onOpenChange }: { vehicle: VehicleResponse; open: boolean; onOpenChange: (open: boolean) => void }) {
  const transfer = useTransferVehicle();
  const [searchInput, setSearchInput] = useState('');
  const [picked, setPicked] = useState<CustomerListItemResponse>();
  const search = useDebouncedValue(searchInput.trim(), 300);
  const list = useCustomersList({ offset: 0, limit: 8, search }, { enabled: open && search.length >= 2 });
  const candidates = (list.data?.items ?? []).filter((customer) => customer.id !== vehicle.customerId);

  function close(next: boolean) {
    if (transfer.isPending) return;
    if (!next) { setSearchInput(''); setPicked(undefined); }
    onOpenChange(next);
  }

  function confirm() {
    if (!picked) return;
    transfer.mutate({ id: vehicle.id, customerId: picked.id }, {
      onSuccess: () => { toast.success(`O veículo ${vehicle.plate} passou para ${picked.name}.`); close(false); },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Transferir para outro dono</DialogTitle>
        <DialogDescription>O veículo {vehicle.plate} hoje é de <strong>{vehicle.customerName}</strong>. Escolha para quem ele passa.</DialogDescription>
      </DialogHeader>
      {!picked ? <div className="space-y-3">
        <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" /><Input aria-label="Buscar o novo dono" className="pl-9" autoFocus placeholder="Nome, telefone ou documento do novo dono" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
        <ul className="divide-y divide-border rounded-card border border-border">
          {candidates.map((customer) => <li key={customer.id}><button type="button" className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-muted" onClick={() => setPicked(customer)}><span className="font-semibold text-text">{customer.name}</span><span className="text-xs text-text-muted">{[customer.document ? displayDocument(customer.document) : undefined, displayPhone(customer.phone)].filter(Boolean).join(' · ')}</span></button></li>)}
          {search.length >= 2 && !list.isLoading && candidates.length === 0 && <li className="px-4 py-3 text-sm text-text-muted">Nenhum outro cliente encontrado. Cadastre o novo dono primeiro, em Clientes.</li>}
          {search.length < 2 && <li className="px-4 py-3 text-sm text-text-muted">Digite pelo menos 2 letras ou números.</li>}
        </ul>
      </div> : <div role="alert" className="space-y-2 rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm">
        <p>O veículo passa para <strong>{picked.name}</strong>. Os agendamentos futuros e os lembretes de manutenção dele também passam para o novo dono.</p>
        <p>As ordens de serviço já feitas continuam no nome de <strong>{vehicle.customerName}</strong>, porque foram dele na época. Se houver uma OS em andamento, é preciso entregá-la ou cancelá-la antes.</p>
      </div>}
      <DialogFooter className="gap-2">
        {picked && <Button type="button" variant="outline" disabled={transfer.isPending} onClick={() => setPicked(undefined)}>Escolher outro</Button>}
        <Button type="button" variant="outline" disabled={transfer.isPending} onClick={() => close(false)}>Cancelar</Button>
        {picked && <Button type="button" disabled={transfer.isPending} onClick={confirm}>{transfer.isPending ? 'Transferindo...' : 'Transferir veículo'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
