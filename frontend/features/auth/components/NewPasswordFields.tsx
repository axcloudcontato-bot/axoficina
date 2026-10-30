'use client';

import { useId } from 'react';
import { MIN_PASSWORD_LENGTH } from '@oficina/contracts';
import { Input } from '@/components/ui/input';

export function newPasswordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirmation) return 'As duas senhas não são iguais.';
  return null;
}

export function NewPasswordFields({ password, confirmation, onPassword, onConfirmation }: { password: string; confirmation: string; onPassword: (value: string) => void; onConfirmation: (value: string) => void }) {
  const id = useId();
  return <>
    <div className="grid gap-1.5 text-sm font-semibold">
      <label htmlFor={`${id}-new`}>Nova senha</label>
      <Input id={`${id}-new`} type="password" autoComplete="new-password" aria-describedby={`${id}-hint`} value={password} onChange={event => onPassword(event.target.value)} />
      <span id={`${id}-hint`} className="text-xs font-normal text-text-muted">Pelo menos {MIN_PASSWORD_LENGTH} caracteres. Uma frase curta é mais fácil de lembrar e difícil de adivinhar.</span>
    </div>
    <label className="grid gap-1.5 text-sm font-semibold">Repita a nova senha<Input type="password" autoComplete="new-password" value={confirmation} onChange={event => onConfirmation(event.target.value)} /></label>
  </>;
}
