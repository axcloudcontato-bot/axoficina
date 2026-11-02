import { SERVICE_ORDER_ITEM_TYPE_LABELS, type CompanySettingsResponse, type OrderDefaults, type ServiceOrderResponse } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';

// The workshop's identity and the terms it prints on every quote; both optional so a quote never fails for lack of them.
export interface QuoteBranding { company?: CompanySettingsResponse; defaults?: OrderDefaults }

export async function generateQuotePdf(serviceOrder: ServiceOrderResponse, branding: QuoteBranding = {}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 17;
  const ink: [number, number, number] = [22, 32, 45];
  const muted: [number, number, number] = [96, 109, 124];
  const border: [number, number, number] = [221, 227, 233];
  let y = 18;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 22) return;
    pdf.addPage();
    y = margin;
  };
  const detail = (label: string, value: string, column: number, row: number) => {
    const x = margin + 6 + column * 87;
    const at = y + 7 + row * 12;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(...muted);
    pdf.text(label.toUpperCase(), x, at);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...ink);
    const lines = pdf.splitTextToSize(value, 77) as string[];
    pdf.text(lines[0] ?? '', x, at + 5);
    if (lines[1]) pdf.text(lines[1], x, at + 8.5);
  };

  const { company, defaults } = branding;
  if (company?.name) {
    // jsPDF reads PNG and JPEG; a WebP logo is left out rather than breaking the quote.
    const logo = company.logoDataUrl?.match(/^data:image\/(png|jpeg);base64,/) ? company.logoDataUrl : null;
    let textX = margin;
    let logoHeight = 0;
    if (logo) {
      try {
        const image = pdf.getImageProperties(logo);
        const scale = Math.min(37 / image.width, 25 / image.height);
        const width = image.width * scale;
        logoHeight = image.height * scale;
        pdf.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', margin, y - 5, width, logoHeight, undefined, 'FAST');
        textX = margin + width + 8;
      } catch { logoHeight = 0; /* A logo inválida não impede o orçamento. */ }
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...ink);
    pdf.text(company.name, textX, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...muted);
    const identity = [company.legalName, company.document && `CPF/CNPJ ${company.document}`].filter(Boolean).join(' · ');
    const contact = [company.phone || company.whatsapp, company.email].filter(Boolean).join(' · ');
    const address = [company.addressStreet, company.addressNumber, company.addressDistrict, company.addressCity, company.addressState].filter(Boolean).join(', ');
    const identityLines = identity ? pdf.splitTextToSize(identity, pageWidth - textX - margin) as string[] : [];
    const contactLines = contact ? pdf.splitTextToSize(contact, pageWidth - textX - margin) as string[] : [];
    const addressLines = address ? pdf.splitTextToSize(address, pageWidth - textX - margin) as string[] : [];
    let nextLine = y + 5;
    for (const group of [identityLines, contactLines, addressLines]) {
      if (group.length) { pdf.text(group, textX, nextLine); nextLine += group.length * 4.5; }
    }
    y += Math.max(logoHeight, nextLine - y) + 3;
  }

  pdf.setDrawColor(...border); pdf.line(margin, y, pageWidth - margin, y);
  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.setTextColor(...ink);
  pdf.text('ORÇAMENTO DE SERVIÇOS', margin, y);
  pdf.setFontSize(10);
  pdf.setTextColor(...muted);
  pdf.text(`OS #${String(serviceOrder.orderNumber).padStart(5, '0')}`, pageWidth - margin, y, { align: 'right' });
  y += 5;
  pdf.setFillColor(255, 190, 0); pdf.rect(margin, y, 27, 1.1, 'F');
  y += 9;
  pdf.setFillColor(247, 248, 250); pdf.setDrawColor(...border);
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 42, 2, 2, 'FD');
  const issued = new Date();
  const until = new Date(issued);
  if (defaults?.quoteValidityDays) until.setDate(until.getDate() + defaults.quoteValidityDays);
  detail('Cliente', serviceOrder.customerName, 0, 0);
  detail('Veículo', `${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`, 1, 0);
  detail('Telefone', serviceOrder.customerPhone || 'Não informado', 0, 1);
  detail('Placa', serviceOrder.vehiclePlate, 1, 1);
  detail('Emissão', issued.toLocaleString('pt-BR'), 0, 2);
  detail('Validade', defaults?.quoteValidityDays ? `${defaults.quoteValidityDays} dias (até ${until.toLocaleDateString('pt-BR')})` : 'Não informada', 1, 2);
  y += 49;

  pdf.setFillColor(...ink);
  pdf.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(255);
  pdf.text('Tipo', margin + 3, y + 6.5);
  pdf.text('Descrição', margin + 29, y + 6.5);
  pdf.text('Qtd.', 138, y + 6.5, { align: 'right' });
  pdf.text('Valor', pageWidth - margin - 3, y + 6.5, { align: 'right' });
  y += 10;

  for (const [index, item] of (serviceOrder.items ?? []).entries()) {
    pdf.setFontSize(10);
    const descriptionLines = pdf.splitTextToSize(item.description, 82) as string[];
    const rowHeight = Math.max(13, descriptionLines.length * 5 + 6);
    if (y + rowHeight > pageHeight - 22) {
      pdf.addPage(); y = margin;
      pdf.setFillColor(...ink); pdf.rect(margin, y, pageWidth - margin * 2, 10, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(255);
      pdf.text('Tipo', margin + 3, y + 6.5); pdf.text('Descrição', margin + 29, y + 6.5);
      pdf.text('Qtd.', 138, y + 6.5, { align: 'right' }); pdf.text('Valor', pageWidth - margin - 3, y + 6.5, { align: 'right' });
      y += 10;
    }
    if (index % 2 === 0) { pdf.setFillColor(250, 251, 252); pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F'); }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...ink);
    pdf.text(SERVICE_ORDER_ITEM_TYPE_LABELS[item.type], margin + 3, y + 8);
    pdf.text(descriptionLines, margin + 29, y + 8);
    pdf.text(item.quantity.toLocaleString('pt-BR'), 138, y + 8, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(formatCurrencyBRL(item.lineTotalCents), pageWidth - margin - 3, y + 8, { align: 'right' });
    y += rowHeight;
    pdf.setDrawColor(...border);
    pdf.line(margin, y, pageWidth - margin, y);
  }

  if (!(serviceOrder.items?.length)) {
    pdf.setTextColor(100);
    pdf.text('Nenhum item lançado neste orçamento.', margin + 2, y + 8);
    pdf.setTextColor(...ink);
    y += 14;
  }

  const partsTotal = (serviceOrder.items ?? []).filter((item) => item.type !== 'LABOR').reduce((sum, item) => sum + item.lineTotalCents, 0);
  const laborTotal = (serviceOrder.items ?? []).filter((item) => item.type === 'LABOR').reduce((sum, item) => sum + item.lineTotalCents, 0);
  ensureSpace(70);
  y += 9;
  const summaryX = pageWidth - margin - 75;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...muted);
  pdf.text('Peças e produtos', summaryX, y);
  pdf.setTextColor(...ink); pdf.text(formatCurrencyBRL(partsTotal), pageWidth - margin - 3, y, { align: 'right' });
  y += 6;
  pdf.setTextColor(...muted); pdf.text('Mão de obra', summaryX, y);
  pdf.setTextColor(...ink); pdf.text(formatCurrencyBRL(laborTotal), pageWidth - margin - 3, y, { align: 'right' });
  y += 6;
  if (serviceOrder.discountCents > 0) {
    pdf.setTextColor(...muted); pdf.text('Desconto', summaryX, y);
    pdf.setTextColor(...ink); pdf.text(`-${formatCurrencyBRL(serviceOrder.discountCents)}`, pageWidth - margin - 3, y, { align: 'right' });
    y += 6;
  }
  pdf.setDrawColor(...border); pdf.line(summaryX, y + 1, pageWidth - margin, y + 1);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...ink);
  pdf.text('TOTAL', summaryX, y + 10);
  pdf.setFontSize(13); pdf.text(formatCurrencyBRL(serviceOrder.totalAmountCents), pageWidth - margin - 3, y + 10, { align: 'right' });
  y += 23;

  if (defaults?.documentTerms) {
    y += 3;
    ensureSpace(12);
    pdf.setDrawColor(...border); pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...ink); pdf.text('TERMOS E CONDIÇÕES', margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    for (const clause of defaults.documentTerms.split(/\n+/).filter(Boolean)) {
      const lines = pdf.splitTextToSize(clause, pageWidth - margin * 2) as string[];
      if (y + lines.length * 4 + 3 > pageHeight - 22) {
        pdf.addPage(); y = margin + 2;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...ink);
        pdf.text('TERMOS E CONDIÇÕES (CONTINUAÇÃO)', margin, y);
        y += 7;
      }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted);
      pdf.text(lines, margin, y);
      y += lines.length * 4 + 3;
    }
  }
  ensureSpace(35);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...muted);
  pdf.text('APROVAÇÃO DO CLIENTE', margin, y + 7);
  y += 25;
  pdf.setDrawColor(...border); pdf.line(margin, y, margin + 90, y);
  pdf.setFont('helvetica', 'normal'); pdf.text('Assinatura', margin, y + 5);
  y += 10;
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(...border); pdf.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    if (company?.documentFooter) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...muted);
      const footer = (pdf.splitTextToSize(company.documentFooter, pageWidth - margin * 2 - 25) as string[])[0] ?? '';
      pdf.text(footer, margin, pageHeight - 11);
    }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...muted);
    pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 11, { align: 'right' });
  }

  pdf.save(`orcamento-os-${String(serviceOrder.orderNumber).padStart(5, '0')}.pdf`);
}
