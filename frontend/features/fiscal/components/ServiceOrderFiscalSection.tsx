'use client';

import { FISCAL_CANCEL_REASON_MAX, FISCAL_CANCEL_REASON_MIN, FISCAL_DOCUMENT_KIND_DESCRIPTIONS, FISCAL_DOCUMENT_KIND_LABELS, FISCAL_DOCUMENT_STATUS_LABELS, FISCAL_DOCUMENT_KINDS, type FiscalDocumentKind, type FiscalDocumentResponse, type ServiceOrderResponse } from '@oficina/contracts';
import { ArrowClockwise, DownloadSimple, FileText, Plus, Receipt, Trash, WarningCircle, XCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { parseMoneyToCents } from '@/lib/parse-money';
import { downloadBase64, readFileAsBase64 } from '@/lib/read-file-base64';
import { fiscalApi } from '../api/fiscal-api';
import { useCancelFiscalDocument, useDeleteFiscalDocument, useFiscalDocuments, useFiscalPreview, useIssueFiscalDocument, useRegisterFiscalDocument } from '../hooks/use-fiscal';

const STATUS_VARIANT = { AUTHORIZED: 'success', PROCESSING: 'info', ERROR: 'critical', CANCELLED: 'neutral' } as const;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

// Notes are optional: a workshop issues one only when the customer asks, or records one issued elsewhere.
export function ServiceOrderFiscalSection({ serviceOrder }: { serviceOrder: ServiceOrderResponse }) {
  const documents = useFiscalDocuments(serviceOrder.id);
  const remove = useDeleteFiscalDocument(serviceOrder.id);
  const [issueOpen, setIssueOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [cancelling, setCancelling] = useState<FiscalDocumentResponse | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const list = documents.data ?? [];

  async function refresh(document: FiscalDocumentResponse) {
    setRefreshing(document.id);
    try { await fiscalApi.refresh(document.id); await documents.refetch(); } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível consultar o emissor.')); } finally { setRefreshing(null); }
  }
  async function download(document: FiscalDocumentResponse) {
    try { const file = await fiscalApi.attachment(document.id); downloadBase64(file.name, file.mimeType, file.dataBase64); } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível baixar o arquivo.')); }
  }
  function erase(document: FiscalDocumentResponse) {
    if (!window.confirm(document.origin === 'MANUAL' ? 'Excluir este registro de nota da OS? A nota em si não é cancelada.' : 'Excluir esta tentativa de emissão?')) return;
    remove.mutate(document.id, { onSuccess: () => toast.success('Registro excluído.'), onError: (error) => toast.error(extractErrorMessage(error)) });
  }

  return <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-lg font-bold text-text"><Receipt className="size-5" aria-hidden="true" />Nota fiscal</h3><p className="mt-1 text-sm text-text-muted">Opcional. Emita quando o cliente pedir, ou registre a nota emitida fora do Ofix.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setRegisterOpen(true)}><Plus className="size-4" />Registrar nota emitida</Button><Button size="sm" onClick={() => setIssueOpen(true)}><Receipt className="size-4" />Emitir nota</Button></div>
    </div>
    {documents.isLoading ? <div className="mt-4 h-16 animate-pulse rounded-button bg-muted" /> : documents.isError ? <p role="alert" className="mt-4 text-sm text-danger">Não foi possível carregar as notas desta OS.</p> : list.length === 0 ? <p className="mt-4 rounded-button bg-muted/50 px-4 py-3 text-sm text-text-muted">Nenhuma nota para esta OS.</p> : <ul className="mt-4 divide-y divide-border rounded-button border border-border">
      {list.map((document) => <li key={document.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-text">{FISCAL_DOCUMENT_KIND_LABELS[document.kind]}{document.number ? ` nº ${document.number}` : ''}{document.series ? ` · série ${document.series}` : ''}<Badge variant={STATUS_VARIANT[document.status]}>{FISCAL_DOCUMENT_STATUS_LABELS[document.status]}</Badge>{document.environment === 'HOMOLOGACAO' && <Badge variant="attention">Teste</Badge>}{document.origin === 'MANUAL' && <Badge variant="neutral">Emitida fora do Ofix</Badge>}</div>
          <p className="mt-0.5 text-xs text-text-muted">{formatCurrencyBRL(document.amountCents)}{document.issuedAt ? ` · ${new Date(document.issuedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}{document.verificationCode ? ` · código ${document.verificationCode}` : ''}</p>
          {document.accessKey && <p className="mt-0.5 break-all font-mono text-[11px] text-text-muted">Chave {document.accessKey}</p>}
          {document.errorMessage && <p className="mt-1 flex gap-1.5 text-xs text-danger"><WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{document.errorMessage}</p>}
          {document.cancelReason && <p className="mt-1 text-xs text-text-muted">Cancelada: {document.cancelReason}</p>}
          {document.notes && <p className="mt-1 text-xs text-text-muted">{document.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          {document.pdfUrl && <Button asChild variant="ghost" size="sm"><a href={document.pdfUrl} target="_blank" rel="noopener noreferrer"><FileText className="size-4" />Abrir nota</a></Button>}
          {document.xmlUrl && <Button asChild variant="ghost" size="sm"><a href={document.xmlUrl} target="_blank" rel="noopener noreferrer"><DownloadSimple className="size-4" />XML</a></Button>}
          {document.hasAttachment && <Button variant="ghost" size="sm" onClick={() => void download(document)}><DownloadSimple className="size-4" />Arquivo</Button>}
          {document.status === 'PROCESSING' && <Button variant="ghost" size="sm" disabled={refreshing === document.id} onClick={() => void refresh(document)}><ArrowClockwise className={`size-4 ${refreshing === document.id ? 'animate-spin' : ''}`} />Atualizar</Button>}
          {document.status === 'AUTHORIZED' && <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setCancelling(document)}><XCircle className="size-4" />Cancelar</Button>}
          {(document.origin === 'MANUAL' || document.status === 'ERROR') && <Button variant="ghost" size="sm" className="text-danger hover:text-danger" disabled={remove.isPending} onClick={() => erase(document)}><Trash className="size-4" />Excluir</Button>}
        </div>
      </li>)}
    </ul>}
    <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} serviceOrder={serviceOrder} documents={list} />
    <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} serviceOrder={serviceOrder} />
    <CancelDialog document={cancelling} onClose={() => setCancelling(null)} serviceOrderId={serviceOrder.id} />
  </section>;
}

function IssueDialog({ open, onOpenChange, serviceOrder, documents }: { open: boolean; onOpenChange: (open: boolean) => void; serviceOrder: ServiceOrderResponse; documents: FiscalDocumentResponse[] }) {
  const [kind, setKind] = useState<FiscalDocumentKind>('NFSE');
  const preview = useFiscalPreview(serviceOrder.id, open ? kind : null);
  const issue = useIssueFiscalDocument(serviceOrder.id);
  const active = documents.find((document) => document.kind === kind && ['AUTHORIZED', 'PROCESSING'].includes(document.status));
  const data = preview.data;
  const blocked = Boolean(!data || data.blockers.length || data.problems.length || active);

  function submit() {
    issue.mutate({ serviceOrderId: serviceOrder.id, kind }, {
      onSuccess: (result) => {
        const document = result as FiscalDocumentResponse;
        if (document.status === 'AUTHORIZED') toast.success(`${FISCAL_DOCUMENT_KIND_LABELS[kind]} emitida.`);
        else if (document.status === 'ERROR') toast.error(document.errorMessage ?? 'O emissor recusou a nota.');
        else toast.info('Nota enviada. A autorização pode levar alguns segundos.');
        onOpenChange(false);
      },
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível emitir a nota.')),
    });
  }

  return <Dialog open={open} onOpenChange={(next) => !issue.isPending && onOpenChange(next)}><DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
    <DialogHeader><DialogTitle>Emitir nota fiscal</DialogTitle><DialogDescription>OS #{String(serviceOrder.orderNumber).padStart(5, '0')} · {serviceOrder.customerName} · {serviceOrder.vehiclePlate}</DialogDescription></DialogHeader>
    <div role="radiogroup" aria-label="Tipo de nota" className="grid gap-2 sm:grid-cols-3">{FISCAL_DOCUMENT_KINDS.map((option) => <button key={option} type="button" role="radio" aria-checked={kind === option} onClick={() => setKind(option)} className={`rounded-button border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === option ? 'border-primary bg-selection/30' : 'border-border hover:bg-muted/40'}`}><span className="block text-sm font-bold">{FISCAL_DOCUMENT_KIND_LABELS[option]}</span><span className="mt-0.5 block text-xs text-text-muted">{FISCAL_DOCUMENT_KIND_DESCRIPTIONS[option]}</span></button>)}</div>
    {preview.isLoading ? <div className="h-32 animate-pulse rounded-button bg-muted" /> : preview.isError || !data ? <p role="alert" className="text-sm text-danger">{extractErrorMessage(preview.error, 'Não foi possível montar a prévia da nota.')}</p> : <div className="space-y-3">
      {active && <Notice tone="danger">Esta OS já tem uma {FISCAL_DOCUMENT_KIND_LABELS[kind]} {active.status === 'PROCESSING' ? 'em processamento' : 'emitida'}. Cancele a anterior para emitir outra.</Notice>}
      {data.blockers.length > 0 && <Notice tone="danger"><p className="font-semibold">Ainda não dá para emitir pelo Ofix:</p><ul className="mt-1 list-disc pl-4">{data.blockers.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-1">Se a nota já foi emitida em outro sistema, use Registrar nota emitida.</p></Notice>}
      {data.problems.length > 0 && <Notice tone="danger"><p className="font-semibold">Corrija antes de emitir:</p><ul className="mt-1 list-disc pl-4">{data.problems.map((item) => <li key={item}>{item}</li>)}</ul></Notice>}
      {data.items.length > 0 && <div className="overflow-x-auto rounded-button border border-border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-text-muted"><tr><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 text-right font-semibold">Qtd.</th><th className="px-3 py-2 text-right font-semibold">Valor</th>{kind !== 'NFSE' && <th className="px-3 py-2 font-semibold">NCM</th>}</tr></thead><tbody className="divide-y divide-border">{data.items.map((item) => <tr key={item.id}><td className="px-3 py-2">{item.description}</td><td className="px-3 py-2 text-right tabular-nums">{item.quantity.toLocaleString('pt-BR')}</td><td className="px-3 py-2 text-right tabular-nums">{formatCurrencyBRL(item.totalCents - item.discountCents)}</td>{kind !== 'NFSE' && <td className="px-3 py-2 font-mono text-xs">{item.ncm}</td>}</tr>)}</tbody><tfoot><tr className="border-t border-border font-bold"><td className="px-3 py-2">Total da nota{data.discountCents ? ` (desconto de ${formatCurrencyBRL(data.discountCents)})` : ''}</td><td /><td className="px-3 py-2 text-right tabular-nums">{formatCurrencyBRL(data.amountCents)}</td>{kind !== 'NFSE' && <td />}</tr></tfoot></table></div>}
      {data.warnings.length > 0 && <Notice tone="warning"><ul className="list-disc pl-4">{data.warnings.map((item) => <li key={item}>{item}</li>)}</ul></Notice>}
    </div>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={issue.isPending}>Fechar</Button><Button onClick={submit} disabled={blocked || issue.isPending}>{issue.isPending ? 'Emitindo...' : `Emitir ${FISCAL_DOCUMENT_KIND_LABELS[kind]}${data?.environment === 'HOMOLOGACAO' ? ' de teste' : ''}`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function RegisterDialog({ open, onOpenChange, serviceOrder }: { open: boolean; onOpenChange: (open: boolean) => void; serviceOrder: ServiceOrderResponse }) {
  const register = useRegisterFiscalDocument(serviceOrder.id);
  // Local calendar day: after 9 p.m. in Brazil the UTC date is already tomorrow.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const empty = () => ({ kind: 'NFSE' as FiscalDocumentKind, number: '', series: '', issuedAt: today, amount: (serviceOrder.totalAmountCents / 100).toFixed(2).replace('.', ','), code: '', notes: '' });
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const set = <K extends keyof ReturnType<typeof empty>>(key: K, value: ReturnType<typeof empty>[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    const amountCents = parseMoneyToCents(form.amount);
    if (!form.number.trim()) return toast.error('Informe o número da nota.');
    if (!Number.isFinite(amountCents) || amountCents < 0) return toast.error('Informe o valor da nota.');
    if (file && file.size > MAX_ATTACHMENT_BYTES) return toast.error('O arquivo deve ter até 2 MB.');
    const mimeType = file?.type || (file?.name.toLowerCase().endsWith('.xml') ? 'application/xml' : 'application/pdf');
    const code = form.code.replace(/\s/g, '');
    register.mutate({
      serviceOrderId: serviceOrder.id, kind: form.kind, number: form.number.trim(), series: form.series.trim() || undefined, issuedAt: new Date(`${form.issuedAt}T12:00:00`).toISOString(), amountCents,
      ...(code ? (form.kind === 'NFSE' ? { verificationCode: code } : { accessKey: code }) : {}), notes: form.notes.trim() || undefined,
      ...(file ? { attachment: { name: file.name, mimeType, dataBase64: await readFileAsBase64(file) } } : {}),
    }, {
      onSuccess: () => { toast.success('Nota registrada na OS.'); setForm(empty()); setFile(null); onOpenChange(false); },
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível registrar a nota.')),
    });
  }

  return <Dialog open={open} onOpenChange={(next) => !register.isPending && onOpenChange(next)}><DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-lg">
    <DialogHeader><DialogTitle>Registrar nota emitida fora do Ofix</DialogTitle><DialogDescription>Para notas feitas no portal da prefeitura, da SEFAZ ou pelo contador. Fica no histórico da OS com o arquivo anexado.</DialogDescription></DialogHeader>
    <fieldset disabled={register.isPending} className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 text-sm font-medium sm:col-span-2">Tipo<select className="h-10 w-full rounded-button border border-input bg-card px-3 text-sm" value={form.kind} onChange={(event) => set('kind', event.target.value as FiscalDocumentKind)}>{FISCAL_DOCUMENT_KINDS.map((kind) => <option key={kind} value={kind}>{FISCAL_DOCUMENT_KIND_LABELS[kind]} · {FISCAL_DOCUMENT_KIND_DESCRIPTIONS[kind]}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm font-medium">Número<Input value={form.number} maxLength={20} inputMode="numeric" onChange={(event) => set('number', event.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium">Série <span className="font-normal text-text-muted">(opcional)</span><Input value={form.series} maxLength={10} onChange={(event) => set('series', event.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium">Data de emissão<Input type="date" value={form.issuedAt} max={today} onChange={(event) => set('issuedAt', event.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium">Valor<Input value={form.amount} inputMode="decimal" onChange={(event) => set('amount', event.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium sm:col-span-2">{form.kind === 'NFSE' ? 'Código de verificação' : 'Chave de acesso (44 dígitos)'} <span className="font-normal text-text-muted">(opcional)</span><Input value={form.code} maxLength={60} onChange={(event) => set('code', event.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium sm:col-span-2">Arquivo da nota <span className="font-normal text-text-muted">(PDF, XML ou imagem, até 2 MB)</span><Input type="file" accept="application/pdf,.xml,text/xml,application/xml,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <label className="block space-y-1.5 text-sm font-medium sm:col-span-2">Observação <span className="font-normal text-text-muted">(opcional)</span><Textarea className="min-h-16" maxLength={500} value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label>
    </fieldset>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={register.isPending}>Cancelar</Button><Button onClick={() => void submit()} disabled={register.isPending}>{register.isPending ? 'Registrando...' : 'Registrar nota'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function CancelDialog({ document, onClose, serviceOrderId }: { document: FiscalDocumentResponse | null; onClose: () => void; serviceOrderId: string }) {
  const cancel = useCancelFiscalDocument(serviceOrderId);
  const [reason, setReason] = useState('');
  const length = reason.trim().length;
  function submit() {
    if (!document) return;
    cancel.mutate({ id: document.id, reason: reason.trim() }, {
      onSuccess: () => { toast.success('Nota cancelada.'); setReason(''); onClose(); },
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível cancelar a nota.')),
    });
  }
  return <Dialog open={Boolean(document)} onOpenChange={(open) => !open && !cancel.isPending && onClose()}><DialogContent className="bg-card sm:max-w-lg">
    <DialogHeader><DialogTitle>Cancelar {document ? FISCAL_DOCUMENT_KIND_LABELS[document.kind] : 'nota'}{document?.number ? ` nº ${document.number}` : ''}</DialogTitle><DialogDescription>{document?.origin === 'MANUAL' ? 'Esta nota foi emitida fora do Ofix: cancele também no portal onde ela foi emitida. Aqui fica só o registro.' : 'O cancelamento é enviado à prefeitura ou à SEFAZ e não pode ser desfeito. Respeite o prazo de cancelamento da sua cidade ou estado.'}</DialogDescription></DialogHeader>
    <label className="block space-y-1.5 text-sm font-medium">Motivo do cancelamento<Textarea className="min-h-20" maxLength={FISCAL_CANCEL_REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: valor lançado errado, nota emitida em duplicidade" /><span className="block text-xs font-normal text-text-muted">{length < FISCAL_CANCEL_REASON_MIN ? `Mínimo de ${FISCAL_CANCEL_REASON_MIN} caracteres (faltam ${FISCAL_CANCEL_REASON_MIN - length}).` : `${length}/${FISCAL_CANCEL_REASON_MAX}`}</span></label>
    <DialogFooter><Button variant="outline" onClick={onClose} disabled={cancel.isPending}>Voltar</Button><Button variant="destructive" onClick={submit} disabled={length < FISCAL_CANCEL_REASON_MIN || cancel.isPending}>{cancel.isPending ? 'Cancelando...' : 'Cancelar nota'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Notice({ tone, children }: { tone: 'danger' | 'warning'; children: React.ReactNode }) {
  return <div className={`rounded-button border p-3 text-xs ${tone === 'danger' ? 'border-danger/30 bg-danger-subtle text-danger-strong dark:text-danger' : 'border-warning/30 bg-warning-subtle text-warning-strong dark:text-warning'}`}>{children}</div>;
}
