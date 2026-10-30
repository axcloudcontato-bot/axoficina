'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { useResetPassword } from '../hooks/use-auth';
import { NewPasswordFields, newPasswordProblem } from './NewPasswordFields';

export function ResetPasswordForm({ token }: { token: string }) {
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState(false);
  const problem = newPasswordProblem(password, confirmation);
  if (reset.isSuccess) return <div role="status" className="space-y-4 text-sm"><p>Senha criada. Por segurança, todos os aparelhos que estavam conectados à sua conta foram desconectados.</p><Button asChild><Link href="/entrar">Entrar com a nova senha</Link></Button></div>;
  return <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); setTouched(true); if (!problem && !reset.isPending) reset.mutate({ token, password }); }}>
    <NewPasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
    {touched && problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
    {reset.isError && <p role="alert" className="text-sm text-danger">{extractErrorMessage(reset.error, 'Não foi possível criar a nova senha.')} <Link href="/esqueci-a-senha" className="font-semibold underline">Pedir um novo link</Link></p>}
    <Button type="submit" loading={reset.isPending}>{reset.isPending ? 'Salvando...' : 'Criar nova senha'}</Button>
  </form>;
}
