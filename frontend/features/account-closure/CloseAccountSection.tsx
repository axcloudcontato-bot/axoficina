'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CLOSURE_GRACE_DAYS } from '@oficina/contracts';
import { Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { useSettings } from '@/features/settings/hooks/use-settings';
import { useAuthStore } from '@/stores/auth-store';
import { ConfirmByNameDialog } from './ConfirmByNameDialog';
import { useCloseOwnAccount } from './use-account-closure';

const SIGN_OUT_AFTER_MS = 5000;

// The administrator closing the whole workshop. Access ends at once; the data waits 30 days so the Ofix can still bring it back.
export function CloseAccountSection() {
  const settings = useSettings(true);
  const mutation = useCloseOwnAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgeAfter, setPurgeAfter] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const name = settings.data?.company.name;

  // Once closed, the session is no longer valid anyway: say what happened, then leave.
  useEffect(() => {
    if (!purgeAfter) return;
    timer.current = setTimeout(() => { logout(); queryClient.clear(); router.replace('/'); }, SIGN_OUT_AFTER_MS);
    return () => clearTimeout(timer.current);
  }, [purgeAfter, logout, queryClient, router]);

  if (!name) return null;

  if (purgeAfter) return <section aria-label="Conta encerrada" role="status" className="rounded-card border border-border bg-card p-5 shadow-sm">
    <h2 className="text-base font-bold">Conta encerrada</h2>
    <p className="mt-2 text-sm text-text-muted">A cobrança foi cancelada e o acesso terminou. Os dados ficam guardados até {new Date(purgeAfter).toLocaleDateString('pt-BR')}; depois disso são apagados de vez. Para voltar atrás nesse prazo, fale com o suporte do Ofix. Você será desconectado em instantes.</p>
  </section>;

  return <section aria-label="Encerrar a conta" className="rounded-card border border-danger/30 bg-card p-5 shadow-sm">
    <h2 className="flex items-center gap-2 text-base font-bold text-danger-strong"><Warning className="size-5" aria-hidden="true" />Encerrar a conta da oficina</h2>
    <p className="mt-2 text-sm text-text-muted">Encerra a oficina inteira: ninguém da equipe consegue mais entrar e a assinatura é cancelada na hora. Os dados ficam guardados por {CLOSURE_GRACE_DAYS} dias, para o caso de você se arrepender, e depois são apagados de vez. Antes, baixe uma cópia em Exportar os dados.</p>
    <Button className="mt-4" variant="outline" size="sm" onClick={() => { setError(null); setOpen(true); }}>Encerrar a conta</Button>
    {open && <ConfirmByNameDialog
      title="Encerrar a conta da oficina?"
      description={<>Esta ação encerra <strong>{name}</strong> para todos os usuários. Você poderá pedir a restauração ao suporte do Ofix em até {CLOSURE_GRACE_DAYS} dias.</>}
      expectedName={name}
      extra="password"
      confirmLabel="Encerrar a conta"
      pending={mutation.isPending}
      error={error}
      onClose={() => setOpen(false)}
      onConfirm={async ({ confirmName, password }) => {
        setError(null);
        try {
          const result = await mutation.mutateAsync({ password, confirmName });
          setOpen(false);
          setPurgeAfter(result.purgeAfter);
        } catch (failure) {
          setError(extractErrorMessage(failure, 'Não foi possível encerrar a conta agora.'));
        }
      }}
    />}
  </section>;
}
