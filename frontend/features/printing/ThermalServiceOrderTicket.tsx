import Image from 'next/image';
import { SERVICE_ORDER_ITEM_TYPE_LABELS, type CompanySettingsResponse, type OrderDefaults, type PaymentMethod, type ServiceOrderResponse } from '@oficina/contracts';
import { SERVICE_ORDER_STATUS_LABELS } from '@/features/service-orders/state-machine';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { THERMAL_FONT_PX, THERMAL_PRINTABLE_WIDTH_MM, type PaperFormat, type ThermalFontSize } from './print-preferences';

const PAYMENT_LABELS: Record<PaymentMethod, string> = { PIX: 'PIX', CASH: 'Dinheiro', DEBIT_CARD: 'Cartão de débito', CREDIT_CARD: 'Cartão de crédito', BANK_TRANSFER: 'Transferência', BOLETO: 'Boleto', OTHER: 'Outro' };

export interface ThermalTicketOptions {
  format: Exclude<PaperFormat, 'A4'>;
  fontSize: ThermalFontSize;
  copies: 1 | 2;
  showLogo: boolean;
}

// Receipt-style order for thermal printers: one column, black only, sized to the printable width of the roll.
// Each copy ends with a page break so printers with an automatic cutter cut between them.
export function ThermalServiceOrderTicket({ serviceOrder, company, defaults, options, showPrices = true }: { serviceOrder: ServiceOrderResponse; company?: CompanySettingsResponse; defaults?: OrderDefaults; options: ThermalTicketOptions; showPrices?: boolean }) {
  const copies = options.copies === 2 ? ['Via da oficina', 'Via do cliente'] : [null];
  return <div className="thermal-ticket-stack mx-auto flex flex-col items-center gap-6 print:gap-0">
    {copies.map((label, index) => <ThermalCopy key={index} last={index === copies.length - 1} copyLabel={label} serviceOrder={serviceOrder} company={company} defaults={defaults} options={options} showPrices={showPrices} />)}
  </div>;
}

function ThermalCopy({ serviceOrder, company, defaults, options, showPrices, copyLabel, last }: { serviceOrder: ServiceOrderResponse; company?: CompanySettingsResponse; defaults?: OrderDefaults; options: ThermalTicketOptions; showPrices: boolean; copyLabel: string | null; last: boolean }) {
  const width = THERMAL_PRINTABLE_WIDTH_MM[options.format];
  const narrow = options.format === 'THERMAL_58';
  const items = serviceOrder.items ?? [];
  const grossCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const address = [company?.addressStreet && `${company.addressStreet}${company.addressNumber ? `, ${company.addressNumber}` : ''}`, company?.addressDistrict, company?.addressCity && `${company.addressCity}${company.addressState ? `/${company.addressState}` : ''}`].filter(Boolean).join(' - ');
  const warranty = serviceOrder.warrantyDays ?? defaults?.defaultWarrantyDays ?? null;
  return <article
    className={`thermal-ticket bg-white font-mono leading-snug text-black shadow-sm print:shadow-none ${last ? '' : 'break-after-page'}`}
    style={{ width: `${width}mm`, fontSize: `${THERMAL_FONT_PX[options.fontSize] - (narrow ? 1 : 0)}px`, padding: '3mm 0' }}
  >
    <header className="text-center">
      {options.showLogo && company?.logoDataUrl && <Image src={company.logoDataUrl} alt="" width={160} height={56} unoptimized className="mx-auto mb-1 h-auto max-h-14 w-auto max-w-[60%] object-contain grayscale" />}
      {company?.name && <p className="text-[1.15em] font-bold uppercase">{company.name}</p>}
      {company?.document && <p>{company.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'} {company.document}</p>}
      {address && <p>{address}</p>}
      {(company?.phone || company?.whatsapp) && <p>Tel. {company.phone || company.whatsapp}</p>}
    </header>
    <Rule />
    <p className="text-center text-[1.1em] font-bold">ORDEM DE SERVIÇO Nº {String(serviceOrder.orderNumber).padStart(5, '0')}</p>
    {copyLabel && <p className="text-center font-bold uppercase">{copyLabel}</p>}
    <p className="text-center">{SERVICE_ORDER_STATUS_LABELS[serviceOrder.status]} · {formatDateTime(serviceOrder.openedAt)}</p>
    <Rule />
    <Line label="Cliente" value={serviceOrder.customerName} />
    {serviceOrder.customerPhone && <Line label="Telefone" value={serviceOrder.customerPhone} />}
    <Line label="Veículo" value={`${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`} />
    <Line label="Placa" value={serviceOrder.vehiclePlate} />
    {serviceOrder.entryMileage != null && <Line label="Km entrada" value={serviceOrder.entryMileage.toLocaleString('pt-BR')} />}
    {serviceOrder.exitMileage != null && <Line label="Km saída" value={serviceOrder.exitMileage.toLocaleString('pt-BR')} />}
    {serviceOrder.technicianName && <Line label="Técnico" value={serviceOrder.technicianName} />}
    {serviceOrder.expectedDeliveryAt && <Line label="Previsão" value={formatDateTime(serviceOrder.expectedDeliveryAt)} />}
    {serviceOrder.customerComplaint && <><Rule /><p className="font-bold">SOLICITAÇÃO</p><p className="whitespace-pre-line break-words">{serviceOrder.customerComplaint}</p></>}
    {showPrices && items.length > 0 && <>
      <Rule />
      <p className="font-bold">ITENS</p>
      <ol className="space-y-1">{items.map((item, index) => <li key={item.id} className="break-inside-avoid">
        <p className="break-words">{String(index + 1).padStart(2, '0')} {item.description}{narrow ? '' : ` (${SERVICE_ORDER_ITEM_TYPE_LABELS[item.type]})`}</p>
        <p className="flex justify-between gap-2 tabular-nums"><span>{item.quantity.toLocaleString('pt-BR')} x {formatCurrencyBRL(item.unitPriceCents)}</span><span>{formatCurrencyBRL(item.lineTotalCents)}</span></p>
      </li>)}</ol>
      <Rule />
      {serviceOrder.discountCents > 0 && <><Total label="Subtotal" cents={grossCents} /><Total label="Desconto" cents={-serviceOrder.discountCents} /></>}
      <Total label="TOTAL" cents={serviceOrder.totalAmountCents} strong />
      {serviceOrder.receivedAmountCents > 0 && <Total label="Recebido" cents={serviceOrder.receivedAmountCents} />}
      {serviceOrder.outstandingAmountCents > 0 && serviceOrder.receivedAmountCents > 0 && <Total label="Saldo" cents={serviceOrder.outstandingAmountCents} />}
      {serviceOrder.paymentMethod && <Line label="Pagamento" value={`${PAYMENT_LABELS[serviceOrder.paymentMethod]}${serviceOrder.paymentMethod === 'CREDIT_CARD' && serviceOrder.paymentInstallments && serviceOrder.paymentInstallments > 1 ? ` em ${serviceOrder.paymentInstallments}x` : ''}`} />}
    </>}
    {(warranty !== null || defaults?.documentTerms) && <><Rule />{warranty !== null && <p>Garantia dos serviços: {warranty} {warranty === 1 ? 'dia' : 'dias'}.</p>}{defaults?.documentTerms && <p className="mt-1 whitespace-pre-line break-words text-[0.9em]">{defaults.documentTerms.slice(0, 600)}</p>}</>}
    <div className="mt-8 border-t border-dashed border-black pt-1 text-center">Assinatura do cliente</div>
    <Rule />
    {company?.documentFooter && <p className="whitespace-pre-line break-words text-center text-[0.9em]">{company.documentFooter}</p>}
    <p className="text-center text-[0.9em] font-bold">DOCUMENTO SEM VALOR FISCAL</p>
    <p className="text-center text-[0.85em]">Impresso em {formatDateTime(new Date().toISOString())}</p>
  </article>;
}

function Rule() { return <hr className="my-1.5 border-0 border-t border-dashed border-black" />; }
function Line({ label, value }: { label: string; value: string }) { return <p className="break-words"><span className="font-bold">{label}:</span> {value}</p>; }
function Total({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) { return <p className={`flex justify-between gap-2 tabular-nums ${strong ? 'text-[1.15em] font-bold' : ''}`}><span>{label}</span><span>{formatCurrencyBRL(cents)}</span></p>; }
function formatDateTime(value: string) { return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
