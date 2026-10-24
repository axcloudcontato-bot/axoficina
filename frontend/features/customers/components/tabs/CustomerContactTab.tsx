'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { formatPhone } from '@/lib/format-br-document';
import type { CustomerFormValues } from '../CustomerFormModal';

interface CustomerContactTabProps {
  form: UseFormReturn<CustomerFormValues>;
}

export function CustomerContactTab({ form }: CustomerContactTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">Contato secundário é opcional. Informe somente quando necessário e dê ciência à pessoa sobre o uso de seus dados no atendimento.</p>
      <p className="text-sm text-text-muted">
        Contato alternativo (cônjuge, sócio, motorista) pra quando quem atende o telefone principal não é o cliente.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="secondaryContactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Nome do contato" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="secondaryContactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone (opcional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                  {...field}
                  onChange={(event) => field.onChange(formatPhone(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="secondaryContactRelation"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Relação (opcional)</FormLabel>
            <FormControl>
              <Input placeholder="Cônjuge, motorista, sócio..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
