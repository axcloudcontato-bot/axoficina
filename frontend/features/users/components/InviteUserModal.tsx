'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
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
import type { InviteUserResponse } from '@oficina/contracts';

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
  const [result, setResult] = useState<InviteUserResponse | null>(null);
  const close = (value: boolean) => { if (!value) setResult(null); onOpenChange(value); };
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', name: '', role: 'MECHANIC' },
  });

  function onSubmit(values: InviteFormValues) {
    invite.mutate(values, {
      onSuccess: (data) => {
        setResult(data);
        form.reset();
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
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {result ? <div className="space-y-4"><DialogHeader><DialogTitle>Convite criado</DialogTitle><DialogDescription>{result.emailSent ? `Enviado para ${result.user.email}. Guarde o link se quiser encaminhá-lo por outro canal.` : `O e-mail não foi enviado. Copie o link e encaminhe para ${result.user.email}.`}</DialogDescription></DialogHeader><Input readOnly value={result.inviteLink} onFocus={(event) => event.target.select()} aria-label="Link do convite" /><DialogFooter><Button variant="outline" onClick={() => close(false)}>Concluir</Button><Button onClick={async () => { try { await navigator.clipboard.writeText(result.inviteLink); toast.success('Link copiado.'); } catch { toast.error('Selecione o link e copie manualmente.'); } }}>Copiar link</Button></DialogFooter></div> : <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
              <Envelope className="size-[18px]" aria-hidden="true" />
            </span>
            Convidar usuário
          </DialogTitle>
          <DialogDescription>
            Se o envio de e-mail estiver configurado em Configurações, o convite é enviado
            automaticamente. Caso contrário, o link aparece aqui para você copiar e enviar manualmente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <p className="text-xs leading-5 text-text-muted">Informe apenas nome, e-mail e perfil necessários ao acesso. Dê ciência à pessoa sobre o convite e conceda somente as permissões de que ela precisa.</p>
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
        </>}
      </DialogContent>
    </Dialog>
  );
}
