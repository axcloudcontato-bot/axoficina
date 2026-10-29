'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { VehicleProfile } from '@/features/vehicles/components/VehicleProfile';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicles';

export default function VehicleProfilePage() {
  const params = useParams<{ id: string }>();
  const query = useVehicle(params.id);
  if (query.isLoading) return <div role="status" aria-label="Carregando veículo" className="h-56 animate-pulse rounded-card bg-surface" />;
  if (query.isError || !query.data) {
    return <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center"><p className="text-sm font-semibold text-danger-strong">Não foi possível carregar este veículo. Ele pode ter sido arquivado.</p><div className="mt-3 flex justify-center gap-2"><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button><Button variant="outline" asChild><Link href="/veiculos">Voltar para veículos</Link></Button></div></div>;
  }
  return <VehicleProfile key={params.id} vehicle={query.data.vehicle} />;
}
