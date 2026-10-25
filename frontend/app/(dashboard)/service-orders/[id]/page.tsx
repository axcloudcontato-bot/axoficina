'use client';

import { useParams } from 'next/navigation';
import { ServiceOrderWorkspace } from '@/features/service-orders/components/ServiceOrderWorkspace';
import { useServiceOrder } from '@/features/service-orders/hooks/use-service-orders';
import { Button } from '@/components/ui/button';

export default function ServiceOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const query = useServiceOrder(params.id, { refetchInterval: 10_000 });
  if (query.isLoading) return <div role="status" aria-label="Carregando atendimento" className="h-56 animate-pulse rounded-card bg-surface" />;
  if (query.isError || !query.data) return <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center"><p className="text-sm font-semibold text-danger-strong">Não foi possível carregar este atendimento.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  return <ServiceOrderWorkspace key={params.id} serviceOrder={query.data.serviceOrder} />;
}