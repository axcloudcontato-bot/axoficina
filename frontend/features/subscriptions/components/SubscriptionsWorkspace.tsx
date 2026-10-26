'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowClockwise, ArrowLeft, Buildings, CreditCard, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import { SUBSCRIPTION_STATUSES } from '@oficina/contracts';
import type { SubscriptionResponse, SubscriptionStatus } from '@oficina/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { formatCNPJ, formatCPF } from '@/lib/format-br-document';
import { extractErrorMessage } from '@/lib/api/client';
import { useSaasAdminAccess, useSubscriptions } from '../hooks/use-subscriptions';
import { CYCLE_LABELS, formatSubscriptionDate, SUBSCRIPTION_LABELS } from '../subscription-labels';
import { SubscriptionEditDialog } from './SubscriptionEditDialog';

const PAGE_SIZE = 20;

export function SubscriptionsWorkspace() {
  const access = useSaasAdminAccess();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SubscriptionResponse | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => { setDebouncedSearch(search.trim()); setOffset(0); }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const subscriptions = useSubscriptions({ offset, limit: PAGE_SIZE, search: debouncedSearch || undefined, status: status || undefined }, access.data?.allowed === true);
  const data = subscriptions.data;

  if (access.isPending) return <p role="status" className="py-16 text-center text-sm text-text-muted">Verificando acesso à administração...</p>;
  if (access.isError) return <div role="alert" className="space-y-3 rounded-card border border-border bg-card p-6"><p>Não foi possível verificar seu acesso.</p><Button variant="outline" onClick={() => access.refetch()}>Tentar novamente</Button></div>;
  if (!access.data?.allowed) return <div className="mx-auto max-w-lg space-y-4 rounded-card border border-border bg-card p-8 text-center"><ShieldCheck className="mx-auto size-8 text-text-muted" aria-hidden="true" /><h2 className="text-xl font-bold">Acesso restrito</h2><p className="text-sm text-text-muted">Esta área é exclusiva para as contas autorizadas a administrar o SaaS.</p><Button variant="outline" asChild><Link href="/painel">Voltar para a oficina</Link></Button></div>;

  return <div className="mx-auto max-w-[1440px] space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-muted"><ShieldCheck className="size-4" aria-hidden="true" />Administração do SaaS<Badge variant="outline">Todas as oficinas</Badge></div><h2 className="text-2xl font-bold tracking-tight text-text">Assinaturas</h2><p className="mt-1 text-sm text-text-muted">Acompanhe os planos, os vencimentos e a situação de cada oficina.</p></div>
      <div className="flex gap-2"><Button asChild variant="ghost" size="sm"><Link href="/painel"><ArrowLeft className="mr-2 size-4" aria-hidden="true" />Minha oficina</Link></Button><Button variant="outline" size="sm" disabled={subscriptions.isFetching} onClick={() => subscriptions.refetch()}><ArrowClockwise className="mr-2 size-4" aria-hidden="true" />{subscriptions.isFetching ? 'Atualizando...' : 'Atualizar'}</Button></div>
    </div>

    <section aria-label="Indicadores de todas as oficinas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        { label: 'Oficinas cadastradas', value: data?.summary.total, hint: 'Total na plataforma' },
        { label: 'Assinaturas ativas', value: data?.summary.active, hint: 'Situação marcada como ativa' },
        { label: 'Receita mensal recorrente', value: data ? formatCurrencyBRL(data.summary.mrrCents) : undefined, hint: 'Ativas · planos anuais ÷ 12' },
        { label: 'Em teste', value: data?.summary.trial, hint: 'Período de avaliação' },
        { label: 'Inadimplentes', value: data?.summary.pastDue, hint: 'Situação informada manualmente' },
      ].map((metric) => <div key={metric.label} className="rounded-card border border-border bg-card p-4"><p className="text-xs font-medium text-text-muted">{metric.label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-text tabular-nums">{subscriptions.isError ? '—' : metric.value ?? '—'}</p><p className="mt-1 text-[11px] text-text-muted">{metric.hint}</p></div>)}
    </section>

    <section className="overflow-hidden rounded-card border border-border bg-card" aria-label="Lista de assinaturas">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="relative w-full sm:max-w-sm"><MagnifyingGlass className="pointer-events-none absolute left-3 top-3 size-4 text-text-muted" aria-hidden="true" /><Input aria-label="Buscar oficina, documento ou e-mail" placeholder="Buscar oficina, CPF/CNPJ ou e-mail..." maxLength={120} className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="flex items-center gap-3"><label htmlFor="subscription-filter" className="text-xs font-medium text-text-muted">Situação</label><select id="subscription-filter" value={status} onChange={(event) => { setStatus(event.target.value as SubscriptionStatus | ''); setOffset(0); }} className="h-10 rounded-button border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"><option value="">Todas as situações</option>{SUBSCRIPTION_STATUSES.map((key) => <option key={key} value={key}>{SUBSCRIPTION_LABELS[key].label}</option>)}</select></div>
      </div>
      {subscriptions.isError ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-danger-strong">{extractErrorMessage(subscriptions.error, 'Não foi possível carregar as assinaturas.')}</p><Button variant="outline" onClick={() => subscriptions.refetch()}>Tentar novamente</Button></div> : subscriptions.isPending ? <p role="status" className="p-12 text-center text-sm text-text-muted">Carregando assinaturas...</p> : !data?.items.length ? <div role="status" className="flex flex-col items-center gap-3 px-6 py-14 text-center"><Buildings className="size-8 text-text-muted" aria-hidden="true" /><h3 className="font-semibold">{search || status ? 'Nenhuma oficina encontrada' : 'Nenhuma oficina cadastrada'}</h3><p className="max-w-md text-sm text-text-muted">{search || status ? 'Ajuste a busca ou remova os filtros para ver mais resultados.' : 'As oficinas aparecerão aqui após o cadastro na plataforma.'}</p>{Boolean(search || status) && <Button variant="outline" onClick={() => { setSearch(''); setDebouncedSearch(''); setStatus(''); setOffset(0); }}>Limpar filtros</Button>}</div> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b border-border bg-muted/40 text-left text-xs text-text-muted">{['Oficina', 'Plano', 'Valor / período', 'Situação', 'Próximo vencimento', ''].map((label, index) => <th key={index} scope="col" className="px-4 py-3 font-semibold">{label || <span className="sr-only">Ações</span>}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.items.map((item) => <tr key={item.id} className="transition-colors hover:bg-muted/30"><td className="max-w-[260px] px-4 py-4"><p className="truncate font-semibold text-text" title={item.name}>{item.name}</p><p className="mt-1 text-xs text-text-muted">{(item.document.length > 11 ? formatCNPJ(item.document) : formatCPF(item.document))}</p>{item.email && <p className="mt-1 truncate text-xs text-text-muted">{item.email}</p>}</td><td className="max-w-40 px-4 py-4"><span className="block truncate" title={item.plan}>{item.plan}</span></td><td className="whitespace-nowrap px-4 py-4"><span className="font-medium tabular-nums">{formatCurrencyBRL(item.subscriptionAmountCents)}</span><p className="mt-1 text-xs text-text-muted">{CYCLE_LABELS[item.subscriptionCycle]}</p></td><td className="px-4 py-4"><Badge variant={SUBSCRIPTION_LABELS[item.subscriptionStatus].variant}>{SUBSCRIPTION_LABELS[item.subscriptionStatus].label}</Badge></td><td className="whitespace-nowrap px-4 py-4 text-text-muted tabular-nums">{formatSubscriptionDate(item.subscriptionDueAt)}</td><td className="px-4 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(item)} aria-label={`Gerenciar assinatura de ${item.name}`}>Gerenciar</Button></td></tr>)}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"><p role="status" className="text-xs text-text-muted">{offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} de {data.total} oficinas{Boolean(search || status) && ' · filtros aplicados'}</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={!offset || subscriptions.isFetching} onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}>Anterior</Button><Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= data.total || subscriptions.isFetching} onClick={() => setOffset((current) => current + PAGE_SIZE)}>Próxima</Button></div></div>
      </>}
    </section>
    <p className="flex items-start gap-2 text-xs leading-relaxed text-text-muted"><CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Controle manual de assinaturas. Os indicadores consideram todas as oficinas, independentemente dos filtros da lista.</p>
    {selected && <SubscriptionEditDialog key={selected.id} subscription={selected} onClose={() => setSelected(null)} />}
  </div>;
}
