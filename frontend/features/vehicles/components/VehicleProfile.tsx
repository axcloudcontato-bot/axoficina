'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowsLeftRight, ClipboardText, PencilSimple } from '@phosphor-icons/react';
import { formatPlate, type CareServiceKey, type VehicleResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/features/auth/permissions';
import { useEntitlements } from '@/features/plan/use-entitlements';
import { CareServiceDialog } from '@/features/customer-care/CareServiceDialog';
import { newServiceOrderHref } from '@/features/customers/format-customer';
import { ServiceOrdersTable } from '@/features/service-orders/components/ServiceOrdersTable';
import { useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { SERVICE_ORDER_STATUS_LABELS } from '@/features/service-orders/state-machine';
import { useAuthStore } from '@/stores/auth-store';
import { useVehicleOverview } from '../hooks/use-vehicles';
import { TransferVehicleDialog } from './TransferVehicleDialog';
import { VehicleFormModal } from './VehicleFormModal';

const HISTORY_PAGE_SIZE = 10;
const day = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const km = (value: number) => `${value.toLocaleString('pt-BR')} km`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-card border border-border bg-card p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-text">{value}</p>{hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}</div>;
}

export function VehicleProfile({ vehicle }: { vehicle: VehicleResponse }) {
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'vehicles.manage');
  const overview = useVehicleOverview(vehicle.id);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  // Registering a care already done (also the way to correct a deadline for this car). Needs the care permission.
  const { hasModule } = useEntitlements();
  const canRecordCare = hasPermission(user, 'alerts.manage') && hasModule('cuidado');
  const [recording, setRecording] = useState<{ serviceKey?: CareServiceKey } | undefined>();
  const history = useServiceOrdersList({ vehicleId: vehicle.id, offset, limit: HISTORY_PAGE_SIZE });
  const data = overview.data;
  const owner = { id: vehicle.customerId, name: vehicle.customerName };
  const label = `${vehicle.brand} ${vehicle.model} · ${formatPlate(vehicle.plate)}`;
  const details = [vehicle.year, vehicle.color, vehicle.engine, vehicle.fuelType].filter(Boolean).join(' · ');

  return <div className="flex flex-col gap-5">
    <Link href="/veiculos" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" /> Voltar para veículos</Link>

    <header className="flex flex-wrap items-start justify-between gap-4 rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-text">{vehicle.brand} {vehicle.model}</h1>
        <p className="mt-1 text-lg font-semibold tabular-nums text-text">{formatPlate(vehicle.plate)}</p>
        {details && <p className="mt-1 text-sm text-text-muted">{details}</p>}
        <p className="mt-1 text-sm text-text-muted">Dono: <Link href={`/clientes/${vehicle.customerId}`} className="font-semibold text-primary hover:underline">{vehicle.customerName}</Link>{vehicle.chassis ? ` · Chassi ${vehicle.chassis}` : ''}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canManage && <Button variant="outline" onClick={() => setEditing(true)}><PencilSimple className="size-4" aria-hidden="true" />Editar</Button>}
        {canManage && <Button variant="outline" onClick={() => setTransferring(true)}><ArrowsLeftRight className="size-4" aria-hidden="true" />Transferir dono</Button>}
        {canManage && <Button asChild><Link href={newServiceOrderHref(owner, { id: vehicle.id, label })}><ClipboardText className="size-4" aria-hidden="true" />Nova OS</Link></Button>}
      </div>
    </header>

    {overview.isLoading && <div role="status" aria-label="Carregando resumo do veículo" className="h-24 animate-pulse rounded-card bg-surface" />}
    {overview.isError && <div className="rounded-card border border-danger/30 bg-danger-subtle p-4 text-sm text-danger-strong">Não foi possível carregar o resumo deste veículo. <button type="button" className="font-semibold underline" onClick={() => overview.refetch()}>Tentar novamente</button></div>}

    {data && <>
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Quilometragem" value={vehicle.mileage != null ? km(vehicle.mileage) : '—'} hint={vehicle.mileage != null ? undefined : 'Ainda não informada'} />
        <Stat label="Ordens de serviço" value={String(data.orderCount)} hint={`${data.deliveredCount} entregue${data.deliveredCount === 1 ? '' : 's'}`} />
        <Stat label="Última visita" value={data.lastVisitAt ? day(data.lastVisitAt) : '—'} hint={data.lastVisitAt ? undefined : 'Nenhuma OS entregue'} />
        <Stat label="Em andamento" value={String(data.openServiceOrders.length)} />
      </section>

      {data.openServiceOrders.length > 0 && <section aria-label="Em andamento" className="rounded-card border border-warning/30 bg-warning-subtle p-4">
        <h2 className="text-sm font-bold text-text">Em andamento na oficina</h2>
        <ul className="mt-2 space-y-1 text-sm">{data.openServiceOrders.map((order) => <li key={order.id}><Link href={`/ordens-de-servico/${order.id}`} className="font-semibold text-primary hover:underline">OS #{order.orderNumber}</Link> · {SERVICE_ORDER_STATUS_LABELS[order.status as keyof typeof SERVICE_ORDER_STATUS_LABELS] ?? order.status}</li>)}</ul>
      </section>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Próximos cuidados" className="rounded-card border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-text">Próximos cuidados</h2>{canRecordCare && <Button variant="outline" size="sm" onClick={() => setRecording({})}>Registrar cuidado feito</Button>}</div>
          {data.care.length === 0 && <p className="mt-3 text-sm text-text-muted">Nenhum cuidado programado. Eles aparecem quando uma OS entregue tem serviços marcados com o próximo retorno.</p>}
          <ul className="mt-3 divide-y divide-border">
            {data.care.map((item) => <li key={item.serviceKey} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div><p className="font-semibold text-text">{item.serviceName}</p><p className="text-xs text-text-muted">Último em {day(item.completedAt)}{item.dueMileage ? ` · previsto também aos ${km(item.dueMileage)}` : ''}</p></div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.overdue ? 'bg-danger-subtle text-danger' : 'bg-muted text-text'}`}>{item.overdue ? `Venceu em ${day(item.dueAt)}` : `Até ${day(item.dueAt)}`}</span>{canRecordCare && <Button variant="ghost" size="sm" aria-label={`Registrar ${item.serviceName} feito`} onClick={() => setRecording({ serviceKey: item.serviceKey as CareServiceKey })}>Feito</Button>}</div>
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

      {data.mileageHistory.length > 0 && <section aria-label="Quilometragem pelas OS" className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-bold text-text">Quilometragem registrada nas OS</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {data.mileageHistory.map((reading) => <li key={reading.orderNumber} className="flex justify-between gap-3 py-2"><span className="text-text-muted">{day(reading.at)} · OS #{reading.orderNumber}</span><span className="font-semibold tabular-nums text-text">{km(reading.mileage)}</span></li>)}
        </ul>
      </section>}
    </>}

    <section aria-label="Histórico de ordens de serviço" className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text">Histórico de ordens de serviço</h2>
      <ServiceOrdersTable items={history.data?.items ?? []} isLoading={history.isLoading} isError={history.isError} onRetry={() => history.refetch()} emptyMessage="Nenhuma ordem de serviço ainda para este veículo." />
      {history.data && history.data.total > HISTORY_PAGE_SIZE && <div className="flex items-center justify-between text-sm text-text-muted"><span>{history.data.total} ordens de serviço no total</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - HISTORY_PAGE_SIZE))}>Anterior</Button><Button variant="outline" size="sm" disabled={!history.data.hasMore} onClick={() => setOffset(offset + HISTORY_PAGE_SIZE)}>Próxima</Button></div></div>}
    </section>

    {canRecordCare && <CareServiceDialog open={Boolean(recording)} onOpenChange={(next) => { if (!next) setRecording(undefined); }} vehicle={{ id: vehicle.id, label }} defaultServiceKey={recording?.serviceKey} />}
    <VehicleFormModal open={editing} onOpenChange={setEditing} vehicle={vehicle} />
    {canManage && <TransferVehicleDialog vehicle={vehicle} open={transferring} onOpenChange={setTransferring} />}
  </div>;
}
