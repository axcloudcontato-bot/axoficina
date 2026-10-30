'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyProductivity } from '../hooks/use-service-orders';
import { IdleTimeControl } from './IdleTimeControl';

function monthRange(now = new Date()) {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(now).split('-').map(Number);
  return { startAt: new Date(Date.UTC(year, month - 1, 1, 3)).toISOString(), endAt: new Date(Date.UTC(year, month, 1, 3)).toISOString() };
}
const hours = (minutes: number) => `${(minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

// The mechanic's month on the dashboard: target, progress and efficiency, without colleagues' numbers.
export function MyProductivityCard() {
  const range = useMemo(() => monthRange(), []);
  const query = useMyProductivity(range);
  const data = query.data;
  const progress = data?.target?.completedCount ? Math.min(100, Math.round(data.completedCount * 100 / data.target.completedCount)) : null;
  return <Card className="flex h-full flex-col overflow-hidden">
    <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Minha produtividade</CardTitle><p className="mt-1 text-sm text-text-muted">Seu mês até agora.</p></div><Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/produtividade">Ver detalhes</Link></Button></CardHeader>
    <CardContent className="space-y-4">
      {query.isLoading ? <div className="h-16 animate-pulse rounded-card bg-surface" /> : query.isError ? <p className="text-sm text-danger-strong">Não foi possível carregar. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p> : data && <>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-text-muted">OS entregues</dt><dd className="text-xl font-bold tabular-nums">{data.completedCount}{data.target ? <span className="text-sm font-normal text-text-muted"> / {data.target.completedCount}</span> : null}</dd></div>
          <div><dt className="text-xs text-text-muted">Tempo em OS</dt><dd className="text-xl font-bold tabular-nums">{hours(data.workedMinutes)}</dd></div>
          <div><dt className="text-xs text-text-muted">Eficiência</dt><dd className="text-xl font-bold tabular-nums">{data.efficiencyPercent != null ? `${data.efficiencyPercent}%` : '—'}</dd></div>
        </dl>
        {progress != null && <div><div className="h-2 rounded-full bg-surface" role="progressbar" aria-label="Meta de OS do mês" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-text-muted">{progress}% da meta de OS</p></div>}
        {data.reworkCount ? <p className="text-xs text-warning">{data.reworkCount === 1 ? '1 OS sua voltou em garantia neste mês.' : `${data.reworkCount} OS suas voltaram em garantia neste mês.`}</p> : null}
      </>}
      <IdleTimeControl />
    </CardContent>
  </Card>;
}
