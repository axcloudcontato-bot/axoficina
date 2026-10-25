'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ClipboardText } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VehicleSearchCombobox } from '@/features/vehicles/components/VehicleSearchCombobox';
import { CustomerSearchCombobox } from '@/features/customers/components/CustomerSearchCombobox';
import { useUsersList } from '@/features/users/hooks/use-users';
import { extractErrorMessage, extractFieldErrors } from '@/lib/api/client';
import { useCreateServiceOrder } from '../hooks/use-service-orders';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';

// Mesma limitação pragmática já aceita na Feature 4 pro seletor de técnico
// (lista fixa, sem busca). O de veículo agora usa VehicleSearchCombobox.
const PICKER_LIMIT = 100;

const serviceOrderSchema = z.object({
  customerId: z.string().min(1, 'Selecione um cliente'),
  vehicleId: z.string().min(1, 'Selecione um veículo'),
  technicianId: z.string().optional(),
  customerComplaint: z.string().optional(),
});

type ServiceOrderFormValues = z.infer<typeof serviceOrderSchema>;

const EMPTY_VALUES: ServiceOrderFormValues = {
  customerId: '',
  vehicleId: '',
  technicianId: '',
  customerComplaint: '',
};

interface ServiceOrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVehicleId?: string;
  initialVehicleLabel?: string;
  initialCustomer?: { id: string; name: string };
  onRequestNewCustomer?: (query: string) => void;
  onRequestNewVehicle?: (query: string, customer?: { id: string; name: string }) => void;
  onCreated?: (serviceOrder: ServiceOrderListItemResponse) => void;
  presentation?: 'modal' | 'page';
}

export function ServiceOrderFormModal({ open, onOpenChange, initialVehicleId, initialVehicleLabel, initialCustomer, onRequestNewCustomer, onRequestNewVehicle, onCreated, presentation = 'modal' }: ServiceOrderFormModalProps) {
  const create = useCreateServiceOrder();
  const [customerQuery, setCustomerQuery] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const selectedCustomer = useRef(initialCustomer);

  const { data: usersData, isLoading: isLoadingTechnicians } = useUsersList({
    offset: 0,
    limit: PICKER_LIMIT,
    filters: { status: 'active' },
  });

  const form = useForm<ServiceOrderFormValues>({
    resolver: zodResolver(serviceOrderSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      setCustomerQuery(''); setVehicleQuery(''); selectedCustomer.current = initialCustomer;
      form.reset({ ...EMPTY_VALUES, customerId: initialCustomer?.id ?? '', vehicleId: initialVehicleId ?? '' });
    }
  }, [open, initialVehicleId, initialCustomer, form]);

  function onSubmit(values: ServiceOrderFormValues) {
    create.mutate(
      {
        vehicleId: values.vehicleId,
        technicianId: values.technicianId || undefined,
        customerComplaint: values.customerComplaint || undefined,
      },
      {
        onSuccess: (result?: { serviceOrder: ServiceOrderListItemResponse }) => {
          if (result?.serviceOrder) onCreated?.(result.serviceOrder);
          toast.success('Ordem de serviço aberta com sucesso!');
          onOpenChange(false);
        },
        onError: (error) => {
          const fieldErrors = extractFieldErrors(error);
          if (Object.keys(fieldErrors).length > 0) {
            Object.entries(fieldErrors).forEach(([field, message]) => {
              form.setError(field as keyof ServiceOrderFormValues, { message });
            });
          } else {
            toast.error(extractErrorMessage(error));
          }
        },
      },
    );
  }

  return (
    <Dialog open={open} modal={presentation !== 'page'} onOpenChange={onOpenChange}>
      <DialogContent data-page={presentation === 'page' ? true : undefined} className={`max-h-[92vh] overflow-y-auto ${presentation === 'page' ? '' : 'sm:max-w-2xl lg:max-w-3xl'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
              <ClipboardText className="size-[18px]" aria-hidden="true" />
            </span>
            Nova ordem de serviço
          </DialogTitle>
          <DialogDescription>Selecione o cliente e o veículo para abrir o atendimento. O orçamento e a aprovação vêm nas próximas etapas.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="rounded-button border border-primary/15 bg-primary-subtle px-3 py-2.5 text-xs leading-5 text-primary-strong">
              Comece pelo cliente. A busca de veículos será filtrada automaticamente para mostrar apenas os carros dele.
              {' '}Registre somente informações do atendimento. Não inclua dados sensíveis, senhas ou dados completos de cartão nas observações.
            </div>
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3"><FormLabel>Cliente</FormLabel>{onRequestNewCustomer && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-primary" onClick={() => onRequestNewCustomer(field.value ? '' : customerQuery)}>Cadastrar novo cliente</Button>}</div>
                  <FormControl><CustomerSearchCombobox value={field.value} initialLabel={initialCustomer?.name} onSearchChange={setCustomerQuery} onChange={(id, customer) => { selectedCustomer.current = customer ? { id: customer.id, name: customer.name } : undefined; field.onChange(id); }} placeholder="Buscar por nome, CPF ou CNPJ" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3"><FormLabel>Veículo</FormLabel>{onRequestNewVehicle && form.watch('customerId') && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-primary" onClick={() => onRequestNewVehicle(field.value ? '' : vehicleQuery, selectedCustomer.current)}>Cadastrar novo veículo</Button>}</div>
                  <FormControl>
                    <VehicleSearchCombobox value={field.value} customerId={form.watch('customerId')} initialLabel={initialVehicleLabel} onChange={field.onChange} onSearchChange={setVehicleQuery} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Técnico (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingTechnicians ? 'Carregando técnicos...' : 'Atribuir depois'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {usersData?.items.map((technician) => (
                        <SelectItem key={technician.id} value={technician.id}>
                          {technician.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerComplaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solicitação do cliente (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="O que o cliente relatou ou solicitou?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 border-t border-border pt-4 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending} className="sm:min-w-32">
                {create.isPending ? 'Abrindo...' : 'Abrir OS'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
