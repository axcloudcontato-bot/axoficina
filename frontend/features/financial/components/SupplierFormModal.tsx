'use client';

import { useEffect, useId, useState } from 'react';
import type { SupplierResponse } from '@oficina/contracts';
import { Buildings } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { useCreateSupplier, useUpdateSupplier } from '../hooks/use-financial';

interface SupplierFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierResponse;
  onCreated?: (supplier: SupplierResponse) => void;
}

export function SupplierFormModal({ open, onOpenChange, supplier, onCreated }: SupplierFormModalProps) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const id = useId();
  const [values, setValues] = useState({ name: '', document: '', contactName: '', phone: '', email: '', paymentTerms: '', notes: '' });
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) setValues({ name: supplier?.name ?? '', document: supplier?.document ?? '', contactName: supplier?.contactName ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', paymentTerms: supplier?.paymentTerms ?? '', notes: supplier?.notes ?? '' });
  }, [open, supplier]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!values.name.trim()) return toast.error('Informe o nome do fornecedor.');
    const request = { ...values, name: values.name.trim() };
    const options = {
      onSuccess: (result: { supplier: SupplierResponse }) => {
        if (!supplier) onCreated?.(result.supplier);
        toast.success('Fornecedor salvo.');
        onOpenChange(false);
      },
      onError: (error: unknown) => toast.error(extractErrorMessage(error)),
    };
    if (supplier) update.mutate({ id: supplier.id, ...request }, options);
    else create.mutate(request, options);
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><Buildings className="size-[18px]" aria-hidden="true" /></span>{supplier ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
        <DialogDescription>Preencha os dados do fornecedor. Apenas o nome é obrigatório.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {([['name', 'Nome ou razão social'], ['document', 'CPF/CNPJ'], ['contactName', 'Pessoa de contato'], ['phone', 'Telefone'], ['email', 'E-mail'], ['paymentTerms', 'Condição de pagamento']] as const).map(([field, label]) => <div key={field} className="min-w-0 space-y-2">
            <Label htmlFor={`${id}-${field}`}>{label}</Label>
            <Input id={`${id}-${field}`} value={values[field]} onChange={event => setValues(previous => ({ ...previous, [field]: event.target.value }))} type={field === 'email' ? 'email' : 'text'} placeholder={field === 'paymentTerms' ? 'Ex.: 28 dias' : undefined} />
          </div>)}
          <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-notes`}>Observações</Label><Textarea id={`${id}-notes`} value={values.notes} onChange={event => setValues(previous => ({ ...previous, notes: event.target.value }))} /></div>
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar fornecedor'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
