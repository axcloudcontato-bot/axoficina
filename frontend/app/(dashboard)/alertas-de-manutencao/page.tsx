'use client';

import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { MaintenanceAlertFilter } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { segmentedItem, segmentedList } from '@/components/ui/segmented';
import { hasPermission } from '@/features/auth/permissions';
import { MaintenanceAlertsTable } from '@/features/maintenance-alerts/components/MaintenanceAlertsTable';
import { useMaintenanceAlertsList } from '@/features/maintenance-alerts/hooks/use-maintenance-alerts';
import { useMaintenanceAlertMonths, useUpdateMaintenanceAlertMonths } from '@/features/settings/hooks/use-settings';
import { extractErrorMessage } from '@/lib/api/client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;

// Time since the last visit, in months: from (included) up to (not included).
const AGE_RANGES = [
  { value: '', label: 'Qualquer tempo', min: undefined, max: undefined },
  { value: '6-9', label: '6 a 9 meses', min: 6, max: 9 },
  { value: '9-12', label: '9 a 12 meses', min: 9, max: 12 },
  { value: '12+', label: 'Mais de 12 meses', min: 12, max: undefined },
] as const;

const TABS: Array<{ value: MaintenanceAlertFilter; label: string; summary: (total: number) => string }> = [
  { value: 'OPEN', label: 'Devendo revisão', summary: (total) => `${total} ${total === 1 ? 'veículo devendo revisão' : 'veículos devendo revisão'}` },
  { value: 'SNOOZED', label: 'Adiados', summary: (total) => `${total} ${total === 1 ? 'alerta adiado' : 'alertas adiados'}` },
  { value: 'RESOLVED', label: 'Resolvidos', summary: (total) => `${total} ${total === 1 ? 'alerta resolvido' : 'alertas resolvidos'}` },
  { value: 'DISMISSED', label: 'Dispensados', summary: (total) => `${total} ${total === 1 ? 'alerta dispensado' : 'alertas dispensados'}` },
];

export default function MaintenanceAlertsPage() {
  const user = useAuthStore((state) => state.user);
  // The mechanic can see who is due, but not close alerts. The backend is the source of truth (`alerts.manage`).
  const canManage = hasPermission(user, 'alerts.manage');

  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<MaintenanceAlertFilter>('OPEN');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [age, setAge] = useState<(typeof AGE_RANGES)[number]['value']>('');
  const [contact, setContact] = useState<'' | 'NEVER' | 'CONTACTED'>('');
  const months = useMaintenanceAlertMonths();
  const updateMonths = useUpdateMaintenanceAlertMonths();
  const [monthsText, setMonthsText] = useState<string>();
  const canConfigure = hasPermission(user, 'settings.manage');
  const range = AGE_RANGES.find((item) => item.value === age) ?? AGE_RANGES[0];
  // The filters narrow the lists of cars that are due; the history tabs keep their own order.
  const narrowing = status === 'OPEN' || status === 'SNOOZED';

  const { data, isLoading, isError, refetch } = useMaintenanceAlertsList({ offset, limit: PAGE_SIZE, status, search: search || undefined, ...(narrowing && range.min ? { minMonths: range.min } : {}), ...(narrowing && range.max ? { maxMonths: range.max } : {}), ...(narrowing && contact ? { contact } : {}) });
  const tab = TABS.find((item) => item.value === status) ?? TABS[0];

  function saveMonths() {
    const text = monthsText;
    setMonthsText(undefined);
    if (text === undefined) return;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 36) return void toast.error('Informe um número de meses entre 1 e 36.');
    if (value === months) return;
    updateMonths.mutate({ months: value }, {
      onSuccess: () => toast.success(`Pronto: os carros passam a aparecer após ${value} ${value === 1 ? 'mês' : 'meses'} sem revisão. A lista se atualiza na próxima varredura diária.`),
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Situação dos alertas" className={segmentedList}>
          {TABS.map((item) => (
            <button key={item.value} role="tab" aria-selected={status === item.value} onClick={() => { setStatus(item.value); setOffset(0); }} className={segmentedItem(status === item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input aria-label="Buscar alertas" placeholder="Buscar por placa, modelo ou cliente..." value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setOffset(0); }} className="pl-9" />
        </div>
      </div>

      {narrowing && <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Tempo sem visita" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={age} onChange={(event) => { setAge(event.target.value as typeof age); setOffset(0); }}>{AGE_RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select aria-label="Situação do contato" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={contact} onChange={(event) => { setContact(event.target.value as typeof contact); setOffset(0); }}><option value="">Todos, contatados ou não</option><option value="NEVER">Ainda sem contato</option><option value="CONTACTED">Já contatados</option></select>
      </div>}

      {canConfigure && <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-sm">
        <span>Um carro aparece aqui depois de</span>
        {monthsText !== undefined
          ? <Input autoFocus aria-label="Meses sem revisão" inputMode="numeric" className="h-9 w-20 text-right" value={monthsText} onChange={(event) => setMonthsText(event.target.value)} onBlur={saveMonths} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setMonthsText(undefined); }} />
          : <button type="button" aria-label="Alterar meses sem revisão" onClick={() => setMonthsText(String(months))} className="rounded-button px-2 py-1 font-bold tabular-nums hover:bg-muted">{months} {months === 1 ? 'mês' : 'meses'}</button>}
        <span>sem OS entregue.</span>
      </div>}

      {data && !isLoading && <p className="text-sm font-semibold text-text">{tab.summary(data.total)}{search ? ' para essa busca' : ''}</p>}

      <MaintenanceAlertsTable items={data?.items ?? []} isLoading={isLoading} isError={isError} onRetry={refetch} filter={status} canManage={canManage} searching={Boolean(search) || (narrowing && Boolean(age || contact))} />

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{data.total} alertas no total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
