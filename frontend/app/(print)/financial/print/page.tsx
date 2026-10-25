'use client';

import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { FinancialPrintDocument } from '@/features/financial/components/FinancialPrintDocument';
import { FinancialAnalyticalPrintDocument } from '@/features/financial/components/FinancialAnalyticalPrintDocument';
import { reportFiltersFromParams, reportRequest } from '@/features/financial/financial-report';
import { useCashFlow } from '@/features/financial/hooks/use-financial';
import { useBranding } from '@/features/settings/hooks/use-settings';

function FinancialPrintContent() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'analytical' ? 'analytical' : params.get('mode') === 'transactions' ? 'transactions' : 'report';
  const user = useAuthStore(state => state.user);
  const canView = hasPermission(user, 'finance.view');
  const filters = reportFiltersFromParams(params);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month') ?? '') ? params.get('month')! : new Date().toISOString().slice(0, 7);
  const startAt = `${month}-01T00:00:00.000Z`; const end = new Date(startAt); end.setUTCMonth(end.getUTCMonth() + 1);
  const request = mode === 'analytical' ? reportRequest(filters) : { startAt, endAt: end.toISOString() };
  const flow = useCashFlow(request ?? { startAt: '', endAt: '' }, { enabled: canView && Boolean(request) });
  const branding = useBranding();
  return <AuthGuard><main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-100 px-4 py-6 print:min-h-0 print:bg-white print:p-0">
    {!canView ? <p role="alert" className="mx-auto max-w-4xl bg-white p-10 text-center">Seu perfil não possui acesso às informações financeiras.</p> : <>
      <div className={`print-hidden mx-auto mb-4 flex justify-between gap-3 ${mode === 'analytical' ? 'max-w-[297mm]' : 'max-w-4xl'}`}><Button variant="outline" onClick={() => window.close()}><ArrowLeft className="size-4" />Fechar</Button><Button disabled={!flow.data || flow.isFetching || !request || branding.isPending} onClick={() => window.print()}><Printer className="size-4" />Imprimir / salvar PDF</Button></div>
      {!request && <p role="alert" className="mx-auto max-w-4xl bg-white p-10 text-center text-danger">Período inválido. Confira as datas do relatório.</p>}
      {request && flow.isLoading && <div role="status" className="mx-auto h-96 max-w-4xl animate-pulse bg-white" />}
      {request && flow.data && (mode === 'analytical' ? <div className="overflow-x-auto print:overflow-visible"><FinancialAnalyticalPrintDocument data={flow.data} filters={filters} company={branding.data?.company} /></div> : <FinancialPrintDocument data={flow.data} mode={mode} month={month} company={branding.data?.company} />)}
      {flow.isError && <p role="alert" className="mx-auto max-w-4xl bg-white p-10 text-center text-danger">Não foi possível carregar os dados para impressão.</p>}
    </>}
  </main></AuthGuard>;
}

export default function FinancialPrintPage() {
  return (
    <Suspense fallback={<main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-100 print:bg-white" />}>
      <FinancialPrintContent />
    </Suspense>
  );
}
