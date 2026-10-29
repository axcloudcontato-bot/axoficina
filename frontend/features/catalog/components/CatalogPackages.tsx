'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { CatalogItemResponse, CatalogPackageResponse } from '@oficina/contracts';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useCatalogPackages, useDeleteCatalogPackage, useSaveCatalogPackage } from '../hooks/use-catalog';

const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm';
interface Line { catalogItemId: string; quantity: string }

export function packageTotalCents(pack: CatalogPackageResponse, items: CatalogItemResponse[]): number {
  return pack.items.reduce((sum, line) => sum + Math.round(line.quantity * (items.find(item => item.id === line.catalogItemId)?.unitPriceCents ?? 0)), 0);
}

export function CatalogPackages({ items }: { items: CatalogItemResponse[] }) {
  const query = useCatalogPackages();
  const remove = useDeleteCatalogPackage();
  const [editing, setEditing] = useState<CatalogPackageResponse | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CatalogPackageResponse>();
  const packages = query.data?.packages ?? [];
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => { toast.success(`Pacote "${deleting.name}" excluído.`); setDeleting(undefined); },
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-text-muted">Um pacote junta vários itens que costumam sair juntos, como a revisão dos 10 mil km. Na ordem de serviço, um clique lança tudo com os preços de hoje.</p>
      <Button onClick={() => setEditing(null)}><Plus className="size-4" />Novo pacote</Button>
    </div>
    <section className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      {packages.map(pack => {
        const total = packageTotalCents(pack, items);
        return <div key={pack.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-0">
          <div className="min-w-0">
            <p className="font-semibold">{pack.name}</p>
            <p className="text-xs text-text-muted">{pack.items.map(line => `${line.quantity.toLocaleString('pt-BR')}× ${byId.get(line.catalogItemId)?.name ?? 'item removido'}`).join(' · ')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums">{formatCurrencyBRL(total)}</span>
            <Button variant="ghost" size="icon" aria-label={`Editar pacote ${pack.name}`} onClick={() => setEditing(pack)}><PencilSimple className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="text-danger" aria-label={`Excluir pacote ${pack.name}`} onClick={() => setDeleting(pack)}><Trash className="size-4" /></Button>
          </div>
        </div>;
      })}
      {!query.isLoading && packages.length === 0 && <p className="p-10 text-center text-sm text-text-muted">Nenhum pacote ainda. Crie o primeiro, por exemplo "Revisão básica".</p>}
    </section>
    <PackageForm open={editing !== undefined} pack={editing ?? undefined} items={items} onOpenChange={open => { if (!open) setEditing(undefined); }} />
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !remove.isPending) setDeleting(undefined); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir pacote</DialogTitle><DialogDescription>"{deleting?.name}" deixa de aparecer na ordem de serviço. Os itens do catálogo e as OS já lançadas não mudam.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(undefined)}>Voltar</Button><Button variant="destructive" disabled={remove.isPending} onClick={confirmDelete}>{remove.isPending ? 'Excluindo...' : 'Excluir'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function PackageForm({ open, pack, items, onOpenChange }: { open: boolean; pack?: CatalogPackageResponse; items: CatalogItemResponse[]; onOpenChange: (open: boolean) => void }) {
  const save = useSaveCatalogPackage();
  const id = useId();
  const [name, setName] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(pack?.name ?? '');
    setLines(pack?.items.map(line => ({ catalogItemId: line.catalogItemId, quantity: String(line.quantity).replace('.', ',') })) ?? [{ catalogItemId: '', quantity: '1' }]);
  }, [open, pack]);

  const setLine = (index: number, patch: Partial<Line>) => setLines(current => current.map((line, position) => position === index ? { ...line, ...patch } : line));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    if (!name.trim()) return void toast.error('Informe o nome do pacote.');
    const filled = lines.filter(line => line.catalogItemId);
    if (filled.length === 0) return void toast.error('Escolha pelo menos um item.');
    const parsed = filled.map(line => ({ catalogItemId: line.catalogItemId, quantity: Number(line.quantity.replace(',', '.')) }));
    if (parsed.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 || Math.abs(Math.round(line.quantity * 100) / 100 - line.quantity) > 1e-9)) return void toast.error('Informe quantidades maiores que zero, com até duas casas decimais.');
    save.mutate({ id: pack?.id, name: name.trim(), items: parsed }, {
      onSuccess: () => { toast.success('Pacote salvo.'); onOpenChange(false); },
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={open} onOpenChange={next => { if (!save.isPending) onOpenChange(next); }}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{pack ? 'Editar pacote' : 'Novo pacote'}</DialogTitle><DialogDescription>Os preços vêm do catálogo no momento em que o pacote é lançado na ordem de serviço.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={save.isPending} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${id}-name`}>Nome do pacote</Label><Input id={`${id}-name`} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Revisão básica" /></div>
          <div className="space-y-2">
            <Label>Itens</Label>
            {lines.map((line, index) => <div key={index} className="flex items-center gap-2">
              <select aria-label={`Item ${index + 1}`} className={selectClass} value={line.catalogItemId} onChange={event => setLine(index, { catalogItemId: event.target.value })}>
                <option value="">Escolha um item</option>
                {items.map(item => <option key={item.id} value={item.id}>{item.name}{item.unitPriceCents > 0 ? ` · ${formatCurrencyBRL(item.unitPriceCents)}` : ' · sem preço'}</option>)}
              </select>
              <Input aria-label={`Quantidade do item ${index + 1}`} inputMode="decimal" className="w-24 text-right" value={line.quantity} onChange={event => setLine(index, { quantity: event.target.value })} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover item ${index + 1}`} className="text-danger" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, position) => position !== index))}><Trash className="size-4" /></Button>
            </div>)}
            <Button type="button" variant="outline" size="sm" disabled={lines.length >= 30} onClick={() => setLines(current => [...current, { catalogItemId: '', quantity: '1' }])}><Plus className="size-4" />Adicionar item</Button>
          </div>
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar pacote'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
