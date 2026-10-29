'use client';

import { useEffect, useId, useState } from 'react';
import { CARE_CAMPAIGN_KEYS, CATALOG_ITEM_TYPE_LABELS, CATALOG_ITEM_TYPES, CATALOG_UNITS, DEFAULT_CARE_CAMPAIGNS, type CareServiceKey, type CatalogItemResponse, type CatalogItemType, type CatalogUnit } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasPermission } from '@/features/auth/permissions';
import { useSuppliers } from '@/features/financial/hooks/use-financial';
import { useLaborRate } from '@/features/settings/hooks/use-settings';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { parseMoneyToCents } from '@/lib/parse-money';
import { useAuthStore } from '@/stores/auth-store';
import { useCreateCatalogItem, useUpdateCatalogItem } from '../hooks/use-catalog';
import { marginPercent, priceFromMinutes } from '../catalog-pricing';

interface CatalogItemFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CatalogItemResponse;
  defaultType?: CatalogItemType;
  /** Categories already in use, offered as suggestions so "Freios" is not typed three different ways. */
  categories?: string[];
}

const CARE_OPTIONS = CARE_CAMPAIGN_KEYS.filter((key): key is CareServiceKey => key !== 'BIRTHDAY');
const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm';
const toText = (cents?: number) => (cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ','));

export function CatalogItemFormModal({ open, onOpenChange, item, defaultType = 'PART', categories = [] }: CatalogItemFormModalProps) {
  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const id = useId();
  const user = useAuthStore((state) => state.user);
  const canSeeCost = hasPermission(user, 'finance.view');
  const suppliers = useSuppliers(canSeeCost);
  const laborRate = useLaborRate();
  const [values, setValues] = useState({ type: defaultType as CatalogItemType, name: '', category: '', price: '', cost: '', code: '', brand: '', unit: 'un' as CatalogUnit, supplierId: '', minutes: '', care: '', trackStock: false, minStock: '' });
  const pending = create.isPending || update.isPending;
  const service = values.type === 'LABOR';
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues(previous => ({ ...previous, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setValues({
      type: item?.type ?? defaultType, name: item?.name ?? '', category: item?.category ?? '', price: toText(item?.unitPriceCents), cost: toText(item?.costCents),
      code: item?.code ?? '', brand: item?.brand ?? '', unit: item?.unit ?? (defaultType === 'LABOR' ? 'h' : 'un'), supplierId: item?.supplierId ?? '',
      minutes: item?.standardMinutes ? String(item.standardMinutes) : '', care: item?.careServiceKey ?? '',
      trackStock: item?.trackStock ?? false, minStock: item?.minStock === undefined ? '' : String(item.minStock).replace('.', ','),
    });
  }, [open, item, defaultType]);

  const priceCents = values.price.trim() === '' ? 0 : parseMoneyToCents(values.price);
  const costCents = values.cost.trim() === '' ? undefined : parseMoneyToCents(values.cost);
  const margin = !Number.isNaN(priceCents) && costCents !== undefined && !Number.isNaN(costCents) ? marginPercent(priceCents, costCents) : null;
  const suggested = service ? priceFromMinutes(laborRate, Number(values.minutes)) : null;

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!values.name.trim()) return toast.error('Informe o nome do item.');
    if (Number.isNaN(priceCents)) return toast.error('Informe um preço válido, como 12,50 ou 1.234,56.');
    if (costCents !== undefined && Number.isNaN(costCents)) return toast.error('Informe um custo válido, como 12,50 ou 1.234,56.');
    const minutes = values.minutes.trim() === '' ? null : Number(values.minutes);
    if (service && minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) return toast.error('Informe o tempo padrão em minutos, de 1 a 1440.');
    const minStock = values.minStock.trim() === '' ? null : Number(values.minStock.replace(',', '.'));
    if (!service && values.trackStock && minStock !== null && (!Number.isFinite(minStock) || minStock < 0 || Math.abs(Math.round(minStock * 100) / 100 - minStock) > 1e-9)) return toast.error('Informe o estoque mínimo com até duas casas decimais.');
    const request = {
      type: values.type, name: values.name.trim(), category: values.category.trim() || undefined, unitPriceCents: priceCents,
      code: values.code.trim() || undefined, brand: values.brand.trim() || undefined, unit: values.unit,
      ...(canSeeCost ? { costCents: costCents ?? null, supplierId: values.supplierId || null } : {}),
      ...(!service ? { trackStock: values.trackStock, minStock: values.trackStock ? minStock : null } : {}),
      ...(service ? { standardMinutes: minutes, careServiceKey: (values.care || null) as CareServiceKey | null } : {}),
    };
    const options = {
      onSuccess: () => { toast.success('Item salvo no catálogo.'); onOpenChange(false); },
      onError: (error: unknown) => toast.error(extractErrorMessage(error)),
    };
    if (item) update.mutate({ id: item.id, ...request }, options);
    else create.mutate(request, options);
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{item ? 'Editar item do catálogo' : 'Novo item do catálogo'}</DialogTitle>
        <DialogDescription>O preço serve de sugestão: ele pode ser ajustado ao lançar o item em cada ordem de serviço.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-type`}>Tipo</Label>
            <select id={`${id}-type`} className={selectClass} value={values.type} onChange={event => { const type = event.target.value as CatalogItemType; setValues(previous => ({ ...previous, type, unit: type === 'LABOR' ? 'h' : previous.unit === 'h' ? 'un' : previous.unit })); }}>
              {CATALOG_ITEM_TYPES.map(type => <option key={type} value={type}>{CATALOG_ITEM_TYPE_LABELS[type]}</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor={`${id}-category`}>Categoria (opcional)</Label><Input id={`${id}-category`} list={`${id}-categories`} maxLength={60} value={values.category} onChange={event => set('category', event.target.value)} placeholder="Ex.: Freios" /><datalist id={`${id}-categories`}>{categories.map(category => <option key={category} value={category} />)}</datalist></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-name`}>Nome</Label><Input id={`${id}-name`} value={values.name} onChange={event => set('name', event.target.value)} placeholder="Ex.: Pastilha de freio dianteira" /></div>
          {!service && <><div className="space-y-2"><Label htmlFor={`${id}-code`}>Código (opcional)</Label><Input id={`${id}-code`} maxLength={40} value={values.code} onChange={event => set('code', event.target.value)} placeholder="Referência ou código de barras" /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-brand`}>Marca (opcional)</Label><Input id={`${id}-brand`} maxLength={60} value={values.brand} onChange={event => set('brand', event.target.value)} placeholder="Ex.: Cobreq" /></div></>}
          <div className="space-y-2"><Label htmlFor={`${id}-unit`}>Unidade</Label><select id={`${id}-unit`} className={selectClass} value={values.unit} onChange={event => set('unit', event.target.value as CatalogUnit)}>{CATALOG_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
          {service && <div className="space-y-2"><Label htmlFor={`${id}-minutes`}>Tempo padrão (minutos)</Label><Input id={`${id}-minutes`} type="number" min={1} max={1440} inputMode="numeric" value={values.minutes} onChange={event => set('minutes', event.target.value)} placeholder="Ex.: 60" /></div>}
          <div className="space-y-2"><Label htmlFor={`${id}-price`}>Preço padrão (R$)</Label><Input id={`${id}-price`} inputMode="decimal" value={values.price} onChange={event => set('price', event.target.value)} placeholder="0,00" />
            {suggested !== null && <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => set('price', toText(suggested))}>Calcular pelo tempo: {formatCurrencyBRL(suggested)} ({values.minutes} min × {formatCurrencyBRL(laborRate ?? 0)}/h)</button>}
            {service && laborRate === null && <p className="text-xs text-text-muted">Defina o valor da hora na tela do catálogo para calcular o preço pelo tempo.</p>}</div>
          {canSeeCost && <div className="space-y-2"><Label htmlFor={`${id}-cost`}>Custo (R$)</Label><Input id={`${id}-cost`} inputMode="decimal" value={values.cost} onChange={event => set('cost', event.target.value)} placeholder="Quanto custa para a oficina" />
            {margin !== null && <p className={`text-xs font-semibold ${margin < 0 ? 'text-danger' : 'text-success'}`}>Margem: {margin}% · lucro de {formatCurrencyBRL(priceCents - (costCents ?? 0))}</p>}</div>}
          {canSeeCost && !service && <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-supplier`}>Fornecedor (opcional)</Label><select id={`${id}-supplier`} className={selectClass} value={values.supplierId} onChange={event => set('supplierId', event.target.value)}><option value="">Sem fornecedor definido</option>{suppliers.data?.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>}
          {!service && <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={values.trackStock} onChange={event => set('trackStock', event.target.checked)} className="size-4" />Controlar estoque deste item</label>
            {values.trackStock && <div className="space-y-2"><Label htmlFor={`${id}-min`}>Avisar quando chegar a (estoque mínimo)</Label><Input id={`${id}-min`} inputMode="decimal" value={values.minStock} onChange={event => set('minStock', event.target.value)} placeholder="Ex.: 4" /><p className="text-xs text-text-muted">O saldo muda com as entradas que você lança e sai sozinho quando a OS é entregue. {item ? '' : 'Depois de salvar, lance a primeira entrada pela linha do item.'}</p></div>}
          </div>}
          {service && <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-care`}>Programa o próximo cuidado (opcional)</Label><select id={`${id}-care`} className={selectClass} value={values.care} onChange={event => set('care', event.target.value)}><option value="">Nenhum</option>{CARE_OPTIONS.map(key => <option key={key} value={key}>{DEFAULT_CARE_CAMPAIGNS.find(campaign => campaign.key === key)?.name ?? key}</option>)}</select><p className="text-xs text-text-muted">Ao lançar este serviço numa OS, o retorno já vem marcado para o Cuidado com o cliente avisar.</p></div>}
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar item'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
