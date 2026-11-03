'use client';

import Link from 'next/link';
import { ArrowRight, ArrowClockwise, Buildings, ChartLineUp, ClockCounterClockwise, CreditCard, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { extractErrorMessage } from '@/lib/api/client';
import { useSaasAdminAccess, useSubscriptions } from '@/features/subscriptions/hooks/use-subscriptions';
import { formatSubscriptionDate, SUBSCRIPTION_LABELS } from '@/features/subscriptions/subscription-labels';

export function SaasAdminOverview() {
  const access = useSaasAdminAccess();
  const subscriptions = useSubscriptions({ offset: 0, limit: 6, scope: 'active' }, access.data?.allowed === true);
  const summary = subscriptions.data?.summary;
  const statusRows = [
    { label: 'Ativas', value: summary?.active ?? 0, color: 'bg-success' },
    { label: 'Em teste', value: summary?.trial ?? 0, color: 'bg-info' },
    { label: 'Inadimplentes', value: summary?.pastDue ?? 0, color: 'bg-danger' },
    { label: 'Outras situações', value: Math.max(0, (summary?.total ?? 0) - (summary?.active ?? 0) - (summary?.trial ?? 0) - (summary?.pastDue ?? 0)), color: 'bg-muted-foreground' },
  ];
  const cards = [
    { label: 'Oficinas não encerradas', value: summary?.total, icon: Buildings, detail: 'Total em uso na plataforma' },
    { label: 'Assinaturas ativas', value: summary?.active, icon: CreditCard, detail: 'Oficinas com assinatura ativa' },
    { label: 'Receita mensal recorrente', value: summary ? formatCurrencyBRL(summary.mrrCents) : undefined, icon: ChartLineUp, detail: 'Planos anuais divididos por 12' },
    { label: 'Precisam de atenção', value: summary?.pastDue, icon: WarningCircle, detail: 'Assinaturas inadimplentes', warning: true },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">Visão geral do Ofix</h2><p className="mt-1 text-sm text-text-muted">Acompanhe as oficinas e assinaturas em um só lugar.</p></div><Button variant="outline" disabled={subscriptions.isFetching} onClick={() => subscriptions.refetch()}><ArrowClockwise className="size-4" />{subscriptions.isFetching ? 'Atualizando...' : 'Atualizar dados'}</Button></div>
    {subscriptions.isError && <div role="alert" className="rounded-button border border-danger/20 bg-danger-subtle p-4 text-sm text-danger-strong">{extractErrorMessage(subscriptions.error, 'Não foi possível carregar o painel.')}</div>}
    <section aria-label="Indicadores da plataforma" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="min-h-[150px] rounded-card border border-border bg-card p-5 shadow-card"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-text-muted">{card.label}</p><span className={`grid size-9 shrink-0 place-items-center rounded-button ${card.warning && Number(card.value) > 0 ? 'bg-danger-subtle text-danger-strong' : 'bg-muted text-text-muted'}`}><Icon className="size-5" aria-hidden /></span></div><p className="mt-4 break-words text-3xl font-bold tracking-tight tabular-nums">{subscriptions.isPending || subscriptions.isError ? '—' : card.value ?? '—'}</p><p className="mt-1 text-xs text-text-muted">{card.detail}</p></div>; })}</section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <section className="overflow-hidden rounded-card border border-border bg-card shadow-card" aria-label="Oficinas recentes"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="font-bold">Oficinas recentes</h3><p className="mt-1 text-xs text-text-muted">Cadastros mais recentes na plataforma</p></div><Link href="/admin/assinaturas" className="flex items-center gap-1 text-xs font-bold text-primary-ink hover:underline">Ver todas <ArrowRight className="size-4" /></Link></div>{subscriptions.isPending ? <p role="status" className="p-7 text-sm text-text-muted">Carregando oficinas...</p> : !subscriptions.data?.items.length ? <p className="p-7 text-sm text-text-muted">Nenhuma oficina cadastrada.</p> : <div className="divide-y divide-border">{subscriptions.data.items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-muted/30"><span className="grid size-10 shrink-0 place-items-center rounded-button bg-muted font-bold text-text-muted">{item.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={item.name}>{item.name}</p><p className="truncate text-xs text-text-muted">{item.ownerEmail || item.email || item.plan}</p></div><span className="text-xs font-semibold text-text-muted">{SUBSCRIPTION_LABELS[item.subscriptionStatus].label}</span><span className="hidden min-w-20 text-right text-xs tabular-nums text-text-muted sm:block">{formatSubscriptionDate(item.subscriptionDueAt)}</span></div>)}</div>}</section>
      <section className="rounded-card border border-border bg-card p-5 shadow-card" aria-label="Situação das assinaturas"><div className="flex items-center gap-2"><ClockCounterClockwise className="size-5 text-text-muted" aria-hidden /><h3 className="font-bold">Situação das assinaturas</h3></div><p className="mt-1 text-xs text-text-muted">Distribuição das oficinas não encerradas</p><div className="mt-7 space-y-5">{statusRows.map((row) => <div key={row.label}><div className="mb-2 flex justify-between text-sm"><span className="text-text-muted">{row.label}</span><strong className="tabular-nums">{subscriptions.isPending || subscriptions.isError ? '—' : row.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${summary?.total ? row.value / summary.total * 100 : 0}%` }} /></div></div>)}</div><p className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-text-muted">Os totais independem dos filtros da lista de assinaturas.</p></section>
    </div>
  </div>;
}
