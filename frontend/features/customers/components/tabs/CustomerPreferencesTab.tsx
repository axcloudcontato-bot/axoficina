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
