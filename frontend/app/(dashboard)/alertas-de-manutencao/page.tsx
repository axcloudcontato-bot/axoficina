'use client';

import { useState } from 'react';
import type { MaintenanceAlertStatus } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaintenanceAlertsTable } from '@/features/maintenance-alerts/components/MaintenanceAlertsTable';
import { useMaintenanceAlertsList } from '@/features/maintenance-alerts/hooks/use-maintenance-alerts';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<MaintenanceAlertStatus, string> = {
  OPEN: 'Devendo revisão',
  RESOLVED: 'Resolvidos',
};

export default function MaintenanceAlertsPage() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<MaintenanceAlertStatus>('OPEN');

  const { data, isLoading, isError, refetch } = useMaintenanceAlertsList({ offset, limit: PAGE_SIZE, status });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as MaintenanceAlertStatus);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as MaintenanceAlertStatus[]).map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MaintenanceAlertsTable items={data?.items ?? []} isLoading={isLoading} isError={isError} onRetry={refetch} />

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
