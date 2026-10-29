'use client';

import { useEffect, useId, useState } from 'react';
import { CATALOG_ITEM_TYPE_LABELS, CATALOG_ITEM_TYPES, type CatalogItemResponse, type CatalogItemType } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/api/client';
import { useCreateCatalogItem, useUpdateCatalogItem } from '../hooks/use-catalog';

interface CatalogItemFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CatalogItemResponse;
  defaultType?: CatalogItemType;
}

export function CatalogItemFormModal({ open, onOpenChange, item, defaultType = 'PART' }: CatalogItemFormModalProps) {
  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const id = useId();
  const [values, setValues] = useState({ type: defaultType as CatalogItemType, name: '', category: '', price: '' });
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) setValues({ type: item?.type ?? defaultType, name: item?.name ?? '', category: item?.category ?? '', price: item ? (item.unitPriceCents / 100).toFixed(2).replace('.', ',') : '' });
  }, [open, item, defaultType]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!values.name.trim()) return toast.error('Informe o nome do item.');
    const unitPriceCents = values.price.trim() === '' ? 0 : Math.round(Number(values.price.replace(/\./g, '').replace(',', '.')) * 100);
    if (Number.isNaN(unitPriceCents) || unitPriceCents < 0) return toast.error('Informe um preço válido.');
    const request = { type: values.type, name: values.name.trim(), category: values.category.trim() || undefined, unitPriceCents };
    const options = {
      onSuccess: () => { toast.success('Item salvo no catálogo.'); onOpenChange(false); },
      onError: (error: unknown) => toast.error(extractErrorMessage(error)),
    };
    if (item) update.mutate({ id: item.id, ...request }, options);
    else create.mutate(request, options);
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{item ? 'Editar item do catálogo' : 'Novo item do catálogo'}</DialogTitle>
        <DialogDescription>O preço serve de sugestão: ele pode ser ajustado ao lançar o item em cada ordem de serviço.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-type`}>Tipo</Label>
            <select id={`${id}-type`} className="h-10 w-full rounded-button border border-input bg-background px-3 text-sm" value={values.type} onChange={event => setValues(previous => ({ ...previous, type: event.target.value as CatalogItemType }))}>
              {CATALOG_ITEM_TYPES.map(type => <option key={type} value={type}>{CATALOG_ITEM_TYPE_LABELS[type]}</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor={`${id}-category`}>Categoria (opcional)</Label><Input id={`${id}-category`} value={values.category} onChange={event => setValues(previous => ({ ...previous, category: event.target.value }))} placeholder="Ex.: Freios" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-name`}>Nome</Label><Input id={`${id}-name`} value={values.name} onChange={event => setValues(previous => ({ ...previous, name: event.target.value }))} placeholder="Ex.: Pastilha de freio dianteira" /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-price`}>Preço padrão (R$)</Label><Input id={`${id}-price`} inputMode="decimal" value={values.price} onChange={event => setValues(previous => ({ ...previous, price: event.target.value }))} placeholder="0,00" /></div>
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar item'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
