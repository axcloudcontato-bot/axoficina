'use client';

import { useEffect, useId, useState } from 'react';
import type { CatalogItemResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/api/client';
import { formatStock } from '../catalog-stock';
import { useAdjustStock } from '../hooks/use-catalog';

const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm';

// Stock moves in two ways here: goods arriving (entrada) and a physical count (contagem).
// Sales leave on their own when the order is delivered.
export function StockDialog({ item, onClose }: { item?: CatalogItemResponse; onClose: () => void }) {
  const adjust = useAdjustStock();
  const id = useId();
  const [kind, setKind] = useState<'PURCHASE' | 'ADJUSTMENT'>('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { if (item) { setKind('PURCHASE'); setQuantity(''); setNote(''); } }, [item]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!item || adjust.isPending) return;
    const amount = Number(quantity.replace(',', '.'));
    if (quantity.trim() === '' || !Number.isFinite(amount) || amount < 0 || Math.abs(Math.round(amount * 100) / 100 - amount) > 1e-9) return void toast.error('Informe a quantidade com até duas casas decimais.');
    if (kind === 'PURCHASE' && amount === 0) return void toast.error('Informe uma quantidade maior que zero para a entrada.');
    adjust.mutate({ id: item.id, kind, quantity: amount, note: note.trim() || undefined }, {
      onSuccess: () => { toast.success(kind === 'PURCHASE' ? 'Entrada lançada no estoque.' : 'Contagem registrada.'); onClose(); },
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={Boolean(item)} onOpenChange={open => { if (!open && !adjust.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Estoque de {item?.name}</DialogTitle>
        <DialogDescription>Saldo atual: {item ? `${formatStock(item.stockQuantity)} ${item.unit}` : ''}. A venda sai sozinha do estoque quando a OS é entregue.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={adjust.isPending} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${id}-kind`}>Movimento</Label><select id={`${id}-kind`} className={selectClass} value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="PURCHASE">Entrada de compra (soma ao saldo)</option><option value="ADJUSTMENT">Contagem (define o saldo)</option></select></div>
          <div className="space-y-2"><Label htmlFor={`${id}-qty`}>{kind === 'PURCHASE' ? 'Quantidade que chegou' : 'Quantidade contada'}</Label><Input id={`${id}-qty`} inputMode="decimal" autoFocus value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0" /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-note`}>Observação (opcional)</Label><Input id={`${id}-note`} maxLength={200} value={note} onChange={event => setNote(event.target.value)} placeholder="Ex.: NF 1234 ou inventário de outubro" /></div>
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={adjust.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={adjust.isPending}>{adjust.isPending ? 'Salvando...' : 'Lançar'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
