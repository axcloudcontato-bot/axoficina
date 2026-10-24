'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCNPJ, formatCPF, formatPhone, formatRG } from '@/lib/format-br-document';
import type { CustomerFormValues } from '../CustomerFormModal';

const TYPE_OPTIONS: Array<{ value: CustomerFormValues['type']; label: string }> = [
  { value: 'PF', label: 'Pessoa física' },
  { value: 'PJ', label: 'Pessoa jurídica' },
];

interface CustomerGeneralTabProps {
  form: UseFormReturn<CustomerFormValues>;
  isEditing: boolean;
}

export function CustomerGeneralTab({ form, isEditing }: CustomerGeneralTabProps) {
  const type = form.watch('type');

  return (
    <div className="flex flex-col gap-4">
      {(
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select disabled={isEditing} onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TYPE_OPTIONS.map((option) => (
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
            name="document"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF ou CNPJ (opcional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder={type === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                    inputMode="numeric"
                    {...field}
                    onChange={(event) => field.onChange((type === 'PJ' ? formatCNPJ : formatCPF)(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome completo ou razão social" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail (opcional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="cliente@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* rg/stateRegistration são independentes — a UI só sugere o campo
            certo por `type`, o backend aceita os dois preenchidos sem
            bloqueio (Edge Case 3 da spec). */}
        {type === 'PF' && (
          <FormField
            control={form.control}
            name="rg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RG (opcional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="00.000.000-0"
                    inputMode="numeric"
                    {...field}
                    onChange={(event) => field.onChange(formatRG(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {type === 'PJ' && (
          <FormField
            control={form.control}
            name="stateRegistration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inscrição Estadual (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="000.000.000.000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );
}
