'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarBlank, ChatCircleDots, MagnifyingGlass, Phone, ShieldCheck } from '@phosphor-icons/react';
import { formatPlate, MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS, type CarePlanFilter, type CarePlanResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { phoneDigits, whatsappHref } from '@/features/customers/format-customer';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { CarePlanContactDialog } from './CarePlanContactDialog';
import { useCarePlans } from './use-customer-care';

const PAGE_SIZE = 50;
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const ALL_FILTERS: Array<{ value: CarePlanFilter; label: string }> = [
  { value: 'ALL', label: 'Todos os planos' },
  { value: 'DUE', label: 'Vencidos e próximos 30 dias' },
  { value: 'OVERDUE', label: 'Vencidos' },
  { value: 'UPCOMING', label: 'Vencem em 30 dias' },
];
const MANUAL_FILTERS = ALL_FILTERS.filter(item => item.value === 'DUE' || item.value === 'OVERDUE');

// The message the team can send by hand; only a start, the person reads and edits it in WhatsApp.
function manualMessage(plan: CarePlanResponse, workshop?: string) {
  const first = plan.customerName.trim().split(/\s+/)[0];
  return `Olá, ${first}! ${workshop ? `Aqui é da ${workshop}. ` : ''}Está na hora de cuidar de ${plan.serviceName.toLowerCase()} do seu ${plan.vehicleName}. Quer combinar um horário para a gente conferir?`;
}

// Every car's next care, the one due first at the top. In the manual mode it is the team's call list: the cares due
// of customers who did not authorize the automatic reminders, with shortcuts to reach them and a record of each attempt.
export function CarePlansPanel({ enabled, canRecord, onRecord, mode = 'all', initialFilter, workshop }: { enabled: boolean; canRecord: boolean; onRecord: (plan?: CarePlanResponse) => void; mode?: 'all' | 'manual'; initialFilter?: CarePlanFilter; workshop?: string }) {
  const manual = mode === 'manual';
  const filters = manual ? MANUAL_FILTERS : ALL_FILTERS;
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<CarePlanFilter>(initialFilter ?? (manual ? 'DUE' : 'ALL'));
  const [searchInput, setSearchInput] = useState('');
  const [contacting, setContacting] = useState<CarePlanResponse>();
  const search = useDebouncedValue(searchInput.trim(), 300);
  const query = useCarePlans({ offset, limit: PAGE_SIZE, filter, search: search || undefined, ...(manual ? { consent: 'NOT_GRANTED' as const } : {}) }, enabled);
  const plans = query.data?.plans ?? [];
  const total = query.data?.total ?? 0;
  const narrowed = filter !== (manual ? 'DUE' : 'ALL') || Boolean(search);

  return <div className="space-y-4">
    {manual
      ? <div><h2 className="text-xl font-bold">Quem precisa de uma ligação.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Cuidados vencidos ou próximos de clientes que não autorizaram os lembretes automáticos. Eles não recebem nada sozinhos: o contato fica com a equipe.</p></div>
      : <div><h2 className="text-xl font-bold">Cada carro tem seu tempo.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">O próximo cuidado de cada carro, do que vence primeiro ao mais distante. Óleo, freios e filtros mantêm prazos independentes.</p></div>}
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Buscar planos" className="pl-9" placeholder="Placa, modelo ou cliente" value={searchInput} onChange={event => { setSearchInput(event.target.value); setOffset(0); }} /></div>
      <select aria-label="Situação do plano" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={filter} onChange={event => { setFilter(event.target.value as CarePlanFilter); setOffset(0); }}>{filters.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      {canRecord && !manual && <Button variant="outline" onClick={() => onRecord()}>Registrar cuidado</Button>}
    </div>
    {query.isLoading && <div role="status" aria-label="Carregando planos" className="h-32 animate-pulse rounded-card bg-surface" />}
    {query.isError && <div className="rounded-card border border-border bg-card p-6 text-sm">Não foi possível carregar os planos. <button type="button" className="font-semibold underline" onClick={() => query.refetch()}>Tentar novamente</button></div>}
    {!query.isLoading && !query.isError && !plans.length && (manual
      ? <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{narrowed ? 'Nenhum cliente encontrado com essa busca ou situação.' : 'Ninguém para ligar agora: todos os cuidados próximos são de clientes que recebem o lembrete sozinhos.'}</p>
      : narrowed
        ? <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum plano encontrado com essa busca ou situação.</p>
        : <div className="rounded-card border border-dashed border-border bg-card p-10 text-center"><ShieldCheck className="mx-auto size-9 text-primary" aria-hidden="true" /><h3 className="mt-4 font-bold">O primeiro cuidado começa com uma boa referência.</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-muted-foreground">Registre um serviço já realizado ou identifique o cuidado em um item da OS. Ao entregar a OS, o Ofix programa o próximo retorno.</p>{canRecord && <Button className="mt-5" onClick={() => onRecord()}>Registrar primeiro cuidado</Button>}</div>)}
    {plans.length > 0 && <div className="grid gap-3 lg:grid-cols-2">{plans.map(plan => {
      const phone = plan.customerPhone ? phoneDigits(plan.customerPhone) : '';
      return <article key={plan.id} className={cn('rounded-card border bg-card p-5', plan.overdue ? 'border-danger/40' : 'border-border')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary">{plan.serviceName}</p>
            <h3 className="mt-2 font-bold"><Link href={`/veiculos/${plan.vehicleId}`} className="hover:text-primary hover:underline">{plan.vehicleName}</Link> <span className="font-mono text-xs text-muted-foreground">{formatPlate(plan.plate)}</span></h3>
            <p className="mt-1 text-sm text-muted-foreground"><Link href={`/clientes/${plan.customerId}`} className="hover:text-primary hover:underline">{plan.customerName}</Link></p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {plan.overdue && <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-bold text-danger">Vencido</span>}
            {!manual && <span title={plan.customerCareEnabled ? 'O cliente autorizou: o lembrete sai sozinho.' : 'O cliente não autorizou os lembretes: a equipe precisa entrar em contato.'} className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', plan.customerCareEnabled ? 'bg-success-subtle text-success-strong' : 'bg-muted text-foreground')}>{plan.customerCareEnabled ? 'Recebe lembrete' : 'Contato manual'}</span>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Último cuidado</p><p className="mt-1 font-semibold">{date(plan.completedAt)}</p>{plan.mileage !== undefined && <p className="mt-1 text-xs text-muted-foreground">{plan.mileage.toLocaleString('pt-BR')} km</p>}</div>
          <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarBlank className="size-3.5" aria-hidden="true" />Próximo retorno sugerido</p><p className="mt-1 font-semibold">{date(plan.dueAt)}</p>{plan.dueMileage !== undefined && <p className="mt-1 text-xs text-muted-foreground">ou {plan.dueMileage.toLocaleString('pt-BR')} km</p>}</div>
        </div>
        {manual && <p className="mt-3 text-xs text-muted-foreground">{plan.lastContact ? <><span className="font-semibold text-foreground">{MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS[plan.lastContact.outcome]}</span> · {date(plan.lastContact.at)}{plan.lastContact.byName ? ` · ${plan.lastContact.byName}` : ''}{(plan.contactCount ?? 0) > 1 ? ` · ${plan.contactCount} tentativas` : ''}</> : 'Ninguém contatou ainda'}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {manual && phone.length >= 10 && <Button size="icon" variant="ghost" asChild aria-label={`WhatsApp de ${plan.customerName}`}><a href={`${whatsappHref(plan.customerPhone ?? '')}?text=${encodeURIComponent(manualMessage(plan, workshop))}`} target="_blank" rel="noopener noreferrer"><ChatCircleDots className="size-4" aria-hidden="true" /></a></Button>}
          {manual && phone.length >= 8 && <Button size="icon" variant="ghost" asChild aria-label={`Ligar para ${plan.customerName}`}><a href={`tel:${phone}`}><Phone className="size-4" aria-hidden="true" /></a></Button>}
          {manual && <Button size="icon" variant="ghost" asChild aria-label={`Agendar ${formatPlate(plan.plate)}`}><Link href={`/agenda?${new URLSearchParams({ cliente: plan.customerId, nome: plan.customerName, veiculo: plan.vehicleId, servico: plan.serviceName }).toString()}`}><CalendarBlank className="size-4" aria-hidden="true" /></Link></Button>}
          {manual && canRecord && <Button variant="outline" size="sm" onClick={() => setContacting(plan)}>Registrar contato</Button>}
          {canRecord && <Button variant="outline" size="sm" onClick={() => onRecord(plan)}>Registrar novo serviço</Button>}
        </div>
      </article>;
    })}</div>}
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{total} {manual ? (total === 1 ? 'cliente para contatar' : 'cuidados para contatar') : `${total === 1 ? 'plano' : 'planos'}${narrowed ? ' encontrados' : ' cadastrados'}`}{total > PAGE_SIZE ? ` · página ${Math.floor(offset / PAGE_SIZE) + 1}` : ''}</span>{total > PAGE_SIZE && <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button><Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Próxima</Button></div>}</div>
    {manual && <CarePlanContactDialog plan={contacting} onClose={() => setContacting(undefined)} />}
  </div>;
}
