'use client';

import { ArrowLeft, GearSix, Printer } from '@phosphor-icons/react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { isThermal, PAPER_FORMATS, pageStyle, parsePaperFormat, useBrowserPrintPreferences, usePrintPreferences, type PaperFormat } from '@/features/printing/print-preferences';
import { ThermalServiceOrderTicket } from '@/features/printing/ThermalServiceOrderTicket';
import { ServiceOrderPrintDocument, type ServiceOrderPrintMode } from '@/features/service-orders/components/ServiceOrderPrintDocument';
import { useServiceOrder } from '@/features/service-orders/hooks/use-service-orders';
import { useBranding } from '@/features/settings/hooks/use-settings';

const SHORT_LABELS: Record<PaperFormat, string> = { A4: 'A4', THERMAL_80: 'Térmica 80 mm', THERMAL_58: 'Térmica 58 mm' };

export default function ServiceOrderPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const mode: ServiceOrderPrintMode = searchParams.get('mode') === 'full' ? 'full' : 'summary';
  const { data, isLoading, isError } = useServiceOrder(params.id);
  const branding = useBranding();
  const preferences = useBrowserPrintPreferences();
  // No localStorage while rendering on the server: the persist API only exists in the browser.
  const [hydrated, setHydrated] = useState(() => usePrintPreferences.persist?.hasHydrated() ?? false);
  const [format, setFormat] = useState<PaperFormat | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    if (hydrated) return undefined;
    if (usePrintPreferences.persist?.hasHydrated()) { setHydrated(true); return undefined; }
    return usePrintPreferences.persist?.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  // The link may ask for a paper (?formato=80mm); otherwise this computer's choice applies.
  const activeFormat = format ?? parsePaperFormat(searchParams.get('formato')) ?? preferences.serviceOrderFormat;
  const ready = Boolean(data && hydrated && preferences.mounted && branding.data !== undefined);

  useEffect(() => {
    if (!ready || printed.current || !preferences.autoPrint) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [ready, preferences.autoPrint]);

  useEffect(() => {
    if (!preferences.closeAfterPrint) return;
    const close = () => window.setTimeout(() => window.close(), 300);
    window.addEventListener('afterprint', close);
    return () => window.removeEventListener('afterprint', close);
  }, [preferences.closeAfterPrint]);

  const thermal = isThermal(activeFormat);
  return (
    <AuthGuard>
      <style>{pageStyle(activeFormat, preferences)}</style>
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
        <div className="print-hidden mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => window.close()}><ArrowLeft className="mr-2 size-4" />Fechar</Button>
          <div role="group" aria-label="Papel" className="flex flex-wrap rounded-button border border-slate-300 bg-white p-0.5">
            {PAPER_FORMATS.map((option) => <button key={option} type="button" aria-pressed={activeFormat === option} onClick={() => setFormat(option)} className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold ${activeFormat === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-950'}`}>{SHORT_LABELS[option]}</button>)}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/configuracoes/impressao" target="_blank"><GearSix className="size-4" />Configurar</Link></Button>
            <Button onClick={() => window.print()} disabled={!data}><Printer className="mr-2 size-4" />Imprimir {thermal ? 'cupom' : mode === 'full' ? 'versão completa' : 'resumo'}</Button>
          </div>
        </div>
        {isLoading && <div className="mx-auto h-96 max-w-4xl animate-pulse rounded-card bg-white" />}
        {(isError || (!isLoading && !data)) && <div className="mx-auto max-w-4xl bg-white p-10 text-center text-sm font-semibold text-red-700">Não foi possível carregar a ordem de serviço para impressão.</div>}
        {data && (isThermal(activeFormat)
          ? <ThermalServiceOrderTicket serviceOrder={data.serviceOrder} company={branding.data?.company} defaults={branding.data?.orderDefaults} showPrices={!data.serviceOrder.amountsHidden} options={{ format: activeFormat, fontSize: preferences.thermalFontSize, copies: preferences.thermalCopies, showLogo: preferences.showLogo }} />
          : <ServiceOrderPrintDocument serviceOrder={data.serviceOrder} mode={mode} company={preferences.showLogo ? branding.data?.company : branding.data?.company && { ...branding.data.company, logoDataUrl: undefined }} defaults={branding.data?.orderDefaults} />)}
      </main>
    </AuthGuard>
  );
}
