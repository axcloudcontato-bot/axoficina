'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { LEGAL_VERSION, MIN_PASSWORD_LENGTH } from '@oficina/contracts';
import { LegalAcceptance } from '@/features/privacy/components/LegalAcceptance';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { extractErrorMessage, extractFieldErrors } from '@/lib/api/client';
import { useSignup } from '../hooks/use-auth';

const signupSchema = z.object({
  acceptedTerms: z.boolean().refine((value) => value, 'Aceite os Termos de uso para continuar.'),
  tenantName: z.string().min(1, 'Informe o nome da oficina'),
  tenantDocument: z.string().min(11, 'Informe um CPF ou CNPJ válido'),
  adminName: z.string().min(1, 'Informe seu nome'),
  adminEmail: z.string().email('Informe um e-mail válido'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const signup = useSignup();
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { acceptedTerms: false, tenantName: '', tenantDocument: '', adminName: '', adminEmail: '', password: '' },
  });

  function onSubmit(values: SignupFormValues) {
    signup.mutate({ ...values, legalVersion: LEGAL_VERSION }, {
      onSuccess: () => {
        toast.success('Oficina criada com sucesso!');
        router.push('/primeiros-passos');
      },
      onError: (error) => {
        const fieldErrors = extractFieldErrors(error);
        if (Object.keys(fieldErrors).length > 0) {
          Object.entries(fieldErrors).forEach(([field, message]) => {
            form.setError(field as keyof SignupFormValues, { message });
          });
        } else {
          toast.error(extractErrorMessage(error));
        }
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="tenantName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da oficina</FormLabel>
              <FormControl>
                <Input placeholder="Oficina do Zé" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tenantDocument"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CPF ou CNPJ</FormLabel>
              <FormControl>
                <Input placeholder="00.000.000/0000-00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="adminName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seu nome</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="adminEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="voce@oficina.com" {...field} />
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
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <LegalAcceptance form={form} />
        <Button type="submit" disabled={signup.isPending} className="mt-2">
          {signup.isPending ? 'Criando oficina...' : 'Criar minha oficina'}
        </Button>
      </form>
    </Form>
  );
}
