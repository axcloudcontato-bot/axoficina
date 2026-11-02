'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { LEGAL_VERSION } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { LegalAcceptance } from '@/features/privacy/components/LegalAcceptance';
import { extractErrorMessage } from '@/lib/api/client';
import { useGoogleSignup } from '../hooks/use-auth';
import { GoogleButton } from './GoogleButton';

export const GOOGLE_SIGNUP_CREDENTIAL_KEY = 'ofix-google-signup-credential';

export function GoogleSignup() {
  const router = useRouter();
  const signup = useGoogleSignup();
  const [credential, setCredential] = useState<string | null>(null);
  const form = useForm<{ acceptedTerms: boolean }>({ defaultValues: { acceptedTerms: false } });
  const handleCredential = useCallback((value: string) => setCredential(value), []);

  // An unknown Google account selected on /entrar continues here without asking the user to choose it again.
  useEffect(() => {
    const pending = sessionStorage.getItem(GOOGLE_SIGNUP_CREDENTIAL_KEY);
    if (pending) {
      setCredential(pending);
      sessionStorage.removeItem(GOOGLE_SIGNUP_CREDENTIAL_KEY);
    }
  }, []);

  return <div className="space-y-4">
    <GoogleButton text="signup_with" onCredential={handleCredential} />
    {credential && <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(({ acceptedTerms }) => {
      if (!acceptedTerms) return form.setError('acceptedTerms', { message: 'Aceite os Termos de uso para continuar.' });
      signup.mutate({ credential, acceptedTerms, legalVersion: LEGAL_VERSION }, {
        onSuccess: () => { toast.success('Conta criada! Vamos configurar sua oficina.'); router.push('/primeiros-passos'); },
        onError: (error) => toast.error(extractErrorMessage(error)),
      });
    })}>
      <p className="text-sm text-text-muted">Conta Google selecionada. Aceite os termos para continuar; os dados da oficina serão pedidos nos primeiros passos.</p>
      <LegalAcceptance form={form} />
      <Button type="submit" disabled={signup.isPending}>{signup.isPending ? 'Criando conta...' : 'Continuar com Google'}</Button>
    </form></Form>}
  </div>;
}
