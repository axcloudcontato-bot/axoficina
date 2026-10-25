import type { SubscriptionStatus } from '@oficina/contracts';
import type { BadgeProps } from '@/components/ui/badge';

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, { label: string; variant: BadgeProps['variant'] }> = {
  unconfigured: { label: 'Não configurada', variant: 'neutral' },
  trial: { label: 'Em teste', variant: 'info' },
  active: { label: 'Ativa', variant: 'success' },
  past_due: { label: 'Inadimplente', variant: 'attention' },
  canceled: { label: 'Cancelada', variant: 'critical' },
};

export const CYCLE_LABELS = { monthly: 'Mensal', yearly: 'Anual' } as const;

export function formatSubscriptionDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value)) : 'Não definido';
}
