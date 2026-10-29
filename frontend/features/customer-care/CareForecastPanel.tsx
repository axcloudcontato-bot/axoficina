'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarBlank, CalendarCheck, Cake, PaperPlaneTilt } from '@phosphor-icons/react';
import type { CareForecastDay, CareForecastResponse } from '@oficina/contracts';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCareForecast } from './use-customer-care';

type Grouping = 'day' | 'week' | 'month';
const GROUPINGS: Array<{ value: Grouping; label: string }> = [{ value: 'day', label: 'Por dia' }, { value: 'week', label: 'Por semana' }, { value: 'month', label: 'Por mês' }];
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const format = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', ...options });
const nextMonth = (today: string) => { const [year, month] = today.split('-').map(Number); return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`; };
const weekStart = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));

interface Period { key: string; label: string; days: CareForecastDay[] }
const maintenance = (days: CareForecastDay[]) => days.flatMap(day => day.customers.filter(customer => customer.kind === 'MAINTENANCE'));
const birthdays = (days: CareForecastDay[]) => days.flatMap(day => day.customers.filter(customer => customer.kind === 'BIRTHDAY'));

function groupPeriods(days: CareForecastDay[], grouping: Grouping, today: string): Period[] {
  const periods = new Map<string, Period>();
  for (const day of days) {
    const key = grouping === 'day' ? day.date : grouping === 'week' ? weekStart(day.date) : day.date.slice(0, 7);
    const label = grouping === 'day' ? format(day.date, { weekday: 'long', day: '2-digit', month: 'long' }) + (day.date === today ? ' · hoje' : '')
      : grouping === 'week' ? `${format(key, { day: '2-digit', month: 'short' })} a ${format(addDays(key, 6), { day: '2-digit', month: 'short' })}`
        : format(`${key}-01`, { month: 'long', year: 'numeric' });
    const period = periods.get(key) ?? { key, label, days: [] }; periods.set(key, period); period.days.push(day);
  }
  return [...periods.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function CareForecastPanel({ enabled }: { enabled: boolean }) {
  const query = useCareForecast(enabled);
  const [grouping, setGrouping] = useState<Grouping>('week');
  const [rate, setRate] = useState(20);
  const data = query.data;
  const periods = useMemo(() => data ? groupPeriods(data.days, grouping, data.today) : [], [data, grouping]);
  if (query.isLoading) return <p className="py-8 text-muted-foreground" role="status">Calculando a previsão…</p>;
  if (query.isError || !data) return <p className="py-8 text-muted-foreground">Não foi possível calcular a previsão. Tente novamente em instantes.</p>;
  const appointments = (count: number) => Math.round(count * Math.min(100, Math.max(0, rate)) / 100);
  const inDays = (limit: number) => data.days.filter(day => day.date <= addDays(data.today, limit - 1));
  const summary = [
    { label: 'Hoje', days: data.days.filter(day => day.date === data.today) },
    { label: 'Próximos 7 dias', days: inDays(7) },
    { label: 'Até o fim do mês', days: data.days.filter(day => day.date.slice(0, 7) === data.today.slice(0, 7)) },
    { label: 'Mês que vem', days: data.days.filter(day => day.date.slice(0, 7) === nextMonth(data.today)) },
  ];
  const lateNow = maintenance(data.days.filter(day => day.date === data.today)).filter(customer => customer.items.some(item => item.late)).length;
  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold">Quem vai receber lembrete</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Clientes com o próximo cuidado se aproximando, contados na data em que a mensagem sai (o aviso antecipado de cada campanha). Quem já foi avisado não entra na conta.</p></div>
    {!data.enabled && <p className="rounded-button border border-warning-strong bg-warning-subtle p-3 text-sm text-warning-strong">A régua está pausada: nenhuma mensagem sai até você ativar os disparos automáticos na Visão geral.</p>}
    <section aria-label="Resumo da previsão" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{summary.map(item => {
      const count = maintenance(item.days).length;
      return <div key={item.label} className="rounded-card border border-border bg-card p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-muted-foreground">{item.label}</p><PaperPlaneTilt className="size-5 shrink-0 text-primary" aria-hidden="true" /></div><p className="mt-3 text-3xl font-bold tabular-nums">{count}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{count === 1 ? 'cliente a contatar' : 'clientes a contatar'}</p><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary"><CalendarCheck className="size-4" aria-hidden="true" /> ~{appointments(count)} possíveis agendamentos</p>{item.label === 'Hoje' && lateNow > 0 && <p className="mt-1 text-xs text-muted-foreground">{lateNow} já passaram do prazo e saem no próximo ciclo.</p>}</div>;
    })}</section>
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-card p-4">
      <label className="space-y-2 text-sm font-semibold"><span>Quantos contatos viram agendamento? (%)</span><Input type="number" min={0} max={100} className="w-28" value={rate} onChange={event => setRate(Number(event.target.value))} /><span className="block text-xs font-normal text-muted-foreground">Estimativa sua: ajuste com o que a oficina costuma converter.</span></label>
      <div role="group" aria-label="Agrupar previsão" className="flex gap-1 rounded-button bg-muted p-1">{GROUPINGS.map(item => <button key={item.value} type="button" aria-pressed={grouping === item.value} onClick={() => setGrouping(item.value)} className={cn('rounded-button px-4 py-1.5 text-sm font-semibold transition-colors', grouping === item.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{item.label}</button>)}</div>
    </div>
    {data.withoutConsent > 0 && <p className="rounded-button bg-muted p-3 text-sm text-muted-foreground">{data.withoutConsent} {data.withoutConsent === 1 ? 'cliente tem' : 'clientes têm'} cuidado próximo, mas {data.withoutConsent === 1 ? 'não autorizou' : 'não autorizaram'} lembretes e não {data.withoutConsent === 1 ? 'aparece' : 'aparecem'} abaixo. Peça a autorização em <strong>Clientes</strong>.</p>}
    {!periods.length ? <div className="rounded-card border border-dashed border-border bg-card p-10 text-center"><CalendarBlank className="mx-auto size-9 text-primary" aria-hidden="true" /><p className="mt-4 font-semibold">Nenhum lembrete previsto nos próximos {data.horizonDays} dias.</p><p className="mt-2 text-sm text-muted-foreground">Registre cuidados dos veículos e peça a autorização dos clientes para a previsão aparecer.</p></div>
      : <div className="space-y-3">{periods.map(period => {
        const people = maintenance(period.days); const born = birthdays(period.days);
        const overLimit = period.days.some(day => maintenance([day]).length > data.dailyLimit);
        return <details key={period.key} className="rounded-card border border-border bg-card p-4 sm:p-5">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3"><span className="font-bold capitalize">{period.label}</span><span className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold tabular-nums">{people.length} {people.length === 1 ? 'contato' : 'contatos'}</span><span className="font-semibold text-primary tabular-nums">~{appointments(people.length)} agend.</span>{born.length > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Cake className="size-4" aria-hidden="true" /> {born.length}</span>}</span></summary>
          {overLimit && <p className="mt-3 text-xs text-warning-strong">Algum dia passa do limite de {data.dailyLimit} contatos: o excedente é enviado nos dias seguintes.</p>}
          <div className="mt-4 space-y-4">{period.days.map(day => <div key={day.date}>{grouping !== 'day' && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{format(day.date, { weekday: 'long', day: '2-digit', month: '2-digit' })}</p>}<ul className="divide-y divide-border rounded-button border border-border">{day.customers.map(customer => <li key={`${customer.customerId}:${customer.kind}`} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm"><span className="flex items-center gap-2 font-semibold">{customer.kind === 'BIRTHDAY' && <Cake className="size-4 text-primary" aria-label="Aniversário" />}{customer.customerName}{customer.kind === 'MAINTENANCE' && <Link href={`/agenda?${new URLSearchParams({ cliente: customer.customerId, nome: customer.customerName, ...(customer.items[0] ? { veiculo: customer.items[0].vehicleId, servico: customer.items.map((entry) => entry.serviceName).join(', ') } : {}) }).toString()}`} className="rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-selection">Agendar</Link>}</span><span className="text-right text-xs leading-5 text-muted-foreground">{customer.kind === 'BIRTHDAY' ? 'Mensagem de aniversário' : customer.items.map(item => <span key={`${item.plate}:${item.serviceName}`} className="block">{item.serviceName} · {item.vehicleName} <span className="font-mono">{item.plate}</span> · vence {format(item.dueAt, { day: '2-digit', month: '2-digit' })}{item.late ? ' (atrasado)' : ''}</span>)}</span></li>)}</ul></div>)}</div>
        </details>;
      })}</div>}
  </div>;
}
