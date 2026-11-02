'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCallback, useState } from 'react';
import { LEGAL_VERSION } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { extractErrorCode, extractErrorMessage } from '@/lib/api/client';
import { LegalAcceptance } from '@/features/privacy/components/LegalAcceptance';
import { useGoogleLogin, useGoogleSignup, useLogin } from '../hooks/use-auth';
import { GoogleButton } from './GoogleButton';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const googleLogin = useGoogleLogin();
  const googleSignup = useGoogleSignup();
  const [newGoogleCredential, setNewGoogleCredential] = useState<string | null>(null);
  const signupForm = useForm<{ acceptedTerms: boolean }>({ defaultValues: { acceptedTerms: false } });
  const onGoogleCredential = useCallback((credential: string) => {
    googleLogin.mutate(credential, { onSuccess: () => router.push('/painel'), onError: (error) => {
      if (extractErrorCode(error) === 'USER_NOT_FOUND') {
        setNewGoogleCredential(credential);
        return;
      }
      toast.error(extractErrorMessage(error));
    } });
  }, [googleLogin, router]);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  function onSubmit(values: LoginFormValues) {
    login.mutate(values, {
      onSuccess: () => {
        router.push('/painel');
      },
      onError: (error) => {
        toast.error(extractErrorMessage(error, 'E-mail ou senha inválidos.'));
      },
    });
  }

  return (
    <div className="space-y-5">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="voce@oficina.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2"><FormLabel>Senha</FormLabel><Link href="/esqueci-a-senha" className="text-xs font-semibold text-primary hover:underline">Esqueci minha senha</Link></div>
              <FormControl>
                <Input type="password" placeholder="Sua senha" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={login.isPending} className="mt-2">
          {login.isPending ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </Form>
    {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <div className="flex items-center gap-3 text-xs text-text-muted"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>}
    <GoogleButton text="signin_with" onCredential={onGoogleCredential} />
    <Dialog open={Boolean(newGoogleCredential)} onOpenChange={(open) => { if (!open && !googleSignup.isPending) setNewGoogleCredential(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Criar conta com Google</DialogTitle><DialogDescription>Você vai direto para a configuração inicial da oficina após aceitar os termos.</DialogDescription></DialogHeader>
        <Form {...signupForm}><form className="space-y-4" onSubmit={signupForm.handleSubmit(({ acceptedTerms }) => {
          if (!acceptedTerms) return signupForm.setError('acceptedTerms', { message: 'Aceite os Termos de uso para continuar.' });
          if (!newGoogleCredential) return;
          googleSignup.mutate({ credential: newGoogleCredential, acceptedTerms, legalVersion: LEGAL_VERSION }, {
            onSuccess: () => { setNewGoogleCredential(null); router.push('/primeiros-passos'); },
            onError: (error) => toast.error(extractErrorMessage(error)),
          });
        })}>
          <LegalAcceptance form={signupForm} />
          <DialogFooter><Button type="button" variant="outline" disabled={googleSignup.isPending} onClick={() => setNewGoogleCredential(null)}>Cancelar</Button><Button type="submit" disabled={googleSignup.isPending}>{googleSignup.isPending ? 'Criando conta...' : 'Continuar'}</Button></DialogFooter>
        </form></Form>
      </DialogContent>
    </Dialog>
    </div>
  );
}
