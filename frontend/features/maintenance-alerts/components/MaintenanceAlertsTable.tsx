'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarBlank, ChatCircleDots, ClipboardText, Phone } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatPlate, MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS, MAINTENANCE_ALERT_DISMISS_REASON_LABELS, type MaintenanceAlertFilter, type MaintenanceAlertListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { newServiceOrderHref, phoneDigits, whatsappHref } from '@/features/customers/format-customer';
import { useBranding } from '@/features/settings/hooks/use-settings';
import { extractErrorMessage } from '@/lib/api/client';
import { useReopenMaintenanceAlert, useResolveMaintenanceAlert } from '../hooks/use-maintenance-alerts';
import { DismissAlertDialog, SnoozeAlertDialog } from './MaintenanceAlertActionDialogs';
import { ContactAlertDialog } from './MaintenanceAlertContactDialog';

interface MaintenanceAlertsTableProps {
  items: MaintenanceAlertListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Which list this is: it decides the columns and the actions. */
  filter?: MaintenanceAlertFilter;
  /** Only people who may manage alerts get the buttons; the others just read. */
  canManage?: boolean;
  /** A search is active, so an empty list means "nothing matched". */
  searching?: boolean;
}

const EMPTY_MESSAGES: Record<MaintenanceAlertFilter, string> = {
  OPEN: 'Nenhum veículo devendo revisão no momento.',
  SNOOZED: 'Nenhum alerta adiado.',
  RESOLVED: 'Nenhum alerta resolvido ainda.',
  DISMISSED: 'Nenhum alerta dispensado.',
};

const day = (value: string) => new Date(value).toLocaleDateString('pt-BR');

function monthsLabel(months: number): string {
  return months === 1 ? '1 mês' : `${months} meses`;
}

// The message the team can send in one click; it is only a start, the person reads and edits it in WhatsApp.
function reminderMessage(alert: MaintenanceAlertListItemResponse, workshop?: string): string {
  const first = alert.customerName.trim().split(/\s+/)[0];
  const since = alert.monthsOverdue === 1 ? 'cerca de 1 mês' : `cerca de ${alert.monthsOverdue} meses`;
  return `Olá, ${first}! ${workshop ? `Aqui é da ${workshop}. ` : ''}Faz ${since} que o seu ${alert.vehicleBrand} ${alert.vehicleModel} não passa por uma revisão com a gente. Que tal agendar um horário para conferir tudo?`;
}

// What the list says about each alert's situation, depending on which list it is.
function situation(alert: MaintenanceAlertListItemResponse, filter: MaintenanceAlertFilter): React.ReactNode {
  if (filter === 'SNOOZED') return alert.snoozedUntil ? `Volta em ${day(alert.snoozedUntil)}` : '—';
  if (filter === 'RESOLVED') {
    if (!alert.resolvedAt) return '—';
    return alert.resolvedByName ? `Resolvido em ${day(alert.resolvedAt)} por ${alert.resolvedByName}` : `Resolvido em ${day(alert.resolvedAt)} pela entrega de uma OS`;
  }
  if (filter === 'DISMISSED') {
    return <>
      <span className="font-semibold text-text">{alert.dismissReason ? MAINTENANCE_ALERT_DISMISS_REASON_LABELS[alert.dismissReason] : 'Dispensado'}</span>
      {alert.resolvedAt && <span> · {day(alert.resolvedAt)}{alert.resolvedByName ? ` por ${alert.resolvedByName}` : ''}</span>}
      {alert.dismissNote && <span className="block text-xs">{alert.dismissNote}</span>}
    </>;
  }
  return null;
}

export function MaintenanceAlertsTable({ items, isLoading, isError, onRetry, filter = 'OPEN', canManage = true, searching = false }: MaintenanceAlertsTableProps) {
  const resolveAlert = useResolveMaintenanceAlert();
  const reopenAlert = useReopenMaintenanceAlert();
  const [snoozing, setSnoozing] = useState<MaintenanceAlertListItemResponse>();
  const [dismissing, setDismissing] = useState<MaintenanceAlertListItemResponse>();
  const [contacting, setContacting] = useState<MaintenanceAlertListItemResponse>();
  const workshop = useBranding().data?.company?.name;

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando alertas de manutenção" className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-sm text-danger">Não foi possível carregar os alertas de manutenção.</p>
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">
        {searching ? 'Nenhum alerta encontrado para essa busca. Confira a placa, o modelo ou o nome do cliente.' : EMPTY_MESSAGES[filter]}
      </div>
    );
  }

  const open = filter === 'OPEN' || filter === 'SNOOZED';
  const showSituation = filter !== 'OPEN';

  function handleResolve(id: string) {
    resolveAlert.mutate(
      { id },
      {
        onSuccess: () => toast.success('Alerta marcado como resolvido.'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  function handleReopen(id: string) {
    reopenAlert.mutate(
      { id },
      {
        onSuccess: () => toast.success('Alerta reaberto. Ele voltou para "Devendo revisão".'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Veículo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Devendo há</TableHead>
              {open && <TableHead>Último contato</TableHead>}
              {showSituation && <TableHead>Situação</TableHead>}
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell className="font-medium text-text">
                  <Link href={`/veiculos/${alert.vehicleId}`} className="hover:text-primary hover:underline">
                    {alert.vehicleBrand} {alert.vehicleModel} · {formatPlate(alert.vehiclePlate)}
                  </Link>
                </TableCell>
                <TableCell className="text-text-muted">
                  <Link href={`/clientes/${alert.customerId}`} className="hover:text-primary hover:underline">
                    {alert.customerName}
                  </Link>
                  {alert.customerCareEnabled === false && <span title="Este cliente não autorizou os lembretes automáticos: o contato precisa ser feito pela equipe." className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-text">Contato manual</span>}
                </TableCell>
                <TableCell className="text-text-muted">
                  {monthsLabel(alert.monthsOverdue)}
                  {alert.overdueCare.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{alert.overdueCare.slice(0, 3).map((care) => <span key={care.serviceName} title={care.reason === 'KM' ? 'Passou da quilometragem prevista' : 'Passou do prazo'} className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-danger">{care.serviceName} vencido{care.reason === 'KM' ? ' (km)' : ''}</span>)}{alert.overdueCare.length > 3 && <span className="text-xs">+{alert.overdueCare.length - 3}</span>}</span>}
                </TableCell>
                {open && <TableCell className="text-xs text-text-muted">{alert.lastContact ? <><span className="font-semibold text-text">{MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS[alert.lastContact.outcome]}</span> · {day(alert.lastContact.at)}{alert.lastContact.byName ? ` · ${alert.lastContact.byName}` : ''}{alert.contactCount > 1 ? ` · ${alert.contactCount} tentativas` : ''}</> : 'Ninguém contatou'}</TableCell>}
                {showSituation && <TableCell className="text-text-muted">{situation(alert, filter)}</TableCell>}
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {open && alert.status === 'OPEN' && (
                        <>
                          {alert.customerPhone && phoneDigits(alert.customerPhone).length >= 10 && <Button size="icon" variant="ghost" asChild aria-label={`WhatsApp de ${alert.customerName}`}><a href={`${whatsappHref(alert.customerPhone)}?text=${encodeURIComponent(reminderMessage(alert, workshop))}`} target="_blank" rel="noopener noreferrer"><ChatCircleDots className="size-4" aria-hidden="true" /></a></Button>}
                          {alert.customerPhone && phoneDigits(alert.customerPhone).length >= 8 && <Button size="icon" variant="ghost" asChild aria-label={`Ligar para ${alert.customerName}`}><a href={`tel:${phoneDigits(alert.customerPhone)}`}><Phone className="size-4" aria-hidden="true" /></a></Button>}
                          <Button size="icon" variant="ghost" asChild aria-label={`Agendar ${alert.vehiclePlate}`}><Link href={`/agenda?${new URLSearchParams({ cliente: alert.customerId, nome: alert.customerName, veiculo: alert.vehicleId, servico: 'Revisão' }).toString()}`}><CalendarBlank className="size-4" aria-hidden="true" /></Link></Button>
                          <Button size="icon" variant="ghost" asChild aria-label={`Nova OS para ${alert.vehiclePlate}`}><Link href={newServiceOrderHref({ id: alert.customerId, name: alert.customerName }, { id: alert.vehicleId, label: `${alert.vehicleBrand} ${alert.vehicleModel} · ${formatPlate(alert.vehiclePlate)}` })}><ClipboardText className="size-4" aria-hidden="true" /></Link></Button>
                          <Button size="sm" variant="outline" onClick={() => setContacting(alert)}>Registrar contato</Button>
                          {filter === 'OPEN' && <Button size="sm" variant="outline" onClick={() => setSnoozing(alert)}>Adiar</Button>}
                          <Button size="sm" variant="outline" onClick={() => setDismissing(alert)}>Dispensar</Button>
                          <Button size="sm" variant="outline" disabled={resolveAlert.isPending} onClick={() => handleResolve(alert.id)}>
                            Marcar como resolvido
                          </Button>
                        </>
                      )}
                      {/* Only what a person closed can come back: a delivery that resolved it by itself is final. */}
                      {(alert.status === 'DISMISSED' || (alert.status === 'RESOLVED' && alert.resolvedBy)) && (
                        <Button size="sm" variant="outline" disabled={reopenAlert.isPending} onClick={() => handleReopen(alert.id)}>
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <SnoozeAlertDialog alert={snoozing} onClose={() => setSnoozing(undefined)} />
      <DismissAlertDialog alert={dismissing} onClose={() => setDismissing(undefined)} />
      <ContactAlertDialog alert={contacting} onClose={() => setContacting(undefined)} />
    </>
  );
}
