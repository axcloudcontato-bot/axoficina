'use client';

import { useEffect, useId, useState } from 'react';
import {
  MAINTENANCE_ALERT_CONTACT_OUTCOMES,
  MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS,
  type MaintenanceAlertContactOutcome,
  type MaintenanceAlertListItemResponse,
} from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/api/client';
import { useMaintenanceAlertContacts, useRecordMaintenanceAlertContact } from '../hooks/use-maintenance-alerts';

const when = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Writes down an attempt to reach the customer, so two people do not call the same one, and shows what was already tried.
export function ContactAlertDialog({ alert, onClose }: { alert?: MaintenanceAlertListItemResponse; onClose: () => void }) {
  const record = useRecordMaintenanceAlertContact();
  const history = useMaintenanceAlertContacts(alert?.id, Boolean(alert));
  const id = useId();
  const [outcome, setOutcome] = useState<MaintenanceAlertContactOutcome | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => { if (alert) { setOutcome(''); setNote(''); } }, [alert]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!alert || record.isPending) return;
    if (!outcome) return void toast.error('Escolha o que aconteceu no contato.');
    record.mutate({ id: alert.id, outcome, ...(note.trim() ? { note: note.trim() } : {}) }, {
      onSuccess: () => { toast.success('Contato registrado.'); onClose(); },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  const contacts = history.data?.contacts ?? [];

  return <Dialog open={Boolean(alert)} onOpenChange={(open) => { if (!open && !record.isPending) onClose(); }}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Registrar contato</DialogTitle>
        <DialogDescription>{alert ? `${alert.customerName} · ${alert.vehicleBrand} ${alert.vehicleModel}` : ''}. Anote o que aconteceu para a equipe não repetir o contato.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={record.isPending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-outcome`}>O que aconteceu</Label>
            <select id={`${id}-outcome`} className="h-10 w-full rounded-button border border-input bg-background px-3 text-sm" value={outcome} onChange={(event) => setOutcome(event.target.value as MaintenanceAlertContactOutcome)}>
              <option value="">Escolha</option>
              {MAINTENANCE_ALERT_CONTACT_OUTCOMES.map((value) => <option key={value} value={value}>{MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS[value]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-note`}>Observação (opcional)</Label>
            <Input id={`${id}-note`} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: pediu para ligar na sexta" />
            <p className="text-xs text-text-muted">Só para a equipe. Não inclua dados pessoais do cliente.</p>
          </div>
        </fieldset>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={record.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={record.isPending}>{record.isPending ? 'Salvando...' : 'Registrar'}</Button></DialogFooter>
      </form>
      {contacts.length > 0 && <section aria-label="Contatos anteriores" className="border-t border-border pt-3">
        <h3 className="text-sm font-bold text-text">Contatos anteriores</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {contacts.map((contact) => <li key={contact.id}>
            <span className="font-semibold text-text">{MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS[contact.outcome]}</span>
            <span className="text-text-muted"> · {when(contact.at)}{contact.byName ? ` · ${contact.byName}` : ''}</span>
            {contact.note && <span className="block text-xs text-text-muted">{contact.note}</span>}
          </li>)}
        </ul>
      </section>}
    </DialogContent>
  </Dialog>;
}
