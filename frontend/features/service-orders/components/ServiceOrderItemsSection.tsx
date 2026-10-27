'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_CARE_CAMPAIGNS, type CareServiceKey, type ServiceOrderItemResponse, type ServiceOrderItemType, type ServiceOrderResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { extractErrorMessage } from '@/lib/api/client';
import { useAddServiceOrderItem, useDeleteServiceOrderItem, useUpdateServiceOrderItem } from '../hooks/use-service-order-items';

const ITEM_TYPE_LABELS: Record<ServiceOrderItemType, string> = {
  PART: 'Peça',
  LABOR: 'Mão de obra',
};

interface ServiceOrderItemsSectionProps {
  serviceOrder: ServiceOrderResponse;
  readOnly?: boolean;
}

interface ItemForm {
  careServiceKey: CareServiceKey | '';
  type: ServiceOrderItemType;
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_FORM: ItemForm = { type: 'PART', description: '', quantity: '1', unitPrice: '', careServiceKey: '' };

function toEditForm(item: ServiceOrderItemResponse): ItemForm {
  return {
    careServiceKey: item.careServiceKey ?? '',
    type: item.type,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: (item.unitPriceCents / 100).toFixed(2),
  };
}

// "" (campo em branco) é tratado como inválido, diferente de "0" digitado
// explicitamente (item de cortesia, valor unitário zero é permitido pela spec).
function parseUnitPriceCents(raw: string): number {
  if (raw.trim() === '') {
    return NaN;
  }
  return Math.round(Number(raw.replace(',', '.')) * 100);
}

function isValidForm(form: ItemForm): boolean {
  const quantity = Number(form.quantity.replace(',', '.'));
  const unitPriceCents = parseUnitPriceCents(form.unitPrice);
  return Boolean(form.description.trim()) && quantity > 0 && !Number.isNaN(unitPriceCents) && unitPriceCents >= 0;
}

// Sem trava por status da OS (spec: itens editáveis em qualquer status,
// incluindo DELIVERED/CANCELLED) — este componente não checa serviceOrder.status.
export function ServiceOrderItemsSection({ serviceOrder, readOnly = false }: ServiceOrderItemsSectionProps) {
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemForm>(EMPTY_FORM);
  const addItem = useAddServiceOrderItem();
  const updateItem = useUpdateServiceOrderItem(serviceOrder.id);
  const deleteItem = useDeleteServiceOrderItem(serviceOrder.id);

  const items = serviceOrder.items ?? [];
  const careLocked = ['DELIVERED', 'CANCELLED'].includes(serviceOrder.status);

  function handleAdd() {
    if (!isValidForm(form)) {
      toast.error('Preencha descrição, quantidade e valor válidos.');
      return;
    }
    const quantity = Number(form.quantity.replace(',', '.'));
    const unitPriceCents = parseUnitPriceCents(form.unitPrice);
    addItem.mutate(
      { serviceOrderId: serviceOrder.id, type: form.type, description: form.description.trim(), quantity, unitPriceCents, ...(!careLocked && form.careServiceKey ? { careServiceKey: form.careServiceKey } : {}) },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          toast.success('Item adicionado.');
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  function startEdit(item: ServiceOrderItemResponse) {
    setEditingId(item.id);
    setEditForm(toEditForm(item));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  function handleSaveEdit() {
    if (!editingId || !isValidForm(editForm)) {
      toast.error('Preencha descrição, quantidade e valor válidos.');
      return;
    }
    const quantity = Number(editForm.quantity.replace(',', '.'));
    const unitPriceCents = parseUnitPriceCents(editForm.unitPrice);
    updateItem.mutate(
      { id: editingId, type: editForm.type, description: editForm.description.trim(), quantity, unitPriceCents, ...(!careLocked && editForm.careServiceKey !== (items.find(item => item.id === editingId)?.careServiceKey ?? '') ? { careServiceKey: editForm.careServiceKey || null } : {}) },
      {
        onSuccess: () => {
          cancelEdit();
          toast.success('Item atualizado.');
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  function handleRemove(item: ServiceOrderItemResponse) {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => toast.success('Item removido.'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold tracking-tight text-text">Itens e valores</p>
          <p className="mt-1 text-sm text-text-muted">Peças e mão de obra que compõem o orçamento.</p>
        </div>
        <p className="text-xl font-bold text-text">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</p>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Nenhum item lançado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2 text-right">Qtd.</th>
                <th className="py-2 pr-2 text-right">Valor unit.</th>
                <th className="py-2 pr-2 text-right">Total</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                item.id === editingId ? (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2">
                      <Select value={editForm.type} onValueChange={(value) => setEditForm((prev) => ({ ...prev, type: value as ServiceOrderItemType }))}>
                        <SelectTrigger aria-label="Tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PART">Peça</SelectItem>
                          <SelectItem value="LABOR">Mão de obra</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        aria-label="Descrição"
                        value={editForm.description}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                      />
                      <label className="mt-2 block text-xs text-muted-foreground">Próximo cuidado<select className="mt-1 h-9 w-full rounded-button border border-input bg-background px-2 text-xs" disabled={careLocked} value={editForm.careServiceKey} onChange={event => setEditForm(prev => ({ ...prev, careServiceKey: event.target.value as CareServiceKey | '' }))}><option value="">Sem vínculo de manutenção</option>{DEFAULT_CARE_CAMPAIGNS.filter(item => item.key !== 'BIRTHDAY').map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <Input
                        aria-label="Quantidade"
                        className="text-right"
                        value={editForm.quantity}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <Input
                        aria-label="Valor unitário"
                        className="text-right"
                        value={editForm.unitPrice}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatCurrencyBRL(item.lineTotalCents)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" disabled={updateItem.isPending} onClick={handleSaveEdit}>
                        Salvar
                      </Button>
                      <Button variant="ghost" size="sm" disabled={updateItem.isPending} onClick={cancelEdit}>
                        Cancelar
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2">{ITEM_TYPE_LABELS[item.type]}</td>
                    <td className="py-2 pr-2">{item.description}{item.careServiceKey && <span className="mt-1 block text-xs font-semibold text-primary">💛 {DEFAULT_CARE_CAMPAIGNS.find(campaign => campaign.key === item.careServiceKey)?.name}</span>}</td>
                    <td className="py-2 pr-2 text-right">{item.quantity}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrencyBRL(item.unitPriceCents)}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatCurrencyBRL(item.lineTotalCents)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {!readOnly && <><Button variant="ghost" size="sm" disabled={editingId !== null} onClick={() => startEdit(item)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" disabled={deleteItem.isPending || editingId !== null} onClick={() => handleRemove(item)}>
                        Remover
                      </Button></>}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && <><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="space-y-1.5 text-xs font-semibold text-text-muted">Tipo<Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as ServiceOrderItemType }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PART">Peça</SelectItem>
            <SelectItem value="LABOR">Mão de obra</SelectItem>
          </SelectContent>
        </Select></label>
        <label className="space-y-1.5 text-xs font-semibold text-text-muted sm:col-span-2">Descrição<Input
          className="sm:col-span-2"
          placeholder="Descrição"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        /></label>
        <label className="space-y-1.5 text-xs font-semibold text-text-muted">Quantidade<Input placeholder="Qtd." value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} /></label>
        <label className="space-y-1.5 text-xs font-semibold text-text-muted">Valor unitário<Input
          placeholder="Valor unit. (R$)"
          value={form.unitPrice}
          onChange={(event) => setForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
        /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        {!careLocked && <label className="max-w-md flex-1 space-y-1.5 text-xs font-semibold text-muted-foreground"><span>Programar próximo cuidado ao entregar esta OS (opcional)</span><select className="h-10 w-full rounded-button border border-input bg-background px-3 text-sm text-foreground" value={form.careServiceKey} onChange={event => setForm(prev => ({ ...prev, careServiceKey: event.target.value as CareServiceKey | '' }))}><option value="">Sem vínculo de manutenção</option>{DEFAULT_CARE_CAMPAIGNS.filter(item => item.key !== 'BIRTHDAY').map(item => <option key={item.key} value={item.key}>{item.emoji} {item.name}</option>)}</select></label>}
        <Button onClick={handleAdd} disabled={addItem.isPending}>
          {addItem.isPending ? 'Adicionando...' : 'Adicionar item'}
        </Button>
      </div></>}
    </div>
  );
}
