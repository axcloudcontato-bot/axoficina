'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
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
  diagnosis: z.string().optional(),
});

type ServiceOrderFormValues = z.infer<typeof serviceOrderSchema>;

const EMPTY_VALUES: ServiceOrderFormValues = {
  customerId: '',
  vehicleId: '',
  technicianId: '',
  diagnosis: '',
};

interface ServiceOrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVehicleId?: string;
  initialVehicleLabel?: string;
  initialCustomer?: { id: string; name: string };
  onRequestNewCustomer?: () => void;
  onRequestNewVehicle?: () => void;
  onCreated?: (serviceOrder: ServiceOrderListItemResponse) => void;
  presentation?: 'modal' | 'page';
}

export function ServiceOrderFormModal({ open, onOpenChange, initialVehicleId, initialVehicleLabel, initialCustomer, onRequestNewCustomer, onRequestNewVehicle, onCreated, presentation = 'modal' }: ServiceOrderFormModalProps) {
  const create = useCreateServiceOrder();

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
      form.reset({ ...EMPTY_VALUES, customerId: initialCustomer?.id ?? '', vehicleId: initialVehicleId ?? '' });
    }
  }, [open, initialVehicleId, initialCustomer, form]);

  function onSubmit(values: ServiceOrderFormValues) {
    create.mutate(
      {
        vehicleId: values.vehicleId,
        technicianId: values.technicianId || undefined,
        diagnosis: values.diagnosis || undefined,
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
          <DialogDescription>Pesquise o cliente, selecione o veículo e registre o atendimento em uma única OS.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="rounded-button border border-primary/15 bg-primary-subtle px-3 py-2.5 text-xs leading-5 text-primary-strong">
              Comece pelo cliente. A busca de veículos será filtrada automaticamente para mostrar apenas os carros dele.
            </div>
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3"><FormLabel>Cliente</FormLabel>{onRequestNewCustomer && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-primary" onClick={onRequestNewCustomer}>Cadastrar novo cliente</Button>}</div>
                  <FormControl><CustomerSearchCombobox value={field.value} initialLabel={initialCustomer?.name} onChange={field.onChange} placeholder="Buscar por nome, CPF ou CNPJ" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3"><FormLabel>Veículo</FormLabel>{onRequestNewVehicle && form.watch('customerId') && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-primary" onClick={onRequestNewVehicle}>Cadastrar novo veículo</Button>}</div>
                  <FormControl>
                    <VehicleSearchCombobox value={field.value} customerId={form.watch('customerId')} initialLabel={initialVehicleLabel} onChange={field.onChange} />
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
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnóstico (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o problema relatado..." {...field} />
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
