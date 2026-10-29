'use client';

import { useId, useState } from 'react';
import type { CustomerListItemResponse, FinancialEntryType, SupplierResponse } from '@oficina/contracts';
import { Plus, Receipt } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { useCustomersList } from '@/features/customers/hooks/use-customers';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { parseMoneyToCents } from '@/lib/parse-money';
import { extractErrorMessage } from '@/lib/api/client';
import { useCreateFinancialEntry, useFinancialCategories, useSuppliers } from '../hooks/use-financial';
import { SupplierFormModal } from './SupplierFormModal';

interface FinancialEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: NonNullable<ReturnType<typeof useFinancialCategories>['data']>['categories'];
  initialType: FinancialEntryType;
  lockType: boolean;
}

export function FinancialEntryDialog({ open, onOpenChange, categories, initialType, lockType }: FinancialEntryDialogProps) {
  const id = useId();
  const user = useAuthStore(state => state.user);
  const canCreateCustomer = hasPermission(user, 'customers.manage');
  const canCreateSupplier = hasPermission(user, 'finance.manage');
  const create = useCreateFinancialEntry();
  const suppliers = useSuppliers();
  const [type, setType] = useState<FinancialEntryType>(initialType);
  const customers = useCustomersList({ offset: 0, limit: 100 }, { enabled: open && type === 'INCOME' });
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueAt, setDueAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [notes, setNotes] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [createdSuppliers, setCreatedSuppliers] = useState<SupplierResponse[]>([]);
  const [createdCustomers, setCreatedCustomers] = useState<CustomerListItemResponse[]>([]);
  // Keep new records selectable while the lists refresh, including customers
  // outside the first page of the existing selector.
  const supplierOptions = Array.from(new Map([...(suppliers.data?.suppliers ?? []), ...createdSuppliers].map(item => [item.id, item])).values()).filter(item => item.status === 'ACTIVE');
  const customerOptions = Array.from(new Map([...(customers.data?.items ?? []), ...createdCustomers].map(item => [item.id, item])).values());

  // Ignore the native Select form bridge's empty event when new options mount.
  // A nature change clears the selections explicitly.
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    const amountCents = parseMoneyToCents(amount);
    if (!categoryId || !description.trim() || !Number.isFinite(amountCents) || amountCents <= 0 || !dueAt) return toast.error('Preencha categoria, descrição, valor e vencimento.');
    if (type === 'EXPENSE' && !supplierId) return toast.error('Selecione o fornecedor.');
    if (type === 'INCOME' && !customerId) return toast.error('Selecione o cliente.');
    create.mutate({ categoryId, supplierId: type === 'EXPENSE' ? supplierId : undefined, customerId: type === 'INCOME' ? customerId : undefined, type, description, amountCents, dueAt: new Date(`${dueAt}T12:00:00`).toISOString(), status, notes: notes || undefined }, {
      onSuccess: () => { toast.success('Lançamento criado.'); onOpenChange(false); },
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={open} onOpenChange={next => { if (!supplierOpen && !customerOpen && !create.isPending) onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><Receipt className="size-[18px]" aria-hidden="true" /></span>Novo lançamento</DialogTitle><DialogDescription>Registre uma receita ou despesa e vincule o cliente ou fornecedor.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Natureza" id={`${id}-type`}><Select value={type} disabled={lockType} onValueChange={value => { if (!lockType) { setType(value as FinancialEntryType); setCategoryId(''); setSupplierId(''); setCustomerId(''); } }}><SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCOME">Receita</SelectItem><SelectItem value="EXPENSE">Despesa</SelectItem></SelectContent></Select></Field>
          <Field label="Categoria" id={`${id}-category`}><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger id={`${id}-category`}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categories.filter(item => item.type === type).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
          {type === 'EXPENSE' && <div className="sm:col-span-2">
            <Field label="Fornecedor" id={`${id}-supplier`}><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><Select value={supplierId} onValueChange={value => { if (value) setSupplierId(value); }}><SelectTrigger id={`${id}-supplier`}><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger><SelectContent>{supplierOptions.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Cadastrar novo fornecedor" title={canCreateSupplier ? 'Cadastrar novo fornecedor' : 'Sem permissão para cadastrar fornecedores'} disabled={!canCreateSupplier || create.isPending} onClick={() => setSupplierOpen(true)}><Plus className="size-4" aria-hidden="true" /></Button></div></Field>
            {!suppliers.isLoading && !supplierOptions.length && <p className="mt-1 text-xs text-text-muted">Nenhum fornecedor cadastrado.{canCreateSupplier ? ' Use o botão + para cadastrar sem sair do lançamento.' : ''}</p>}
          </div>}
          {type === 'INCOME' && <div className="sm:col-span-2">
            <Field label="Cliente" id={`${id}-customer`}><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><Select value={customerId} onValueChange={value => { if (value) setCustomerId(value); }}><SelectTrigger id={`${id}-customer`}><SelectValue placeholder="Selecione o cliente" /></SelectTrigger><SelectContent>{customerOptions.map(item => <SelectItem key={item.id} value={item.id}>{item.name}{item.document ? ` · ${item.document}` : ''}</SelectItem>)}</SelectContent></Select></div><Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Cadastrar novo cliente" title={canCreateCustomer ? 'Cadastrar novo cliente' : 'Sem permissão para cadastrar clientes'} disabled={!canCreateCustomer || create.isPending} onClick={() => setCustomerOpen(true)}><Plus className="size-4" aria-hidden="true" /></Button></div></Field>
            {!customers.isLoading && !customerOptions.length && <p className="mt-1 text-xs text-text-muted">Nenhum cliente cadastrado.{canCreateCustomer ? ' Use o botão + para cadastrar sem sair do lançamento.' : ''}</p>}
          </div>}
          <Field label="Descrição" id={`${id}-description`}><Input id={`${id}-description`} value={description} onChange={event => setDescription(event.target.value)} /></Field>
          <Field label="Valor" id={`${id}-amount`}><Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
          <Field label="Vencimento" id={`${id}-due`}><Input id={`${id}-due`} type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} /></Field>
          <Field label="Situação" id={`${id}-status`}><Select value={status} onValueChange={value => setStatus(value as 'PENDING' | 'PAID')}><SelectTrigger id={`${id}-status`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDING">Previsto</SelectItem><SelectItem value="PAID">Realizado</SelectItem></SelectContent></Select></Field>
          <div className="sm:col-span-2"><Field label="Observação" id={`${id}-notes`}><Textarea id={`${id}-notes`} value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
        </div>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Salvando...' : 'Salvar lançamento'}</Button></DialogFooter>
      </form>
    </DialogContent>
    <SupplierFormModal open={supplierOpen} onOpenChange={setSupplierOpen} onCreated={supplier => { setCreatedSuppliers(previous => [...previous, supplier]); setSupplierId(supplier.id); }} />
    <CustomerFormModal open={customerOpen} onOpenChange={setCustomerOpen} onCreated={customer => { setCreatedCustomers(previous => [...previous, customer]); setCustomerId(customer.id); }} />
  </Dialog>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
