'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CLOSURE_GRACE_DAYS, type SubscriptionResponse } from '@oficina/contracts';
import { extractErrorMessage } from '@/lib/api/client';
import { ConfirmByNameDialog } from './ConfirmByNameDialog';
import { useAdminClose } from './use-account-closure';

// The SaaS manager closing a workshop: access and billing end now, the data waits for the grace period.
export function CloseWorkshopDialog({ workshop, onClose }: { workshop: SubscriptionResponse; onClose: () => void }) {
  const mutation = useAdminClose();
  const [error, setError] = useState<string | null>(null);
  return <ConfirmByNameDialog
    title="Encerrar esta oficina?"
    description={<>O acesso de <strong>{workshop.name}</strong> termina agora e a assinatura no Stripe é cancelada. Os dados ficam guardados por {CLOSURE_GRACE_DAYS} dias, na aba Encerradas, onde você pode restaurar ou apagar de vez.</>}
    expectedName={workshop.name}
    extra="reason"
    confirmLabel="Encerrar a oficina"
    pending={mutation.isPending}
    error={error}
    onClose={onClose}
    onConfirm={async ({ reason }) => {
      setError(null);
      try {
        await mutation.mutateAsync({ id: workshop.id, input: { reason: reason.trim() || null } });
        toast.success(`${workshop.name} encerrada.`);
        onClose();
      } catch (failure) {
        setError(extractErrorMessage(failure, 'Não foi possível encerrar a oficina agora.'));
      }
    }}
  />;
}
