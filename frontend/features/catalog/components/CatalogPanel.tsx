'use client';

import { useMemo, useState } from 'react';
import { CATALOG_ITEM_TYPES, type CatalogItemResponse, type CatalogItemType } from '@oficina/contracts';
import { MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { normalizeNavigationSearch } from '@/lib/navigation';
import { parseMoneyToCents } from '@/lib/parse-money';
import { useLaborRate, useUpdateLaborRate } from '@/features/settings/hooks/use-settings';
import { marginPercent } from '../catalog-pricing';
import { useCatalogItems, useDeleteCatalogItem, useSeedCatalogDefaults, useUpdateCatalogItem } from '../hooks/use-catalog';
import { CatalogItemFormModal } from './CatalogItemFormModal';

const TAB_LABELS: Record<CatalogItemType, string> = { PART: 'Peças', PRODUCT: 'Produtos', LABOR: 'Serviços' };

export function CatalogPanel() {
  const query = useCatalogItems();
  const remove = useDeleteCatalogItem();
  const update = useUpdateCatalogItem();
  const seed = useSeedCatalogDefaults();
  const [tab, setTab] = useState<CatalogItemType>('PART');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);
  const [editing, setEditing] = useState<CatalogItemResponse | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CatalogItemResponse>();
  const [pricing, setPricing] = useState<{ id: string; text: string }>();
  const laborRate = useLaborRate();
  const updateLaborRate = useUpdateLaborRate();
  const [rateText, setRateText] = useState<string>();

  const items = query.data?.items ?? [];
  const counts = useMemo(() => Object.fromEntries(CATALOG_ITEM_TYPES.map(type => [type, items.filter(item => item.type === type).length])) as Record<CatalogItemType, number>, [items]);
  const categories = useMemo(() => [...new Set(items.map(item => item.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [items]);
  const tabCategories = useMemo(() => [...new Set(items.filter(item => item.type === tab).map(item => item.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [items, tab]);
  const unpriced = items.filter(item => item.type === tab && item.unitPriceCents === 0).length;
  const visible = useMemo(() => {
    const term = normalizeNavigationSearch(search);
    return items.filter(item => item.type === tab && (category === 'ALL' || item.category === category) && (!onlyUnpriced || item.unitPriceCents === 0) && (!term || normalizeNavigationSearch(`${item.name} ${item.category ?? ''}`).includes(term)));
  }, [items, tab, search, category, onlyUnpriced]);

  function loadDefaults() {
    seed.mutate(undefined, {
      onSuccess: result => toast.success(result.created ? `${result.created} itens padrão adicionados. Ajuste os preços de cada um.` : 'Os itens padrão já estavam no catálogo.'),
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  function savePrice(item: CatalogItemResponse) {
    const text = pricing?.id === item.id ? pricing.text : '';
    setPricing(undefined);
    if (text.trim() === '') return;
    const cents = parseMoneyToCents(text);
    if (Number.isNaN(cents)) return void toast.error('Informe um preço válido, como 12,50 ou 1.234,56.');
    if (cents === item.unitPriceCents) return;
    update.mutate({ id: item.id, type: item.type, name: item.name, category: item.category, unitPriceCents: cents, code: item.code, brand: item.brand, unit: item.unit, supplierId: item.supplierId, standardMinutes: item.standardMinutes, careServiceKey: item.careServiceKey, ...(item.costCents !== undefined ? { costCents: item.costCents } : {}) }, {
      onSuccess: () => toast.success(`Preço de "${item.name}" atualizado.`),
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  function saveRate() {
    const text = rateText;
    setRateText(undefined);
    if (text === undefined) return;
    const cents = text.trim() === '' ? null : parseMoneyToCents(text);
    if (cents !== null && Number.isNaN(cents)) return void toast.error('Informe um valor válido, como 120,00.');
    if (cents === laborRate) return;
    updateLaborRate.mutate({ laborRateCents: cents }, {
      onSuccess: () => toast.success(cents === null ? 'Valor da hora removido.' : 'Valor da hora atualizado.'),
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => { toast.success(`"${deleting.name}" saiu do catálogo.`); setDeleting(undefined); },
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Orçamento mais rápido</p>
        <h2 className="mt-1 text-2xl font-bold">Peças, produtos e serviços</h2>
        <p className="mt-1 text-sm text-text-muted">Cadastre o que a oficina vende e escolha na ordem de serviço, sem digitar de novo.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={loadDefaults} disabled={seed.isPending}>{seed.isPending ? 'Carregando...' : 'Carregar itens padrão de oficina'}</Button>
        <Button onClick={() => setEditing(null)}><Plus className="size-4" />Novo item</Button>
      </div>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 text-sm">
      <span><strong>Valor da hora da oficina</strong> <span className="text-text-muted">· usado para calcular o preço dos serviços pelo tempo padrão</span></span>
      {rateText !== undefined
        ? <Input autoFocus aria-label="Valor da hora" inputMode="decimal" className="h-9 w-32 text-right" placeholder="0,00" value={rateText} onChange={event => setRateText(event.target.value)} onBlur={saveRate} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setRateText(undefined); }} />
        : <button type="button" aria-label="Alterar valor da hora" onClick={() => setRateText(laborRate === null ? '' : (laborRate / 100).toFixed(2).replace('.', ','))} className="rounded-button px-2 py-1 font-bold tabular-nums hover:bg-muted">{laborRate === null ? <span className="font-medium text-warning">Definir</span> : `${formatCurrencyBRL(laborRate)}/h`}</button>}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Tipo de item" className="flex gap-1 rounded-button bg-muted p-1">
        {CATALOG_ITEM_TYPES.map(type => <button key={type} role="tab" aria-selected={tab === type} onClick={() => { setTab(type); setCategory('ALL'); }} className={`rounded-button px-4 py-1.5 text-sm font-semibold transition-colors ${tab === type ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>{TAB_LABELS[type]} <span className="text-xs font-normal text-text-muted">{counts[type]}</span></button>)}
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {tabCategories.length > 0 && <select aria-label="Filtrar por categoria" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={category} onChange={event => setCategory(event.target.value)}><option value="ALL">Todas as categorias</option>{tabCategories.map(name => <option key={name} value={name}>{name}</option>)}</select>}
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input aria-label="Buscar no catálogo" className="pl-9" placeholder="Buscar por nome ou categoria" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
      </div>
    </div>

    {unpriced > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm"><span>{unpriced} {unpriced === 1 ? 'item sem preço' : 'itens sem preço'} em {TAB_LABELS[tab].toLowerCase()}. Clique no valor de cada linha para preencher.</span><button type="button" className="font-semibold underline" onClick={() => setOnlyUnpriced(current => !current)}>{onlyUnpriced ? 'Ver todos' : 'Mostrar só os sem preço'}</button></div>}

    <section className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      {visible.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-0">
        <div className="min-w-0">
          <p className="font-semibold">{item.name}</p>
          <p className="text-xs text-text-muted">{[item.category, item.code, item.brand, item.type === 'LABOR' ? (item.standardMinutes ? `${item.standardMinutes} min` : undefined) : `por ${item.unit}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-3">
          {item.costCents !== undefined && item.unitPriceCents > 0 && (() => { const margin = marginPercent(item.unitPriceCents, item.costCents); return margin === null ? null : <span title={`Custo ${formatCurrencyBRL(item.costCents)}`} className={`rounded-full px-2 py-0.5 text-xs font-bold ${margin < 0 ? 'bg-danger-subtle text-danger' : margin < 20 ? 'bg-warning-subtle text-warning' : 'bg-success-subtle text-success'}`}>{margin}%</span>; })()}
          {pricing?.id === item.id
            ? <Input autoFocus aria-label={`Preço de ${item.name}`} inputMode="decimal" className="h-9 w-28 text-right" placeholder="0,00" value={pricing.text} onChange={event => setPricing({ id: item.id, text: event.target.value })} onBlur={() => savePrice(item)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setPricing(undefined); }} />
            : <button type="button" aria-label={`Alterar preço de ${item.name}`} onClick={() => setPricing({ id: item.id, text: item.unitPriceCents > 0 ? (item.unitPriceCents / 100).toFixed(2).replace('.', ',') : '' })} className="rounded-button px-2 py-1 text-sm font-bold tabular-nums hover:bg-muted">{item.unitPriceCents > 0 ? formatCurrencyBRL(item.unitPriceCents) : <span className="font-medium text-warning">Sem preço</span>}</button>}
          <Button variant="ghost" size="icon" onClick={() => setEditing(item)} aria-label={`Editar ${item.name}`}><PencilSimple className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="text-danger" aria-label={`Excluir ${item.name}`} onClick={() => setDeleting(item)}><Trash className="size-4" /></Button>
        </div>
      </div>)}
      {!query.isLoading && visible.length === 0 && <p className="p-10 text-center text-sm text-text-muted">{items.length === 0 ? 'Catálogo vazio. Use "Carregar itens padrão de oficina" ou cadastre o primeiro item.' : 'Nenhum item encontrado nesta aba.'}</p>}
    </section>

    <CatalogItemFormModal open={editing !== undefined} item={editing ?? undefined} defaultType={tab} categories={categories} onOpenChange={open => { if (!open) setEditing(undefined); }} />
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !remove.isPending) setDeleting(undefined); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir do catálogo</DialogTitle><DialogDescription>"{deleting?.name}" deixa de aparecer para novos lançamentos. As ordens de serviço já lançadas não mudam.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(undefined)}>Voltar</Button><Button variant="destructive" disabled={remove.isPending} onClick={confirmDelete}>{remove.isPending ? 'Excluindo...' : 'Excluir'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
