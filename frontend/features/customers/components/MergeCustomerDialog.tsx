'use client';

import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { CustomerListItemResponse, CustomerResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { displayDocument, displayPhone } from '../format-customer';
import { useCustomersList, useMergeCustomers } from '../hooks/use-customers';

// Brings a duplicate registration into this customer. Two steps on purpose: pick it, then confirm what will happen.
export function MergeCustomerDialog({ customer, open, onOpenChange, onMerged }: { customer: CustomerResponse; open: boolean; onOpenChange: (open: boolean) => void; onMerged?: () => void }) {
  const merge = useMergeCustomers();
  const [searchInput, setSearchInput] = useState('');
  const [picked, setPicked] = useState<CustomerListItemResponse>();
  const search = useDebouncedValue(searchInput.trim(), 300);
  const list = useCustomersList({ offset: 0, limit: 8, search }, { enabled: open && search.length >= 2 });
  const candidates = (list.data?.items ?? []).filter((item) => item.id !== customer.id && item.type === customer.type);

  function close(next: boolean) {
    if (merge.isPending) return;
    if (!next) { setSearchInput(''); setPicked(undefined); }
    onOpenChange(next);
  }

  function confirm() {
    if (!picked) return;
    merge.mutate({ keepId: customer.id, mergeId: picked.id }, {
      onSuccess: (result) => {
        toast.success(`Cadastros unidos: ${result.movedVehicles} ${result.movedVehicles === 1 ? 'veículo' : 'veículos'} e ${result.movedServiceOrders} ${result.movedServiceOrders === 1 ? 'OS passaram' : 'OS passaram'} para ${customer.name}.`);
        close(false);
        onMerged?.();
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Juntar com outro cadastro</DialogTitle>
        <DialogDescription>Escolha o cadastro duplicado. Veículos, ordens de serviço, agendamentos, mensagens e lançamentos dele passam para <strong>{customer.name}</strong>, e o duplicado é arquivado.</DialogDescription>
      </DialogHeader>
      {!picked ? <div className="space-y-3">
        <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" /><Input aria-label="Buscar o cadastro duplicado" className="pl-9" autoFocus placeholder="Nome, telefone ou documento do duplicado" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
        <ul className="divide-y divide-border rounded-card border border-border">
          {candidates.map((item) => <li key={item.id}><button type="button" className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-muted" onClick={() => setPicked(item)}><span className="font-semibold text-text">{item.name}</span><span className="text-xs text-text-muted">{[item.document ? displayDocument(item.document) : undefined, displayPhone(item.phone)].filter(Boolean).join(' · ')}</span></button></li>)}
          {search.length >= 2 && !list.isLoading && candidates.length === 0 && <li className="px-4 py-3 text-sm text-text-muted">Nenhum outro cliente do mesmo tipo encontrado.</li>}
          {search.length < 2 && <li className="px-4 py-3 text-sm text-text-muted">Digite pelo menos 2 letras ou números.</li>}
        </ul>
      </div> : <div className="space-y-3 text-sm">
        <div role="alert" className="rounded-button border border-warning/30 bg-warning-subtle p-3">
          <p>O cadastro <strong>{picked.name}</strong> será arquivado e tudo dele passa para <strong>{customer.name}</strong>. O que faltar no cadastro mantido (e-mail, nascimento, endereço, documento) é completado com os dados do duplicado.</p>
          <p className="mt-2">A autorização de lembretes não é copiada: ela vale para o cadastro em que foi dada.</p>
        </div>
        <p className="text-text-muted">Para desfazer, só movendo cada item de volta. Confirme apenas se for a mesma pessoa.</p>
      </div>}
      <DialogFooter className="gap-2">
        {picked && <Button type="button" variant="outline" disabled={merge.isPending} onClick={() => setPicked(undefined)}>Escolher outro</Button>}
        <Button type="button" variant="outline" disabled={merge.isPending} onClick={() => close(false)}>Cancelar</Button>
        {picked && <Button type="button" variant="destructive" disabled={merge.isPending} onClick={confirm}>{merge.isPending ? 'Juntando...' : 'Juntar cadastros'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
