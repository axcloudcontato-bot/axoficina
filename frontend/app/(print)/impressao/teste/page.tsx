'use client';

import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { isThermal, pageStyle, parsePaperFormat, THERMAL_FONT_PX, THERMAL_PRINTABLE_WIDTH_MM, useBrowserPrintPreferences } from '@/features/printing/print-preferences';

// Calibration sheet: rulers on every edge show whether the printer cuts anything off.
export default function PrintTestPage() {
  return <Suspense fallback={null}><PrintTestSheet /></Suspense>;
}

function PrintTestSheet() {
  const searchParams = useSearchParams();
  const preferences = useBrowserPrintPreferences();
  const format = parsePaperFormat(searchParams.get('formato')) ?? preferences.serviceOrderFormat;
  const marks = Array.from({ length: 11 }, (_, index) => index);
  return <>
    <style>{pageStyle(format, preferences)}</style>
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <div className="print-hidden mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3"><Button variant="outline" onClick={() => window.close()}><ArrowLeft className="mr-2 size-4" />Fechar</Button><Button onClick={() => window.print()}><Printer className="mr-2 size-4" />Imprimir teste</Button></div>
      {isThermal(format)
        ? <article className="mx-auto bg-white font-mono text-black shadow-sm print:shadow-none" style={{ width: `${THERMAL_PRINTABLE_WIDTH_MM[format]}mm`, fontSize: `${THERMAL_FONT_PX[preferences.thermalFontSize]}px`, padding: '3mm 0' }}>
          <div className="flex justify-between border-x-2 border-black px-0.5"><span>|&lt;</span><span>LARGURA</span><span>&gt;|</span></div>
          <p className="mt-2 text-center font-bold">TESTE DE IMPRESSÃO</p>
          <p className="text-center">Bobina de {format === 'THERMAL_80' ? '80' : '58'} mm · margem {preferences.thermalMarginMm} mm</p>
          <hr className="my-2 border-0 border-t border-dashed border-black" />
          <p>As duas barras do topo devem aparecer inteiras. Se uma sumir, aumente a margem da bobina.</p>
          <p className="mt-2 tabular-nums">0123456789012345678901234567890123456789012345678</p>
          <p className="mt-2 text-[1.2em] font-bold">ÁÉÍÓÚ ÇÃÕ áéíóú çãõ R$ 1.234,56</p>
          <hr className="my-2 border-0 border-t border-dashed border-black" />
          <p className="text-center">Fim do teste</p>
        </article>
        : <article className="relative mx-auto aspect-[210/297] max-w-4xl border-2 border-black bg-white p-8 text-black shadow-sm print:aspect-auto print:h-[calc(297mm-2*var(--m))] print:max-w-none print:shadow-none" style={{ ['--m' as string]: `${preferences.a4MarginMm}mm` }}>
          <div className="flex justify-between text-xs">{marks.map((mark) => <span key={mark}>{mark * 10}</span>)}</div>
          <h1 className="mt-10 text-center text-3xl font-black">Teste de impressão A4</h1>
          <p className="mt-3 text-center">Margem configurada: {preferences.a4MarginMm} mm em cada lado.</p>
          <p className="mx-auto mt-6 max-w-xl text-center text-sm">A borda preta deve aparecer inteira nos quatro lados e tudo deve caber em uma única folha. Se a borda cortar, aumente a margem; se sair uma segunda folha em branco, diminua.</p>
          <p className="absolute bottom-6 left-0 right-0 text-center text-sm font-semibold">Rodapé: esta linha deve aparecer</p>
        </article>}
    </main>
  </>;
}
