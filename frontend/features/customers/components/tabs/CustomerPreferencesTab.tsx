'use client';

import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CustomerFormValues } from '../CustomerFormModal';

const CHANNEL_OPTIONS: Array<{ value: NonNullable<CustomerFormValues['preferredContactChannel']>; label: string }> = [
  { value: 'PHONE', label: 'Telefone' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'SMS', label: 'SMS' },
];

const TIME_OPTIONS: Array<{ value: NonNullable<CustomerFormValues['preferredContactTime']>; label: string }> = [
  { value: 'MORNING', label: 'Manhã' },
  { value: 'AFTERNOON', label: 'Tarde' },
  { value: 'EVENING', label: 'Noite' },
  { value: 'ANY', label: 'Qualquer horário' },
];

interface CustomerPreferencesTabProps {
  form: UseFormReturn<CustomerFormValues>;
}

export function CustomerPreferencesTab({ form }: CustomerPreferencesTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField control={form.control} name="careMessagesEnabled" render={({ field }) => (
        <FormItem className="rounded-card border border-border bg-selection p-4 sm:col-span-2"><div className="flex items-start gap-3"><FormControl><input type="checkbox" checked={field.value} onChange={event => field.onChange(event.target.checked)} onBlur={field.onBlur} ref={field.ref} name={field.name} className="mt-0.5 size-4 shrink-0 accent-primary" /></FormControl><div><FormLabel className="cursor-pointer text-sm font-semibold">O cliente autorizou os lembretes de cuidado e a mensagem de aniversário.</FormLabel><p className="mt-1 text-xs leading-5 text-muted-foreground">Marque após confirmar com o cliente. Respeita o canal e o horário preferidos. Cada mensagem inclui um link para pausar; os avisos de OS são uma preferência separada.</p></div></div><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="notifyServiceOrderUpdates" render={({ field }) => (
        <FormItem className="rounded-card border border-border p-4 sm:col-span-2">
          <div className="flex items-start gap-3">
            <FormControl><input type="checkbox" checked={field.value} onChange={event => field.onChange(event.target.checked)} onBlur={field.onBlur} ref={field.ref} name={field.name} className="mt-0.5 size-4 shrink-0 accent-primary" /></FormControl>
            <div><FormLabel className="cursor-pointer text-sm font-semibold">Me avise sobre toda movimentação da Ordem de Serviço.</FormLabel><p className="mt-1 text-xs leading-5 text-text-muted">Envia avisos imediatos pelo WhatsApp do telefone principal na abertura e em cada mudança de status da OS. Requer a integração WhatsApp ativa na oficina.</p></div>
          </div><FormMessage />
        </FormItem>
      )} />
      <FormField
        control={form.control}
        name="preferredContactChannel"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Canal preferido (opcional)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Sem preferência definida" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CHANNEL_OPTIONS.map((option) => (
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
      <FormField
        control={form.control}
        name="preferredContactTime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Melhor horário (opcional)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Sem preferência definida" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {TIME_OPTIONS.map((option) => (
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
    </div>
  );
}
