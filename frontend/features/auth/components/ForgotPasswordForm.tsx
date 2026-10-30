'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useForgotPassword } from '../hooks/use-auth';

export function ForgotPasswordForm() {
  const request = useForgotPassword();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  if (sentTo) return <div role="status" className="space-y-4 text-sm">
    <p>Se <strong>{sentTo}</strong> tiver uma conta ativa, enviamos um link para criar uma nova senha. Ele vale por 1 hora.</p>
    <p className="text-text-muted">Não chegou? Confira o spam. Se a oficina não tiver e-mail configurado, peça ao administrador do Ofix da sua oficina: em Configurações, Equipe, ele gera um link de nova senha para você.</p>
    <Link href="/entrar" className="font-semibold text-primary hover:underline">Voltar para o login</Link>
  </div>;
  return <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); if (!request.isPending && /.+@.+\..+/.test(email.trim())) request.mutate({ email: email.trim() }, { onSuccess: () => setSentTo(email.trim()) }); }}>
    <label className="grid gap-1.5 text-sm font-semibold">E-mail da sua conta<Input type="email" autoComplete="email" placeholder="voce@oficina.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
    {request.isError && <p role="alert" className="text-sm text-danger">{extractErrorMessage(request.error, 'Não foi possível enviar agora. Tente novamente em instantes.')}</p>}
    <Button type="submit" loading={request.isPending} disabled={!/.+@.+\..+/.test(email.trim())}>{request.isPending ? 'Enviando...' : 'Enviar link'}</Button>
  </form>;
}
