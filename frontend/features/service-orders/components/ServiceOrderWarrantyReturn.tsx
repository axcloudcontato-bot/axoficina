'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUUpLeft } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useMarkWarrantyReturn, useWarrantyReturn } from '../hooks/use-service-orders';

const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm';

// When the vehicle had an order delivered still under warranty, the team says whether this one is a return.
// A return counts as rework for the technicians of the earlier order.
export function ServiceOrderWarrantyReturn({ serviceOrderId, canManage }: { serviceOrderId: string; canManage: boolean }) {
  const query = useWarrantyReturn(serviceOrderId);
  const mark = useMarkWarrantyReturn(serviceOrderId);
  const [originalOrderId, setOriginalOrderId] = useState('');
  const [reason, setReason] = useState('');
  const data = query.data;
  if (!data || (!data.current && !data.candidates.length)) return null;
  if (data.current) {
    return <section className="rounded-card border border-warning/30 bg-warning/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-text"><ArrowUUpLeft className="size-4 text-warning" aria-hidden="true" />Retorno em garantia da <Link className="text-primary-strong underline-offset-2 hover:underline" href={`/ordens-de-servico/${data.current.originalOrderId}`}>OS #{data.current.orderNumber}</Link></p>
      {data.current.reason && <p className="mt-1 text-text-muted">{data.current.reason}</p>}
      <p className="mt-1 text-xs text-text-muted">Conta como retrabalho para quem fez a OS original, na Produtividade.</p>
      {canManage && <Button className="mt-2" size="sm" variant="outline" disabled={mark.isPending} onClick={() => mark.mutate({ originalOrderId: null })}>{mark.isPending ? 'Salvando…' : 'Não é retorno'}</Button>}
      {mark.isError && <p className="mt-2 text-danger-strong">{extractErrorMessage(mark.error)}</p>}
    </section>;
  }
  if (!canManage) return null;
  const chosen = originalOrderId || data.candidates[0].id;
  return <section className="rounded-card border border-border bg-card p-4 text-sm">
    <h3 className="font-bold text-text">Este veículo ainda está na garantia</h3>
    <p className="mt-1 text-text-muted">{data.candidates.length === 1 ? 'Há uma OS entregue com garantia valendo quando esta foi aberta.' : `Há ${data.candidates.length} OS entregues com garantia valendo quando esta foi aberta.`} Se o cliente voltou pelo mesmo problema, marque como retorno: conta como retrabalho para quem fez o serviço.</p>
    <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-end" onSubmit={event => { event.preventDefault(); if (!mark.isPending) mark.mutate({ originalOrderId: chosen, reason }); }}>
      <label className="space-y-1 text-xs font-semibold"><span>OS original</span><select className={selectClass} value={chosen} onChange={event => setOriginalOrderId(event.target.value)}>{data.candidates.map(entry => <option key={entry.id} value={entry.id}>OS #{entry.orderNumber} · {new Date(entry.deliveredAt).toLocaleDateString('pt-BR')}{entry.technicianName ? ` · ${entry.technicianName}` : ''}</option>)}</select></label>
      <label className="space-y-1 text-xs font-semibold"><span>O que voltou (opcional)</span><Input value={reason} maxLength={300} placeholder="Ex.: barulho na suspensão voltou" onChange={event => setReason(event.target.value)} /></label>
      <Button type="submit" size="sm" variant="outline" disabled={mark.isPending}>{mark.isPending ? 'Salvando…' : 'Marcar como retorno'}</Button>
    </form>
    {mark.isError && <p className="mt-2 text-danger-strong">{extractErrorMessage(mark.error)}</p>}
  </section>;
}
