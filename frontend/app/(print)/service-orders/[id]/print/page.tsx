'use client';

import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { ServiceOrderPrintDocument, type ServiceOrderPrintMode } from '@/features/service-orders/components/ServiceOrderPrintDocument';
import { useServiceOrder } from '@/features/service-orders/hooks/use-service-orders';
import { useBranding } from '@/features/settings/hooks/use-settings';

export default function ServiceOrderPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const mode: ServiceOrderPrintMode = searchParams.get('mode') === 'full' ? 'full' : 'summary';
  const { data, isLoading, isError } = useServiceOrder(params.id);
  const branding = useBranding();

  return (
    <AuthGuard>
      <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
        <div className="print-hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
          <Button variant="outline" onClick={() => window.close()}><ArrowLeft className="mr-2 size-4" />Fechar</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 size-4" />Imprimir {mode === 'full' ? 'versão completa' : 'resumo'}</Button>
        </div>
        {isLoading && <div className="mx-auto h-96 max-w-4xl animate-pulse rounded-card bg-white" />}
        {(isError || (!isLoading && !data)) && <div className="mx-auto max-w-4xl bg-white p-10 text-center text-sm font-semibold text-red-700">Não foi possível carregar a ordem de serviço para impressão.</div>}
        {data && <ServiceOrderPrintDocument serviceOrder={data.serviceOrder} mode={mode} company={branding.data?.company} />}
      </main>
    </AuthGuard>
  );
}
