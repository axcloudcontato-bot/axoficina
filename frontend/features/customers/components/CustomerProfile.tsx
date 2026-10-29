'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CarProfile, ChatCircleDots, ClipboardText, Phone, PencilSimple, Plus } from '@phosphor-icons/react';
import { CUSTOMER_CONSENT_SOURCE_LABELS, type CustomerResponse } from '@oficina/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/features/auth/permissions';
import { ServiceOrdersTable } from '@/features/service-orders/components/ServiceOrdersTable';
import { useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { SERVICE_ORDER_STATUS_LABELS } from '@/features/service-orders/state-machine';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { useAuthStore } from '@/stores/auth-store';
import { displayDocument, displayPhone, newServiceOrderHref, phoneDigits, whatsappHref } from '../format-customer';
import { useCustomerOverview } from '../hooks/use-customers';
import { CustomerFormModal } from './CustomerFormModal';

const HISTORY_PAGE_SIZE = 10;
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-card border border-border bg-card p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-text">{value}</p>{hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}</div>;
}

export function CustomerProfile({ customer }: { customer: CustomerResponse }) {
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'customers.manage');
  const overview = useCustomerOverview(customer.id);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const history = useServiceOrdersList({ customerId: customer.id, offset, limit: HISTORY_PAGE_SIZE });
  const data = overview.data;
  const money = data?.money;
  const phone = phoneDigits(customer.phone);
  const hasPending = Boolean(data && (data.openServiceOrders.length > 0 || (money?.pendingCents ?? 0) > 0));

  return <div className="flex flex-col gap-5">
    <Link href="/clientes" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" /> Voltar para clientes</Link>

    <header className="flex flex-wrap items-start justify-between gap-4 rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-text">{customer.name}</h1><Badge variant="outline">{customer.type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}</Badge></div>
        <p className="mt-1 text-sm text-text-muted">{[customer.document ? displayDocument(customer.document) : undefined, displayPhone(customer.phone), customer.email].filter(Boolean).join(' · ')}</p>
        {customer.careMessagesEnabled && <p className="mt-1 text-xs text-text-muted">Autorizou lembretes de cuidado{customer.careConsentAt ? ` em ${new Date(customer.careConsentAt).toLocaleDateString('pt-BR')}` : ''}{customer.careConsentSource ? ` · ${CUSTOMER_CONSENT_SOURCE_LABELS[customer.careConsentSource].toLowerCase()}` : ''}.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {phone.length >= 10 && <Button variant="outline" asChild><a href={whatsappHref(customer.phone)} target="_blank" rel="noopener noreferrer"><ChatCircleDots className="size-4" aria-hidden="true" />WhatsApp</a></Button>}
        {phone.length >= 8 && <Button variant="outline" asChild><a href={`tel:${phone}`}><Phone className="size-4" aria-hidden="true" />Ligar</a></Button>}
        {canManage && <Button variant="outline" onClick={() => setEditing(true)}><PencilSimple className="size-4" aria-hidden="true" />Editar</Button>}
        {canManage && <Button asChild><Link href={newServiceOrderHref(customer)}><ClipboardText className="size-4" aria-hidden="true" />Nova OS</Link></Button>}
      </div>
    </header>

    {overview.isLoading && <div role="status" aria-label="Carregando resumo do cliente" className="h-24 animate-pulse rounded-card bg-surface" />}
    {overview.isError && <div className="rounded-card border border-danger/30 bg-danger-subtle p-4 text-sm text-danger-strong">Não foi possível carregar o resumo deste cliente. <button type="button" className="font-semibold underline" onClick={() => overview.refetch()}>Tentar novamente</button></div>}

    {data && <>
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ordens de serviço" value={String(data.orderCount)} hint={`${data.deliveredCount} entregue${data.deliveredCount === 1 ? '' : 's'}`} />
        <Stat label="Última visita" value={data.lastVisitAt ? new Date(data.lastVisitAt).toLocaleDateString('pt-BR') : '—'} hint={data.lastVisitAt ? undefined : 'Nenhuma OS entregue'} />
        {money && <Stat label="Total gasto" value={formatCurrencyBRL(money.totalSpentCents)} hint="OS entregues, com desconto" />}
        {money && <Stat label="Ticket médio" value={formatCurrencyBRL(money.averageTicketCents)} />}
      </section>

      {hasPending && <section aria-label="Pendências" className="rounded-card border border-warning/30 bg-warning-subtle p-4">
        <h2 className="text-sm font-bold text-text">Pendências</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.openServiceOrders.map((order) => <li key={order.id}><Link href={`/ordens-de-servico/${order.id}`} className="font-semibold text-primary hover:underline">OS #{order.orderNumber}</Link> · {SERVICE_ORDER_STATUS_LABELS[order.status as keyof typeof SERVICE_ORDER_STATUS_LABELS] ?? order.status} · {order.vehicleLabel}</li>)}
          {money && money.pendingCents > 0 && <li><strong>{formatCurrencyBRL(money.pendingCents)}</strong> a receber</li>}
        </ul>
      </section>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Veículos" className="rounded-card border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-text"><CarProfile className="size-4" aria-hidden="true" />Veículos ({data.vehicles.length})</h2>
          {data.vehicles.length === 0 && <p className="mt-3 text-sm text-text-muted">Nenhum veículo cadastrado para este cliente.</p>}
          <ul className="mt-3 divide-y divide-border">
            {data.vehicles.map((vehicle) => <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div><p className="font-semibold text-text">{vehicle.brand} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ''}</p><p className="text-xs text-text-muted">{vehicle.plate}{vehicle.mileage ? ` · ${vehicle.mileage.toLocaleString('pt-BR')} km` : ''}</p></div>
              {canManage && <Button variant="outline" size="sm" asChild><Link href={newServiceOrderHref(customer, { id: vehicle.id, label: `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` })}><Plus className="size-3.5" aria-hidden="true" />Nova OS</Link></Button>}
            </li>)}
          </ul>
        </section>

        <section aria-label="Próximos agendamentos" className="rounded-card border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold text-text">Próximos agendamentos</h2>
          {data.upcomingAppointments.length === 0 && <p className="mt-3 text-sm text-text-muted">Nenhum agendamento futuro.</p>}
          <ul className="mt-3 divide-y divide-border">
            {data.upcomingAppointments.map((appointment) => <li key={appointment.id} className="py-2.5"><p className="font-semibold text-text">{dateTime(appointment.startsAt)}</p><p className="text-xs text-text-muted">{appointment.serviceDescription}</p></li>)}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2" asChild><Link href="/agenda">Abrir a agenda</Link></Button>
        </section>
      </div>
    </>}

    <section aria-label="Histórico de ordens de serviço" className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text">Histórico de ordens de serviço</h2>
      <ServiceOrdersTable items={history.data?.items ?? []} isLoading={history.isLoading} isError={history.isError} onRetry={() => history.refetch()} emptyMessage="Nenhuma ordem de serviço ainda para este cliente." />
      {history.data && history.data.total > HISTORY_PAGE_SIZE && <div className="flex items-center justify-between text-sm text-text-muted"><span>{history.data.total} ordens de serviço no total</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - HISTORY_PAGE_SIZE))}>Anterior</Button><Button variant="outline" size="sm" disabled={!history.data.hasMore} onClick={() => setOffset(offset + HISTORY_PAGE_SIZE)}>Próxima</Button></div></div>}
    </section>

    {customer.notes && <section aria-label="Observações" className="rounded-card border border-border bg-card p-5 shadow-sm"><h2 className="text-sm font-bold text-text">Observações internas</h2><p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{customer.notes}</p></section>}

    <CustomerFormModal open={editing} onOpenChange={setEditing} customer={customer} />
  </div>;
}
