'use client';

import { ArrowCounterClockwise, Printer } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isThermal, MARGIN_LIMITS, PAPER_FORMAT_LABELS, PAPER_FORMAT_QUERY, PAPER_FORMATS, useBrowserPrintPreferences, type PaperFormat, type ThermalFontSize } from './print-preferences';

const FONT_LABELS: Record<ThermalFontSize, string> = { small: 'Pequena', normal: 'Normal', large: 'Grande' };

export function PrintSettingsForm() {
  const preferences = useBrowserPrintPreferences();
  const thermal = isThermal(preferences.serviceOrderFormat);
  const openTest = (format: PaperFormat) => window.open(`/impressao/teste?formato=${PAPER_FORMAT_QUERY[format]}`, '_blank', 'noopener,noreferrer');

  return <div className="space-y-6">
    <p className="rounded-button bg-muted/60 px-4 py-3 text-sm text-text-muted">Estas escolhas valem só para <strong className="text-text">este computador e este navegador</strong>. Configure cada computador de acordo com a impressora ligada a ele: A4 no escritório, térmica no balcão. Elas são salvas na hora.</p>

    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Papel da ordem de serviço</h2>
      <p className="mt-1 text-sm text-text-muted">Usado ao imprimir a OS. Na tela de impressão também dá para trocar o papel só daquela vez.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{PAPER_FORMATS.map((format) => <label key={format} className={`flex cursor-pointer items-start gap-3 rounded-button border p-3 ${preferences.serviceOrderFormat === format ? 'border-primary bg-selection/20' : 'border-border'}`}>
        <input type="radio" name="paper" className="mt-1 size-4 accent-primary" checked={preferences.serviceOrderFormat === format} onChange={() => preferences.update({ serviceOrderFormat: format })} />
        <span><span className="block text-sm font-bold">{PAPER_FORMAT_LABELS[format]}</span><span className="mt-0.5 block text-xs text-text-muted">{format === 'A4' ? 'Duas vias por folha no resumo; versão completa com checklist.' : format === 'THERMAL_80' ? 'Cupom de 72 mm de largura útil. Padrão das impressoras de balcão.' : 'Cupom compacto de 48 mm úteis, para impressoras portáteis.'}</span></span>
      </label>)}</div>
    </section>

    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Ajustes do papel</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Margem da folha A4 (mm)" hint={`Entre ${MARGIN_LIMITS.A4.min} e ${MARGIN_LIMITS.A4.max}. Padrão 12.`}><Input type="number" min={MARGIN_LIMITS.A4.min} max={MARGIN_LIMITS.A4.max} value={preferences.a4MarginMm} onChange={(event) => preferences.update({ a4MarginMm: Number(event.target.value) })} /></Field>
        <Field label="Margem da bobina (mm)" hint={`Entre ${MARGIN_LIMITS.THERMAL.min} e ${MARGIN_LIMITS.THERMAL.max}. Padrão 2.`}><Input type="number" min={MARGIN_LIMITS.THERMAL.min} max={MARGIN_LIMITS.THERMAL.max} value={preferences.thermalMarginMm} onChange={(event) => preferences.update({ thermalMarginMm: Number(event.target.value) })} /></Field>
        <Field label="Letra do cupom"><select className="h-10 w-full rounded-button border border-input bg-card px-3 text-sm" value={preferences.thermalFontSize} onChange={(event) => preferences.update({ thermalFontSize: event.target.value as ThermalFontSize })}>{Object.entries(FONT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Vias do cupom" hint="Duas vias saem uma depois da outra, com corte entre elas."><select className="h-10 w-full rounded-button border border-input bg-card px-3 text-sm" value={preferences.thermalCopies} onChange={(event) => preferences.update({ thermalCopies: Number(event.target.value) as 1 | 2 })}><option value={1}>1 via</option><option value={2}>2 vias (oficina e cliente)</option></select></Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Toggle checked={preferences.showLogo} onChange={(showLogo) => preferences.update({ showLogo })} title="Imprimir a logo" description="Desligue se a logo sair borrada na térmica." />
        <Toggle checked={preferences.autoPrint} onChange={(autoPrint) => preferences.update({ autoPrint })} title="Abrir a impressão sozinha" description="Ao abrir o documento, a janela de impressão já aparece." />
        <Toggle checked={preferences.closeAfterPrint} onChange={(closeAfterPrint) => preferences.update({ closeAfterPrint })} title="Fechar depois de imprimir" description="Volta direto para a OS." />
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={preferences.reset}><ArrowCounterClockwise className="size-4" />Voltar ao padrão</Button>
        <div className="flex flex-wrap gap-2">{PAPER_FORMATS.map((format) => <Button key={format} variant={preferences.serviceOrderFormat === format ? 'default' : 'outline'} onClick={() => openTest(format)}><Printer className="size-4" />Página de teste {format === 'A4' ? 'A4' : format === 'THERMAL_80' ? '80 mm' : '58 mm'}</Button>)}</div>
      </div>
    </section>

    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Como ligar cada impressora</h2>
      <div className="mt-4 grid gap-4 text-sm lg:grid-cols-2">
        <Guide title="Impressora comum (USB ou de rede)">
          <li>Instale a impressora no Windows pelo programa do fabricante ou em Configurações → Bluetooth e dispositivos → Impressoras e scanners → Adicionar dispositivo.</li>
          <li>Impressora de rede: se ela não aparecer, use <em>Adicionar manualmente</em> e informe o endereço IP dela (está na página de configuração que a própria impressora imprime).</li>
          <li>No Ofix, escolha o papel A4 e, na janela de impressão, selecione a impressora. O navegador lembra a última usada.</li>
          <li>Na janela de impressão, deixe <em>Margens: padrão</em> e <em>Escala: padrão</em>. As margens certas já vêm do Ofix.</li>
        </Guide>
        <Guide title="Impressora térmica (cupom)">
          <li>Instale o driver do Windows do fabricante (Elgin, Bematech, Epson, Daruma, Tanca, Sweda e outras têm). Sem driver, o Windows não imprime nela.</li>
          <li>Nas preferências do driver, escolha o papel da bobina (80 mm ou 58 mm, comprimento contínuo) e, se houver, ligue o corte automático.</li>
          <li>Térmica de rede: adicione no Windows como impressora TCP/IP com o IP dela e a porta 9100, usando o mesmo driver.</li>
          <li>No Ofix, escolha a bobina neste computador e imprima a página de teste. Se cortar texto nas laterais, aumente a margem da bobina.</li>
        </Guide>
        <Guide title="Imprimir sem a janela de confirmação">
          <li>Defina a impressora certa como <em>padrão</em> no Windows.</li>
          <li>Crie um atalho do Chrome ou do Edge e, em Propriedades → Destino, acrescente ao final <code className="rounded bg-muted px-1">--kiosk-printing</code>.</li>
          <li>Abra o Ofix por esse atalho e ligue <em>Abrir a impressão sozinha</em> acima: o documento sai direto na impressora padrão, sem perguntar.</li>
          <li>Use esse atalho só no computador do balcão; nos demais, a janela de impressão continua útil para escolher a impressora.</li>
        </Guide>
        <Guide title="Se algo sair errado">
          <li>Texto cortado ou fora do papel: confira o tamanho do papel no driver e ajuste a margem aqui.</li>
          <li>Folha A4 com página em branco no fim: diminua a margem A4 para 10 mm.</li>
          <li>Cupom muito comprido com espaço sobrando: no driver, use papel de comprimento contínuo (às vezes chamado de "Receipt" ou "Roll Paper").</li>
          <li>Letras pequenas na térmica: escolha <em>Letra do cupom: Grande</em>.</li>
        </Guide>
      </div>
      {thermal && <p className="mt-4 text-xs text-text-muted">O cupom da OS traz "Documento sem valor fiscal". A nota fiscal, quando emitida, sai pela própria OS em Nota fiscal.</p>}
    </section>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}{children}{hint && <span className="block text-xs font-normal text-text-muted">{hint}</span>}</label>;
}
function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-button border border-border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><span className="block text-sm font-bold">{title}</span><span className="mt-0.5 block text-xs text-text-muted">{description}</span></span></label>;
}
function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-button border border-border p-4"><h3 className="font-bold">{title}</h3><ol className="mt-2 list-decimal space-y-1.5 pl-5 text-text-muted">{children}</ol></div>;
}
