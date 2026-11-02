'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LEGAL_VERSION } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LegalAcceptance } from '@/features/privacy/components/LegalAcceptance';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { extractErrorMessage } from '@/lib/api/client';
import { useGoogleSignup } from '../hooks/use-auth';
import { GoogleButton } from './GoogleButton';

type Values = { tenantName: string; tenantDocument: string; acceptedTerms: boolean };

export function GoogleSignup() {
  const router = useRouter();
  const signup = useGoogleSignup();
  const [credential, setCredential] = useState<string | null>(null);
  const form = useForm<Values>({ defaultValues: { tenantName: '', tenantDocument: '', acceptedTerms: false } });
  const handleCredential = useCallback((value: string) => setCredential(value), []);

  return <div className="space-y-4">
    <GoogleButton text="signup_with" onCredential={handleCredential} />
    {credential && <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => {
      if (!values.tenantName.trim()) return form.setError('tenantName', { message: 'Informe o nome da oficina' });
      if (!values.tenantDocument.trim()) return form.setError('tenantDocument', { message: 'Informe um CPF ou CNPJ válido' });
      if (!values.acceptedTerms) return form.setError('acceptedTerms', { message: 'Aceite os Termos de uso para continuar.' });
      signup.mutate({ ...values, credential, legalVersion: LEGAL_VERSION }, {
        onSuccess: () => { toast.success('Oficina criada com sucesso!'); router.push('/primeiros-passos'); },
        onError: (error) => toast.error(extractErrorMessage(error)),
      });
    })}>
      <p className="text-sm text-text-muted">Complete os dados da oficina para criar sua conta com Google.</p>
      <label className="block space-y-1 text-sm">Nome da oficina<Input {...form.register('tenantName')} />{form.formState.errors.tenantName && <span className="text-destructive">{form.formState.errors.tenantName.message}</span>}</label>
      <label className="block space-y-1 text-sm">CPF ou CNPJ<Input {...form.register('tenantDocument')} />{form.formState.errors.tenantDocument && <span className="text-destructive">{form.formState.errors.tenantDocument.message}</span>}</label>
      <LegalAcceptance form={form} />
      <Button type="submit" disabled={signup.isPending}>{signup.isPending ? 'Criando oficina...' : 'Criar oficina com Google'}</Button>
    </form></Form>}
  </div>;
}
