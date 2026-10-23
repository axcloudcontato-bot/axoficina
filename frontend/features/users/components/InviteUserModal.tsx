'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Envelope } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractErrorMessage, extractFieldErrors } from '@/lib/api/client';
import { useInviteUser } from '../hooks/use-users';

// ADMIN de propósito fora daqui: contas admin só nascem via signup
// self-service — permitir convidar um ADMIN deixaria um Gerente promover
// alguém ao papel mais alto do tenant. Ver INVITABLE_ROLES em contracts.
const inviteSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  name: z.string().min(1, 'Informe o nome'),
  role: z.enum(['MANAGER', 'MECHANIC', 'FRONT_DESK']),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

const ROLE_OPTIONS: Array<{ value: InviteFormValues['role']; label: string }> = [
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'MECHANIC', label: 'Mecânico' },
  { value: 'FRONT_DESK', label: 'Recepção' },
];

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const invite = useInviteUser();
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', name: '', role: 'MECHANIC' },
  });

  function onSubmit(values: InviteFormValues) {
    invite.mutate(values, {
      onSuccess: (data) => {
        toast.success(`Convite criado para ${values.email}`, {
          description: `Link (dev/QA, sem envio de e-mail real ainda): ${data.inviteLink}`,
          duration: 10000,
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error) => {
        const fieldErrors = extractFieldErrors(error);
        if (Object.keys(fieldErrors).length > 0) {
          Object.entries(fieldErrors).forEach(([field, message]) => {
            form.setError(field as keyof InviteFormValues, { message });
          });
        } else {
          toast.error(extractErrorMessage(error));
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
              <Envelope className="size-[18px]" aria-hidden="true" />
            </span>
            Convidar usuário
          </DialogTitle>
          <DialogDescription>
            Sem envio de e-mail real ainda — o link do convite aparece aqui para você copiar e enviar
            manualmente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="pessoa@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
