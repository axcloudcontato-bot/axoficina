import { SERVICE_ORDER_ITEM_TYPE_LABELS, type CompanySettingsResponse, type ServiceOrderResponse } from '@oficina/contracts';
import Image from 'next/image';
import { parseChecklist, type InspectionStatus } from '../checklist';
import { SERVICE_ORDER_STATUS_LABELS } from '../state-machine';
import { formatCurrencyBRL } from '@/lib/format-currency';

export type ServiceOrderPrintMode = 'summary' | 'full';

const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  unchecked: 'Não verificado',
  ok: 'Conforme',
  attention: 'Atenção',
  critical: 'Crítico',
  na: 'Não se aplica',
};

export function ServiceOrderPrintDocument({
  serviceOrder,
  mode,
  company,
}: {
  serviceOrder: ServiceOrderResponse;
  mode: ServiceOrderPrintMode;
  company?: CompanySettingsResponse;
}) {
  if (mode === 'summary') {
    return (
      <article className="print-summary-sheet mx-auto grid max-w-4xl bg-white text-slate-950 shadow-sm">
        <ApprovalCopy serviceOrder={serviceOrder} company={company} copyLabel="Via da oficina" />
        <ApprovalCopy serviceOrder={serviceOrder} company={company} copyLabel="Via do cliente" cutLine />
      </article>
    );
  }

  const isFull = mode === 'full';
  const checklist = parseChecklist(serviceOrder.checklist);

  return (
    <article className="print-document mx-auto max-w-4xl bg-white p-6 text-slate-950 shadow-sm sm:p-10">
      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
        <div className="flex items-start gap-3">
          {company?.logoDataUrl && <span className="flex size-[52px] shrink-0 items-center justify-center rounded bg-slate-900 p-1.5"><Image src={company.logoDataUrl} alt="" width={46} height={46} unoptimized className="size-full object-contain" /></span>}
          <div>
          {company?.name && <p className="mb-1 text-xs font-black uppercase tracking-wide">{company.name}</p>}
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ordem de serviço</p>
          <h1 className="mt-1 text-3xl font-black">OS #{String(serviceOrder.orderNumber).padStart(5, '0')}</h1>
          <p className="mt-1 text-sm text-slate-600">{isFull ? 'Versão completa' : 'Versão resumida'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">{SERVICE_ORDER_STATUS_LABELS[serviceOrder.status]}</p>
          <p className="mt-1 text-xs text-slate-500">Entrada: {formatDateTime(serviceOrder.openedAt)}</p>
        </div>
      </header>

      <section className="print-break-inside-avoid grid grid-cols-2 gap-x-8 gap-y-4 border-b border-slate-300 py-5 sm:grid-cols-3">
        <PrintField label="Cliente" value={serviceOrder.customerName} />
        <PrintField label="Telefone" value={serviceOrder.customerPhone || 'Não informado'} />
        <PrintField label="Veículo" value={`${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`} />
        <PrintField label="Placa" value={serviceOrder.vehiclePlate} />
        <PrintField label="Quilometragem" value={serviceOrder.entryMileage == null ? 'Não informada' : `${serviceOrder.entryMileage.toLocaleString('pt-BR')} km`} />
        <PrintField label="Previsão de entrega" value={serviceOrder.expectedDeliveryAt ? formatDateTime(serviceOrder.expectedDeliveryAt) : 'Não definida'} />
        <PrintField label="Técnico responsável" value={serviceOrder.technicianName ?? 'Não atribuído'} />
      </section>

      <PrintSection title="Solicitação do cliente">
        <TextValue value={serviceOrder.customerComplaint} />
      </PrintSection>

      {serviceOrder.recommendedService && (
        <PrintSection title="Serviço recomendado">
          <TextValue value={serviceOrder.recommendedService} />
        </PrintSection>
      )}

      {isFull && (
        <>
          <PrintSection title="Recepção">
            <TextValue value={serviceOrder.receptionNotes} />
          </PrintSection>

          <PrintSection title="Inspeção técnica">
            <table className="w-full border-collapse text-left text-xs">
              <thead><tr className="border-b border-slate-400"><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Situação</th><th className="py-2">Observação</th></tr></thead>
              <tbody>{checklist.map((item) => <tr key={item.id} className="border-b border-slate-200"><td className="py-2 pr-3 font-medium">{item.label}</td><td className="py-2 pr-3">{INSPECTION_STATUS_LABELS[item.status]}</td><td className="py-2">{item.note || '—'}</td></tr>)}</tbody>
            </table>
          </PrintSection>

          <PrintSection title="Diagnóstico técnico">
            <TextValue value={serviceOrder.diagnosis} />
          </PrintSection>

          <PrintSection title="Itens e valores">
            {serviceOrder.items?.length ? (
              <table className="w-full border-collapse text-left text-xs">
                <thead><tr className="border-b border-slate-400"><th className="py-2 pr-3">Tipo</th><th className="py-2 pr-3">Descrição</th><th className="py-2 pr-3 text-right">Qtd.</th><th className="py-2 pr-3 text-right">Unitário</th><th className="py-2 text-right">Total</th></tr></thead>
                <tbody>{serviceOrder.items.map((item) => <tr key={item.id} className="border-b border-slate-200"><td className="py-2 pr-3">{item.type === 'LABOR' ? 'Serviço' : SERVICE_ORDER_ITEM_TYPE_LABELS[item.type]}</td><td className="py-2 pr-3 font-medium">{item.description}</td><td className="py-2 pr-3 text-right">{item.quantity}</td><td className="py-2 pr-3 text-right">{formatCurrencyBRL(item.unitPriceCents)}</td><td className="py-2 text-right font-bold">{formatCurrencyBRL(item.lineTotalCents)}</td></tr>)}</tbody>
              </table>
            ) : <p className="text-sm text-slate-500">Nenhum item lançado.</p>}
          </PrintSection>

          <PrintSection title="Histórico da OS">
            {serviceOrder.statusHistory?.length ? (
              <ol className="space-y-2 text-xs">{serviceOrder.statusHistory.map((event) => <li key={event.id} className="flex justify-between gap-4 border-b border-slate-200 pb-2"><span>{event.fromStatus ? `${SERVICE_ORDER_STATUS_LABELS[event.fromStatus]} → ` : ''}{SERVICE_ORDER_STATUS_LABELS[event.toStatus]}</span><time>{formatDateTime(event.changedAt)}</time></li>)}</ol>
            ) : <p className="text-sm text-slate-500">Sem movimentações registradas.</p>}
          </PrintSection>
        </>
      )}

      <section className="print-break-inside-avoid mt-7 flex items-end justify-between border-t-2 border-slate-900 pt-4">
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor total</p><p className="text-2xl font-black">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</p></div>
        <p className="text-xs text-slate-500">Documento referente à OS #{String(serviceOrder.orderNumber).padStart(5, '0')}</p>
      </section>
      {serviceOrder.warrantyDays !== undefined && <p className="print-break-inside-avoid mt-3 text-sm"><strong>Garantia:</strong> {serviceOrder.warrantyDays === 0 ? 'sem garantia adicional' : `${serviceOrder.warrantyDays} ${serviceOrder.warrantyDays === 1 ? 'dia' : 'dias'}${serviceOrder.status === 'DELIVERED' && serviceOrder.closedAt ? `, válida até ${new Date(new Date(serviceOrder.closedAt).getTime() + serviceOrder.warrantyDays * 86_400_000).toLocaleDateString('pt-BR')}` : ', a contar da entrega'}`}</p>}

      <section className="print-break-inside-avoid mt-14 grid grid-cols-2 gap-12 text-center text-xs">
        <p className="border-t border-slate-600 pt-2">Assinatura do cliente</p>
        <p className="border-t border-slate-600 pt-2">Responsável pela oficina</p>
      </section>
    </article>
  );
}

function ApprovalCopy({
  serviceOrder,
  company,
  copyLabel,
  cutLine = false,
}: {
  serviceOrder: ServiceOrderResponse;
  company?: CompanySettingsResponse;
  copyLabel: string;
  cutLine?: boolean;
}) {
  const items = serviceOrder.items ?? [];
  const partsTotal = items.filter((item) => item.type !== 'LABOR').reduce((total, item) => total + item.lineTotalCents, 0);
  const laborTotal = items.filter((item) => item.type === 'LABOR').reduce((total, item) => total + item.lineTotalCents, 0);

  return (
    <section className={`print-approval-copy relative flex min-h-0 flex-col px-6 py-5 sm:px-8 ${cutLine ? 'print-cut-line border-t-2 border-dotted border-slate-400' : ''}`}>
      {cutLine && <span className="absolute left-6 top-0 -translate-y-1/2 bg-white px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">✂ Recorte</span>}
      <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
        <div className="flex items-start gap-2">
          {company?.logoDataUrl && <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-slate-900 p-1"><Image src={company.logoDataUrl} alt="" width={32} height={32} unoptimized className="size-full object-contain" /></span>}
          <div>
          {company?.name && <p className="text-[10px] font-black uppercase">{company.name}</p>}
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Aprovação de orçamento</p>
          <h1 className="text-xl font-black">OS #{String(serviceOrder.orderNumber).padStart(5, '0')}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold">{copyLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(serviceOrder.openedAt)}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-5 gap-y-2 border-b border-slate-300 py-3 sm:grid-cols-4">
        <PrintField label="Cliente" value={serviceOrder.customerName} />
        <PrintField label="Telefone" value={serviceOrder.customerPhone || 'Não informado'} />
        <PrintField label="Veículo" value={`${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`} />
        <PrintField label="Placa" value={serviceOrder.vehiclePlate} />
      </div>

      <div className="min-h-0 py-3">
        <table className="w-full border-collapse text-left text-xs">
          <thead><tr className="border-b border-slate-400"><th className="py-1.5 pr-2">Tipo</th><th className="py-1.5 pr-2">Descrição</th><th className="py-1.5 pr-2 text-right">Qtd.</th><th className="py-1.5 text-right">Valor</th></tr></thead>
          <tbody>
            {items.length ? items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="py-1.5 pr-2">{SERVICE_ORDER_ITEM_TYPE_LABELS[item.type]}</td>
                <td className="py-1.5 pr-2 font-medium">{item.description}</td>
                <td className="py-1.5 pr-2 text-right">{item.quantity}</td>
                <td className="py-1.5 text-right font-semibold">{formatCurrencyBRL(item.lineTotalCents)}</td>
              </tr>
            )) : <tr><td colSpan={4} className="py-3 text-center text-slate-500">Nenhuma peça ou mão de obra lançada.</td></tr>}
          </tbody>
        </table>
      </div>

      <footer className="print-break-inside-avoid flex min-h-0 flex-1 flex-col">
        <div className="ml-auto grid w-full max-w-xs grid-cols-2 gap-x-5 gap-y-1 text-[13px]">
          <span>Peças e produtos</span><strong className="text-right">{formatCurrencyBRL(partsTotal)}</strong>
          <span>Mão de obra</span><strong className="text-right">{formatCurrencyBRL(laborTotal)}</strong>
          {serviceOrder.discountCents > 0 && <><span>Desconto</span><strong className="text-right">-{formatCurrencyBRL(serviceOrder.discountCents)}</strong></>}
          <span className="border-t border-slate-500 pt-1 font-black">Total</span><strong className="border-t border-slate-500 pt-1 text-right text-base">{formatCurrencyBRL(serviceOrder.totalAmountCents)}</strong>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-10 pb-1 text-center text-[11px]">
          <p className="border-t border-slate-600 pt-1.5">Assinatura do cliente — aprovação</p>
          <p className="border-t border-slate-600 pt-1.5">Data</p>
        </div>
      </footer>
    </section>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="print-break-inside-avoid border-b border-slate-300 py-5"><h2 className="mb-3 text-sm font-black uppercase tracking-wide">{title}</h2>{children}</section>;
}

function PrintField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div>;
}

function TextValue({ value }: { value?: string }) {
  return <p className="whitespace-pre-wrap text-sm leading-6">{value || 'Não informado.'}</p>;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
