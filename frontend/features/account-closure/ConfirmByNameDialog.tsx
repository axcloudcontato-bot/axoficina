'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ConfirmValues { confirmName: string; password: string; reason: string }

const same = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

// An irreversible action asked for in a deliberate way: the workshop's name has to be typed, and one more thing when it matters.
export function ConfirmByNameDialog({ title, description, expectedName, extra, confirmLabel, pending, error, onConfirm, onClose, children }: {
  title: string;
  description: ReactNode;
  expectedName: string;
  /** What else is asked: the administrator's password, a reason for the record, or nothing. */
  extra?: 'password' | 'reason';
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: (values: ConfirmValues) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const id = useId();
  const [confirmName, setConfirmName] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const ready = same(confirmName, expectedName) && (extra !== 'password' || password.length > 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready && !pending) onConfirm({ confirmName, password, reason });
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription asChild><div>{description}</div></DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {children}
        <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
          {extra === 'reason' && <div className="space-y-1.5"><Label htmlFor={`${id}-reason`}>Motivo (fica no registro)</Label><Textarea id={`${id}-reason`} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor={`${id}-name`}>Para confirmar, digite o nome da oficina: <strong>{expectedName}</strong></Label><Input id={`${id}-name`} autoComplete="off" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} /></div>
          {extra === 'password' && <div className="space-y-1.5"><Label htmlFor={`${id}-password`}>Sua senha atual</Label><Input id={`${id}-password`} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>}
        </fieldset>
        {error && <p role="alert" className="rounded-button border border-danger/20 bg-danger-subtle p-3 text-sm text-danger-strong">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="destructive" disabled={!ready || pending}>{pending ? 'Aguarde...' : confirmLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
