'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { SubscriptionResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { formatSubscriptionDate } from '@/features/subscriptions/subscription-labels';
import { ConfirmByNameDialog } from './ConfirmByNameDialog';
import { useAdminPurge, useAdminRestore } from './use-account-closure';

const DAY_MS = 86_400_000;
const daysLeft = (purgeAfter: string | null) => (purgeAfter ? Math.max(0, Math.ceil((new Date(purgeAfter).getTime() - Date.now()) / DAY_MS)) : null);

// The workshops waiting to be erased: the manager restores one, or erases it for good before the time is up.
export function ClosedWorkshopsTable({ items }: { items: SubscriptionResponse[] }) {
  const restore = useAdminRestore();
  const purge = useAdminPurge();
  const [purging, setPurging] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restoreOne(item: SubscriptionResponse) {
    if (!window.confirm(`Restaurar ${item.name}? Os usuários voltam a entrar. A assinatura não volta: a oficina precisa contratar um plano de novo.`)) return;
    try { await restore.mutateAsync(item.id); toast.success(`${item.name} restaurada.`); } catch (failure) { toast.error(extractErrorMessage(failure, 'Não foi possível restaurar a oficina.')); }
  }

  return <div className="overflow-x-auto">
    <table className="w-full min-w-[760px] text-sm">
      <thead><tr className="border-b border-border bg-muted/40 text-left text-xs text-text-muted">{['Oficina', 'Encerrada', 'Por quem', 'Apagada de vez', ''].map((label, index) => <th key={index} scope="col" className="px-4 py-3 font-semibold">{label || <span className="sr-only">Ações</span>}</th>)}</tr></thead>
      <tbody className="divide-y divide-border">{items.map((item) => {
        const left = daysLeft(item.purgeAfter);
        return <tr key={item.id}>
          <td className="max-w-[260px] px-4 py-4"><p className="truncate font-semibold" title={item.name}>{item.name}</p>{item.email && <p className="mt-1 truncate text-xs text-text-muted">{item.email}</p>}</td>
          <td className="whitespace-nowrap px-4 py-4 text-text-muted tabular-nums">{formatSubscriptionDate(item.closedAt)}</td>
          <td className="px-4 py-4"><p>{item.closedBy === 'owner' ? 'O próprio cliente' : 'Gestor do SaaS'}</p>{item.closureReason && <p className="mt-1 text-xs text-text-muted">{item.closureReason}</p>}</td>
          <td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatSubscriptionDate(item.purgeAfter)}{left !== null && <p className="mt-1 text-xs text-text-muted">{left === 0 ? 'hoje' : left === 1 ? 'falta 1 dia' : `faltam ${left} dias`}</p>}</td>
          <td className="px-4 py-4"><div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restoreOne(item)} aria-label={`Restaurar ${item.name}`}>Restaurar</Button>
            <Button size="sm" variant="destructive" onClick={() => { setError(null); setPurging(item); }} aria-label={`Apagar ${item.name} de vez`}>Apagar de vez</Button>
          </div></td>
        </tr>;
      })}</tbody>
    </table>
    {purging && <ConfirmByNameDialog
      key={purging.id}
      title="Apagar a oficina de vez?"
      description={<>Todos os dados de <strong>{purging.name}</strong> (clientes, veículos, ordens de serviço, financeiro, fotos e usuários) serão apagados <strong>sem volta</strong>. Passados os 30 dias isso acontece sozinho; aqui você antecipa.</>}
      expectedName={purging.name}
      confirmLabel="Apagar de vez"
      pending={purge.isPending}
      error={error}
      onClose={() => setPurging(null)}
      onConfirm={async ({ confirmName }) => {
        setError(null);
        try { await purge.mutateAsync({ id: purging.id, input: { confirmName } }); toast.success('Oficina apagada.'); setPurging(null); } catch (failure) { setError(extractErrorMessage(failure, 'Não foi possível apagar a oficina agora.')); }
      }}
    />}
  </div>;
}
