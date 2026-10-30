import { SERVICE_ORDER_ITEM_TYPE_LABELS, type CompanySettingsResponse, type OrderDefaults, type ServiceOrderResponse } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';

// The workshop's identity and the terms it prints on every quote; both optional so a quote never fails for lack of them.
export interface QuoteBranding { company?: CompanySettingsResponse; defaults?: OrderDefaults }

export async function generateQuotePdf(serviceOrder: ServiceOrderResponse, branding: QuoteBranding = {}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  let y = 18;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };
  const line = (label: string, value: string) => {
    ensureSpace(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 34, y);
    y += 7;
  };

  const { company, defaults } = branding;
  if (company?.name) {
    // jsPDF reads PNG and JPEG; a WebP logo is left out rather than breaking the quote.
    const logo = company.logoDataUrl?.match(/^data:image\/(png|jpeg);base64,/) ? company.logoDataUrl : null;
    let textX = margin;
    if (logo) { try { pdf.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', margin, y - 6, 18, 18, undefined, 'FAST'); textX = margin + 22; } catch { /* a broken image never blocks the quote */ } }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(25);
    pdf.text(company.name, textX, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(90);
    const identity = [company.legalName, company.document && `CPF/CNPJ ${company.document}`].filter(Boolean).join(' · ');
    const contact = [company.phone || company.whatsapp, company.email, [company.addressStreet, company.addressNumber, company.addressCity, company.addressState].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    if (identity) pdf.text(identity, textX, y + 5);
    if (contact) pdf.text(pdf.splitTextToSize(contact, pageWidth - textX - margin) as string[], textX, y + 9.5);
    y += logo ? 18 : 16;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(25);
  pdf.text('ORÇAMENTO DE SERVIÇOS', margin, y);
  pdf.setFontSize(10);
  pdf.setTextColor(90);
  pdf.text(`OS #${String(serviceOrder.orderNumber).padStart(5, '0')}`, pageWidth - margin, y, { align: 'right' });
  y += 10;
  pdf.setDrawColor(210);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;
  pdf.setTextColor(25);
  pdf.setFontSize(10);

  line('Cliente', serviceOrder.customerName);
  line('Telefone', serviceOrder.customerPhone || 'Não informado');
  line('Veículo', `${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`);
  line('Placa', serviceOrder.vehiclePlate);
  line('Emissão', new Date().toLocaleString('pt-BR'));
  if (defaults?.quoteValidityDays) { const until = new Date(); until.setDate(until.getDate() + defaults.quoteValidityDays); line('Validade', `${defaults.quoteValidityDays} dias (até ${until.toLocaleDateString('pt-BR')})`); }
  y += 3;

  pdf.setFillColor(244, 246, 248);
  pdf.rect(margin, y, pageWidth - margin * 2, 9, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('Tipo', margin + 2, y + 6);
  pdf.text('Descrição', margin + 29, y + 6);
  pdf.text('Qtd.', 138, y + 6, { align: 'right' });
  pdf.text('Valor', pageWidth - margin - 2, y + 6, { align: 'right' });
  y += 13;

  for (const item of serviceOrder.items ?? []) {
    const descriptionLines = pdf.splitTextToSize(item.description, 82) as string[];
    const rowHeight = Math.max(8, descriptionLines.length * 5 + 3);
    ensureSpace(rowHeight);
    pdf.setFont('helvetica', 'normal');
    pdf.text(SERVICE_ORDER_ITEM_TYPE_LABELS[item.type], margin + 2, y);
    pdf.text(descriptionLines, margin + 29, y);
    pdf.text(item.quantity.toLocaleString('pt-BR'), 138, y, { align: 'right' });
    pdf.text(formatCurrencyBRL(item.lineTotalCents), pageWidth - margin - 2, y, { align: 'right' });
    y += rowHeight;
    pdf.setDrawColor(230);
    pdf.line(margin, y - 3, pageWidth - margin, y - 3);
  }

  if (!(serviceOrder.items?.length)) {
    pdf.setTextColor(100);
    pdf.text('Nenhum item lançado neste orçamento.', margin + 2, y);
    pdf.setTextColor(25);
    y += 10;
  }

  const partsTotal = (serviceOrder.items ?? []).filter((item) => item.type !== 'LABOR').reduce((sum, item) => sum + item.lineTotalCents, 0);
  const laborTotal = (serviceOrder.items ?? []).filter((item) => item.type === 'LABOR').reduce((sum, item) => sum + item.lineTotalCents, 0);
  ensureSpace(35);
  y += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Peças e produtos: ${formatCurrencyBRL(partsTotal)}`, pageWidth - margin, y, { align: 'right' });
  y += 6;
  pdf.text(`Mão de obra: ${formatCurrencyBRL(laborTotal)}`, pageWidth - margin, y, { align: 'right' });
  y += 7;
  if (serviceOrder.discountCents > 0) {
    pdf.text(`Desconto: -${formatCurrencyBRL(serviceOrder.discountCents)}`, pageWidth - margin, y, { align: 'right' });
    y += 7;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(`TOTAL: ${formatCurrencyBRL(serviceOrder.totalAmountCents)}`, pageWidth - margin, y, { align: 'right' });
  y += 18;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Aprovação do cliente:', margin, y);
  y += 10;
  pdf.line(margin, y, 105, y);
  pdf.text('Assinatura', margin, y + 5);

  if (defaults?.documentTerms) {
    const terms = pdf.splitTextToSize(defaults.documentTerms, pageWidth - margin * 2) as string[];
    y += 12;
    ensureSpace(terms.length * 4 + 8);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('Termos e condições', margin, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(70);
    pdf.text(terms, margin, y + 5);
    y += terms.length * 4 + 5;
    pdf.setTextColor(25);
  }
  if (company?.documentFooter) {
    const footer = pdf.splitTextToSize(company.documentFooter, pageWidth - margin * 2) as string[];
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110);
    pdf.text(footer, pageWidth / 2, pageHeight - 10 - (footer.length - 1) * 3.5, { align: 'center' });
  }

  pdf.save(`orcamento-os-${String(serviceOrder.orderNumber).padStart(5, '0')}.pdf`);
}
