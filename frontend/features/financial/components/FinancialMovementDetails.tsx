'use client';

import { useState } from 'react';
import type { FinancialEntryResponse } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/api/client';
import { financialApi } from '../api/financial-api';
import { useFinancialAttachments, useReconcileFinancialMovement, useReverseFinancialPayment, useUploadFinancialAttachment } from '../hooks/use-financial';

export function FinancialMovementDetails({ entry, onClose, canManage }: { entry?: FinancialEntryResponse; onClose: () => void; canManage: boolean }) {
  const entryId = entry?.source === 'MANUAL' ? entry.id : entry?.parentEntryId;
  const attachments = useFinancialAttachments(entryId);
  const upload = useUploadFinancialAttachment();
  const reconcile = useReconcileFinancialMovement();
  const reverse = useReverseFinancialPayment();
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  async function uploadFile(file?: File) {
    if (!file || !entryId) return;
    if (file.size > 2_000_000) return toast.error('O comprovante deve ter até 2 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      const dataBase64 = String(reader.result).split(',')[1];
      upload.mutate({ entryId, name: file.name, mimeType: file.type, dataBase64 }, { onSuccess: () => toast.success('Comprovante anexado.'), onError: error => toast.error(extractErrorMessage(error)) });
    };
    reader.readAsDataURL(file);
  }
  async function download(attachmentId: string) {
    if (!entryId) return;
    try {
      const file = await financialApi.downloadAttachment(entryId, attachmentId);
      const bytes = Uint8Array.from(atob(file.dataBase64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(extractErrorMessage(error)); }
  }
  return <Dialog open={Boolean(entry)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{entry?.description}</DialogTitle></DialogHeader>
    {entry?.status === 'PAID' && <section className="space-y-2"><h3 className="font-semibold">Conciliação</h3><p className="text-sm text-text-muted">{entry.reconciledAt ? `Conferido · referência ${entry.bankReference}` : 'Ainda não conferido com o extrato ou a fatura.'}</p>{canManage && <div className="flex gap-2"><Input aria-label="Referência do extrato ou cartão" placeholder="Referência do extrato ou cartão" value={reference} onChange={event => setReference(event.target.value)} /><Button disabled={reconcile.isPending || !reference.trim()} onClick={() => reconcile.mutate({ source: entry.source, sourceId: entry.id, bankReference: reference }, { onSuccess: () => { toast.success('Movimento conciliado.'); setReference(''); onClose(); }, onError: error => toast.error(extractErrorMessage(error)) })}>Conferir</Button></div>}</section>}
    {entry?.source === 'PAYMENT' && canManage && <section className="space-y-2 border-t border-border pt-4"><h3 className="font-semibold">Estornar baixa</h3><Input aria-label="Motivo do estorno" placeholder="Motivo do estorno" value={reason} onChange={event => setReason(event.target.value)} /><Button variant="outline" disabled={!reason.trim() || reverse.isPending} onClick={() => reverse.mutate({ id: entry.id, reason }, { onSuccess: () => { toast.success('Baixa estornada.'); setReason(''); onClose(); }, onError: error => toast.error(extractErrorMessage(error)) })}>Estornar esta baixa</Button></section>}
    {entryId && <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">Comprovantes</h3>{attachments.isLoading && <p className="text-sm">Carregando…</p>}{attachments.isError && <Button variant="outline" onClick={() => attachments.refetch()}>Tentar novamente</Button>}{attachments.data?.attachments.map(item => <Button key={item.id} variant="ghost" className="block" onClick={() => download(item.id)}>{item.name}</Button>)}{attachments.isSuccess && !attachments.data.attachments.length && <p className="text-sm text-text-muted">Nenhum comprovante anexado.</p>}{canManage && <div><Label htmlFor="financial-attachment">Anexar PDF, PNG ou JPEG de até 2 MB</Label><Input id="financial-attachment" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={upload.isPending} onChange={event => uploadFile(event.target.files?.[0])} /></div>}</section>}
  </DialogContent></Dialog>;
}
