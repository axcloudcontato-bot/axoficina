'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useChangePassword } from '../hooks/use-auth';
import { NewPasswordFields, newPasswordProblem } from './NewPasswordFields';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrador', MANAGER: 'Gerente', FRONT_DESK: 'Atendimento', MECHANIC: 'Mecânico' };

export function MyAccount() {
  const user = useAuthStore(state => state.user);
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState(false);
  const problem = !current ? 'Informe a senha atual.' : newPasswordProblem(password, confirmation);
  function submit() {
    setTouched(true);
    if (problem || change.isPending) return;
    change.mutate({ currentPassword: current, newPassword: password }, {
      onSuccess: () => { toast.success('Senha alterada. Os outros aparelhos conectados à sua conta foram desconectados.'); setCurrent(''); setPassword(''); setConfirmation(''); setTouched(false); },
      onError: error => toast.error(extractErrorMessage(error, 'Não foi possível alterar a senha.')),
    });
  }
  if (!user) return null;
  return <div className="space-y-6">
    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Seus dados</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-xs font-semibold text-text-muted">Nome</dt><dd className="mt-1 font-semibold">{user.name}</dd></div>
        <div><dt className="text-xs font-semibold text-text-muted">E-mail de acesso</dt><dd className="mt-1 break-all font-semibold">{user.email}</dd></div>
        <div><dt className="text-xs font-semibold text-text-muted">Perfil</dt><dd className="mt-1 font-semibold">{user.profileName ?? ROLE_LABELS[user.role] ?? user.role}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-text-muted">Para mudar o nome ou o e-mail, peça a um administrador da oficina em Configurações, Equipe.</p>
    </section>
    <form className="rounded-card border border-border bg-card p-5 shadow-sm" onSubmit={event => { event.preventDefault(); submit(); }}>
      <h2 className="text-base font-bold">Trocar senha</h2>
      <p className="mt-1 text-sm text-text-muted">Ao trocar, os outros aparelhos conectados à sua conta saem e precisam entrar de novo. Este continua conectado.</p>
      <div className="mt-4 grid max-w-md gap-4">
        <label className="grid gap-1.5 text-sm font-semibold">Senha atual<Input type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} /></label>
        <NewPasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
        {touched && problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        <div><Button type="submit" loading={change.isPending}>{change.isPending ? 'Salvando...' : 'Trocar senha'}</Button></div>
      </div>
    </form>
  </div>;
}
