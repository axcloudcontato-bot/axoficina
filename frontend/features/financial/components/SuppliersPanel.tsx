'use client';

import { useState } from 'react';
import type { SupplierResponse } from '@oficina/contracts';
import { Factory, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { useDeleteSupplier, useSuppliers } from '../hooks/use-financial';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/features/auth/permissions';

import { SupplierFormModal } from './SupplierFormModal';

export function SuppliersPanel() {
  const query = useSuppliers(); const remove = useDeleteSupplier();
  const canManage = hasPermission(useAuthStore(state => state.user), 'finance.manage');
  const [editing, setEditing] = useState<SupplierResponse | null | undefined>(undefined);
  return <div className="space-y-5"><header className="flex items-end justify-between border-b border-border pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Rede de fornecimento</p><h2 className="mt-1 text-2xl font-bold">Fornecedores</h2><p className="mt-1 text-sm text-text-muted">Cadastre empresas e profissionais vinculados às contas a pagar.</p></div>{canManage && <Button onClick={() => setEditing(null)}><Plus className="size-4" />Novo fornecedor</Button>}</header>{query.isLoading && <p role="status" className="p-8">Carregando fornecedores…</p>}{query.isError && <div role="alert" className="rounded-card border border-danger/30 p-6">Não foi possível carregar os fornecedores. <Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>}<section className="overflow-hidden rounded-card border border-border bg-card shadow-sm">{query.data?.suppliers.map(supplier => <div key={supplier.id} className="flex items-center justify-between gap-4 border-b border-border px-5 py-4"><div className="flex min-w-0 items-center gap-3"><Factory className="size-5 text-primary" /><div><p className="font-bold">{supplier.name}</p><p className="text-xs text-text-muted">{supplier.document || 'Documento não informado'}{supplier.phone ? ` · ${supplier.phone}` : ''}</p></div></div>{canManage && <div className="flex"><Button variant="ghost" size="icon" onClick={() => setEditing(supplier)} aria-label={`Editar ${supplier.name}`}><PencilSimple className="size-4" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => window.confirm(`Excluir ${supplier.name}?`) && remove.mutate(supplier.id, { onSuccess: () => toast.success('Fornecedor excluído.'), onError: error => toast.error(extractErrorMessage(error)) })} aria-label={`Excluir ${supplier.name}`}><Trash className="size-4" /></Button></div>}</div>)}{query.isSuccess && !query.data.suppliers.length && <p className="p-10 text-center text-sm text-text-muted">Nenhum fornecedor cadastrado.</p>}</section><SupplierFormModal open={editing !== undefined} supplier={editing ?? undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} /></div>;
}
