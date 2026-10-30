import { limitStatus, type LimitKind, type LimitStatus, type PlanStatusResponse } from '@oficina/contracts';

export interface UsageRow { kind: LimitKind; label: string; used: number; limit: number | null; unit: string; status: LimitStatus }

const gb = (mb: number) => (mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function usageRows(plan: PlanStatusResponse): UsageRow[] {
  const { usage, limits } = plan;
  return [
    { kind: 'users', label: 'Usuários', used: usage.users, limit: limits.users, unit: '', status: limitStatus(usage.users, limits.users) },
    { kind: 'orders', label: 'Ordens de serviço neste mês', used: usage.ordersThisMonth, limit: limits.ordersPerMonth, unit: '', status: limitStatus(usage.ordersThisMonth, limits.ordersPerMonth) },
    { kind: 'photos', label: 'Fotos', used: usage.photoStorageMb, limit: limits.photoStorageMb, unit: 'GB', status: limitStatus(usage.photoStorageMb, limits.photoStorageMb) },
  ];
}

export function usageText(row: UsageRow): string {
  const format = (value: number) => (row.unit === 'GB' ? gb(value) : String(value));
  const suffix = row.unit ? ` ${row.unit}` : '';
  return row.limit === null ? `${format(row.used)}${suffix}, sem limite` : `${format(row.used)} de ${format(row.limit)}${suffix}`;
}
