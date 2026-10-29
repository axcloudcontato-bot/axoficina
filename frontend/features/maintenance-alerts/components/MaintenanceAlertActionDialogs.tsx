'use client';

import { useEffect, useId, useState } from 'react';
import {
  MAINTENANCE_ALERT_DISMISS_REASONS,
  MAINTENANCE_ALERT_DISMISS_REASON_LABELS,
  MAINTENANCE_ALERT_SNOOZE_DAYS,
  type MaintenanceAlertDismissReason,
  type MaintenanceAlertListItemResponse,
} from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/api/client';
import { useDismissMaintenanceAlert, useSnoozeMaintenanceAlert } from '../hooks/use-maintenance-alerts';

const label = (alert: MaintenanceAlertListItemResponse) => `${alert.vehicleBrand} ${alert.vehicleModel} · ${alert.vehiclePlate}`;

// Postponing: the customer is not forgotten, the alert comes back by itself.
export function SnoozeAlertDialog({ alert, onClose }: { alert?: MaintenanceAlertListItemResponse; onClose: () => void }) {
  const snooze = useSnoozeMaintenanceAlert();

  function choose(days: 30 | 60 | 90) {
    if (!alert || snooze.isPending) return;
    snooze.mutate({ id: alert.id, days }, {
      onSuccess: () => { toast.success(`Alerta adiado por ${days} dias. Ele volta sozinho depois.`); onClose(); },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={Boolean(alert)} onOpenChange={(open) => { if (!open && !snooze.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Adiar alerta</DialogTitle>
        <DialogDescription>{alert ? label(alert) : ''}. O alerta sai da lista agora e volta sozinho quando o prazo acabar, se o carro continuar sem revisão.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-3 gap-2">
        {MAINTENANCE_ALERT_SNOOZE_DAYS.map((days) => <Button key={days} variant="outline" disabled={snooze.isPending} onClick={() => choose(days)}>{days} dias</Button>)}
      </div>
      <DialogFooter><Button variant="ghost" disabled={snooze.isPending} onClick={onClose}>Cancelar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

// Dismissing: the customer leaves the list and the reason stays, so nobody wonders why later.
export function DismissAlertDialog({ alert, onClose }: { alert?: MaintenanceAlertListItemResponse; onClose: () => void }) {
  const dismiss = useDismissMaintenanceAlert();
  const id = useId();
  const [reason, setReason] = useState<MaintenanceAlertDismissReason | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => { if (alert) { setReason(''); setNote(''); } }, [alert]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!alert || dismiss.isPending) return;
    if (!reason) return void toast.error('Escolha o motivo da dispensa.');
    dismiss.mutate({ id: alert.id, reason, ...(note.trim() ? { note: note.trim() } : {}) }, {
      onSuccess: () => { toast.success('Alerta dispensado. O motivo ficou registrado.'); onClose(); },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={Boolean(alert)} onOpenChange={(open) => { if (!open && !dismiss.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Dispensar alerta</DialogTitle>
        <DialogDescription>{alert ? label(alert) : ''}. Use quando este cliente não deve mais ser procurado por este carro. O motivo fica registrado e dá para reabrir depois.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={dismiss.isPending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-reason`}>Motivo</Label>
            <select id={`${id}-reason`} className="h-10 w-full rounded-button border border-input bg-background px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value as MaintenanceAlertDismissReason)}>
              <option value="">Escolha o motivo</option>
              {MAINTENANCE_ALERT_DISMISS_REASONS.map((value) => <option key={value} value={value}>{MAINTENANCE_ALERT_DISMISS_REASON_LABELS[value]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-note`}>Observação (opcional)</Label>
            <Input id={`${id}-note`} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: vendeu para um conhecido em setembro" />
            <p className="text-xs text-text-muted">Só para a equipe. Não inclua dados pessoais do cliente.</p>
          </div>
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={dismiss.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" variant="destructive" disabled={dismiss.isPending}>{dismiss.isPending ? 'Dispensando...' : 'Dispensar'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
