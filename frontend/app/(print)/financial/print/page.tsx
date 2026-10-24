'use client';

import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { FinancialPrintDocument } from '@/features/financial/components/FinancialPrintDocument';
import { useCashFlow } from '@/features/financial/hooks/use-financial';
import { useBranding } from '@/features/settings/hooks/use-settings';

function FinancialPrintContent() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'transactions' ? 'transactions' : 'report';
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : new Date().toISOString().slice(0, 7);
  const startAt = `${month}-01T00:00:00.000Z`; const end = new Date(startAt); end.setUTCMonth(end.getUTCMonth() + 1);
  const flow = useCashFlow({ startAt, endAt: end.toISOString() });
  const branding = useBranding();
  return <AuthGuard><main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0"><div className="print-hidden mx-auto mb-4 flex max-w-4xl justify-between"><Button variant="outline" onClick={() => window.close()}><ArrowLeft className="size-4" />Fechar</Button><Button onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button></div>{flow.isLoading && <div className="mx-auto h-96 max-w-4xl animate-pulse bg-white" />}{flow.data && <FinancialPrintDocument data={flow.data} mode={mode} month={month} company={branding.data?.company} />}{flow.isError && <p className="mx-auto max-w-4xl bg-white p-10 text-center text-danger">Não foi possível carregar os dados para impressão.</p>}</main></AuthGuard>;
}

export default function FinancialPrintPage() {
  return (
    <Suspense fallback={<main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-100 print:bg-white" />}>
      <FinancialPrintContent />
    </Suspense>
  );
}
