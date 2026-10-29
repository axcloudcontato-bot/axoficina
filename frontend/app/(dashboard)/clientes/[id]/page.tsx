'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CustomerProfile } from '@/features/customers/components/CustomerProfile';
import { useCustomer } from '@/features/customers/hooks/use-customers';

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const query = useCustomer(params.id);
  if (query.isLoading) return <div role="status" aria-label="Carregando cliente" className="h-56 animate-pulse rounded-card bg-surface" />;
  if (query.isError || !query.data) {
    return <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center"><p className="text-sm font-semibold text-danger-strong">Não foi possível carregar este cliente. Ele pode ter sido arquivado.</p><div className="mt-3 flex justify-center gap-2"><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button><Button variant="outline" asChild><Link href="/clientes">Voltar para clientes</Link></Button></div></div>;
  }
  return <CustomerProfile key={params.id} customer={query.data.customer} />;
}
