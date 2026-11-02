'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useGoogleLogin, useLogin } from '../hooks/use-auth';
import { GoogleButton } from './GoogleButton';
import { useCallback } from 'react';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const googleLogin = useGoogleLogin();
  const onGoogleCredential = useCallback((credential: string) => {
    googleLogin.mutate(credential, { onSuccess: () => router.push('/painel'), onError: (error) => toast.error(extractErrorMessage(error)) });
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
    </div>
  );
}
