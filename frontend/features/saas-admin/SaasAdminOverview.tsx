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
    { label: 'Ativas', value: summary?.active ?? 0, color: 'bg-[#2ed8b6]' },
    { label: 'Em teste', value: summary?.trial ?? 0, color: 'bg-[#4099ff]' },
    { label: 'Inadimplentes', value: summary?.pastDue ?? 0, color: 'bg-[#ffb64d]' },
    { label: 'Outras situações', value: Math.max(0, (summary?.total ?? 0) - (summary?.active ?? 0) - (summary?.trial ?? 0) - (summary?.pastDue ?? 0)), color: 'bg-[#9ca3af]' },
  ];
  const cards = [
    { label: 'Oficinas não encerradas', value: summary?.total, icon: Buildings, gradient: 'from-[#4099ff] to-[#73b4ff]', detail: 'Total em uso na plataforma' },
    { label: 'Assinaturas ativas', value: summary?.active, icon: CreditCard, gradient: 'from-[#2bc6a5] to-[#63dfc7]', detail: 'Oficinas com assinatura ativa' },
    { label: 'Receita mensal recorrente', value: summary ? formatCurrencyBRL(summary.mrrCents) : undefined, icon: ChartLineUp, gradient: 'from-[#7759de] to-[#ab82ee]', detail: 'Planos anuais divididos por 12' },
    { label: 'Precisam de atenção', value: summary?.pastDue, icon: WarningCircle, gradient: 'from-[#ff8a65] to-[#ff5370]', detail: 'Assinaturas inadimplentes' },
  ];

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#7759de]">Painel da plataforma</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Visão geral do Ofix</h2><p className="mt-2 text-sm text-slate-500">Acompanhe as oficinas e assinaturas em um só lugar.</p></div><Button variant="outline" disabled={subscriptions.isFetching} onClick={() => subscriptions.refetch()} className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><ArrowClockwise className="mr-2 size-4" />{subscriptions.isFetching ? 'Atualizando...' : 'Atualizar dados'}</Button></div>
    {subscriptions.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{extractErrorMessage(subscriptions.error, 'Não foi possível carregar o painel.')}</div>}
    <section aria-label="Indicadores da plataforma" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <div key={card.label} className={`relative min-h-[160px] overflow-hidden rounded-xl bg-gradient-to-r ${card.gradient} p-5 text-white shadow-[0_6px_22px_rgba(26,43,74,0.12)]`}><div className="absolute -right-7 -top-8 size-32 rounded-full bg-white/10" /><div className="absolute -bottom-10 right-7 size-28 rounded-full bg-white/10" /><div className="relative flex items-start justify-between gap-4"><p className="text-sm font-semibold text-white/90">{card.label}</p><Icon className="size-6 text-white/80" aria-hidden /></div><p className="relative mt-5 break-words text-3xl font-bold tracking-tight tabular-nums">{subscriptions.isPending || subscriptions.isError ? '—' : card.value ?? '—'}</p><p className="relative mt-2 text-xs text-white/80">{card.detail}</p></div>; })}</section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <section className="overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_2px_12px_rgba(26,43,74,0.05)]" aria-label="Oficinas recentes"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold">Oficinas recentes</h3><p className="mt-1 text-xs text-slate-500">Cadastros mais recentes na plataforma</p></div><Link href="/admin/assinaturas" className="flex items-center gap-1 text-xs font-bold text-[#5b68cb] hover:underline">Ver todas <ArrowRight className="size-4" /></Link></div>{subscriptions.isPending ? <p role="status" className="p-7 text-sm text-slate-500">Carregando oficinas...</p> : !subscriptions.data?.items.length ? <p className="p-7 text-sm text-slate-500">Nenhuma oficina cadastrada.</p> : <div className="divide-y divide-slate-100">{subscriptions.data.items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ecedff] font-bold text-[#6654bf]">{item.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={item.name}>{item.name}</p><p className="truncate text-xs text-slate-500">{item.ownerEmail || item.email || item.plan}</p></div><span className="text-xs font-semibold text-slate-500">{SUBSCRIPTION_LABELS[item.subscriptionStatus].label}</span><span className="hidden min-w-20 text-right text-xs tabular-nums text-slate-500 sm:block">{formatSubscriptionDate(item.subscriptionDueAt)}</span></div>)}</div>}</section>
      <section className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_2px_12px_rgba(26,43,74,0.05)]" aria-label="Situação das assinaturas"><div className="flex items-center gap-2"><ClockCounterClockwise className="size-5 text-[#7759de]" aria-hidden /><h3 className="font-bold">Situação das assinaturas</h3></div><p className="mt-1 text-xs text-slate-500">Distribuição das oficinas não encerradas</p><div className="mt-7 space-y-5">{statusRows.map((row) => <div key={row.label}><div className="mb-2 flex justify-between text-sm"><span className="text-slate-600">{row.label}</span><strong className="tabular-nums">{subscriptions.isPending || subscriptions.isError ? '—' : row.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${summary?.total ? row.value / summary.total * 100 : 0}%` }} /></div></div>)}</div><p className="mt-8 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">Os totais independem dos filtros da lista de assinaturas.</p></section>
    </div>
  </div>;
}
