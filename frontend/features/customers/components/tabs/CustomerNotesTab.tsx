'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { CustomerFormValues } from '../CustomerFormModal';

interface CustomerNotesTabProps {
  form: UseFormReturn<CustomerFormValues>;
}

export function CustomerNotesTab({ form }: CustomerNotesTabProps) {
  return (
    <FormField
      control={form.control}
      name="notes"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Observações internas (opcional)</FormLabel>
          <FormControl>
            <Textarea rows={8} maxLength={2000} placeholder="Notas internas sobre o cliente, visíveis só pra equipe." {...field} />
          </FormControl>
          <p className="text-xs text-text-muted">Registre somente informações necessárias ao atendimento. Não inclua dados sensíveis, senhas ou documentos completos.</p>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
