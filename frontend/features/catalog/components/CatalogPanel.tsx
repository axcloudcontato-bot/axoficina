'use client';

import { useMemo, useState } from 'react';
import { CATALOG_ITEM_TYPE_LABELS, CATALOG_ITEM_TYPES, type CatalogItemResponse, type CatalogItemType } from '@oficina/contracts';
import { MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { normalizeNavigationSearch } from '@/lib/navigation';
import { useCatalogItems, useDeleteCatalogItem, useSeedCatalogDefaults } from '../hooks/use-catalog';
import { CatalogItemFormModal } from './CatalogItemFormModal';

const TAB_LABELS: Record<CatalogItemType, string> = { PART: 'Peças', PRODUCT: 'Produtos', LABOR: 'Serviços' };

export function CatalogPanel() {
  const query = useCatalogItems();
  const remove = useDeleteCatalogItem();
  const seed = useSeedCatalogDefaults();
  const [tab, setTab] = useState<CatalogItemType>('LABOR');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogItemResponse | null | undefined>(undefined);

  const items = query.data?.items ?? [];
  const counts = useMemo(() => Object.fromEntries(CATALOG_ITEM_TYPES.map(type => [type, items.filter(item => item.type === type).length])) as Record<CatalogItemType, number>, [items]);
  const visible = useMemo(() => {
    const term = normalizeNavigationSearch(search);
    return items.filter(item => item.type === tab && (!term || normalizeNavigationSearch(`${item.name} ${item.category ?? ''}`).includes(term)));
  }, [items, tab, search]);

  function loadDefaults() {
    seed.mutate(undefined, {
      onSuccess: result => toast.success(result.created ? `${result.created} itens padrão adicionados. Ajuste os preços de cada um.` : 'Os itens padrão já estavam no catálogo.'),
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

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Tipo de item" className="flex gap-1 rounded-button bg-muted p-1">
        {CATALOG_ITEM_TYPES.map(type => <button key={type} role="tab" aria-selected={tab === type} onClick={() => setTab(type)} className={`rounded-button px-4 py-1.5 text-sm font-semibold transition-colors ${tab === type ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>{TAB_LABELS[type]} <span className="text-xs font-normal text-text-muted">{counts[type]}</span></button>)}
      </div>
      <div className="relative w-full sm:w-72">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
        <Input aria-label="Buscar no catálogo" className="pl-9" placeholder="Buscar por nome ou categoria" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
    </div>

    <section className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      {visible.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-0">
        <div className="min-w-0">
          <p className="font-semibold">{item.name}</p>
          {item.category && <p className="text-xs text-text-muted">{item.category}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tabular-nums">{item.unitPriceCents > 0 ? formatCurrencyBRL(item.unitPriceCents) : <span className="font-medium text-text-muted">Sem preço</span>}</span>
          <Button variant="ghost" size="icon" onClick={() => setEditing(item)} aria-label={`Editar ${item.name}`}><PencilSimple className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="text-danger" aria-label={`Excluir ${item.name}`} onClick={() => window.confirm(`Excluir "${item.name}" do catálogo? As ordens de serviço já lançadas não mudam.`) && remove.mutate(item.id, { onError: error => toast.error(extractErrorMessage(error)) })}><Trash className="size-4" /></Button>
        </div>
      </div>)}
      {!query.isLoading && visible.length === 0 && <p className="p-10 text-center text-sm text-text-muted">{items.length === 0 ? 'Catálogo vazio. Use "Carregar itens padrão de oficina" ou cadastre o primeiro item.' : 'Nenhum item encontrado nesta aba.'}</p>}
    </section>

    <CatalogItemFormModal open={editing !== undefined} item={editing ?? undefined} defaultType={tab} onOpenChange={open => { if (!open) setEditing(undefined); }} />
  </div>;
}
