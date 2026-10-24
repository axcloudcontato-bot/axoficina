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
import { extractErrorMessage } from '@/lib/api/client';
import { useAcceptInvite } from '@/features/users/hooks/use-users';

const acceptInviteSchema = z.object({
  acceptedTerms: z.boolean().refine((value) => value, 'Aceite os Termos de uso para continuar.'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`),
});

type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

export function AcceptInviteForm({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const acceptInvite = useAcceptInvite();
  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { password: '', acceptedTerms: false },
  });

  function onSubmit(values: AcceptInviteFormValues) {
    acceptInvite.mutate(
      { inviteToken, password: values.password, acceptedTerms: values.acceptedTerms, legalVersion: LEGAL_VERSION },
      {
        onSuccess: () => {
          toast.success('Conta ativada! Bem-vindo(a).');
          router.push('/users');
        },
        onError: (error) => {
          toast.error(extractErrorMessage(error, 'Não foi possível aceitar o convite.'));
        },
      },
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Crie sua senha</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <LegalAcceptance form={form} />
        <Button type="submit" disabled={acceptInvite.isPending} className="mt-2">
          {acceptInvite.isPending ? 'Ativando conta...' : 'Ativar minha conta'}
        </Button>
      </form>
    </Form>
  );
}
