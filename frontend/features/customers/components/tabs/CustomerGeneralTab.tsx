'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCEP, formatCNPJ, formatCPF, formatPhone, formatRG } from '@/lib/format-br-document';
import type { CustomerFormValues } from '../CustomerFormModal';

const TYPE_OPTIONS: Array<{ value: CustomerFormValues['type']; label: string }> = [
  { value: 'PF', label: 'Pessoa física' },
  { value: 'PJ', label: 'Pessoa jurídica' },
];

interface CustomerGeneralTabProps {
  form: UseFormReturn<CustomerFormValues>;
  isEditing: boolean;
  showAddress?: boolean;
  addressOnly?: boolean;
}

export function CustomerGeneralTab({ form, isEditing, showAddress = true, addressOnly = false }: CustomerGeneralTabProps) {
  const type = form.watch('type');

  return (
    <div className="flex flex-col gap-4">
      {!addressOnly && (
        <>
      {!isEditing && (
        <>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>CPF ou CNPJ</FormLabel>
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
        </>
      )}
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
        </>
      )}

      {showAddress && (
      <fieldset className="flex flex-col gap-4 rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-medium text-text">Endereço (opcional)</legend>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="address.street"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Rua</FormLabel>
                <FormControl>
                  <Input placeholder="Rua das Flores" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl>
                  <Input placeholder="123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="address.complement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl>
                  <Input placeholder="Apto 12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl>
                  <Input placeholder="Centro" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="address.city"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="São Paulo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <Input placeholder="SP" maxLength={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address.zipCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CEP</FormLabel>
              <FormControl>
                <Input
                  placeholder="00000-000"
                  inputMode="numeric"
                  {...field}
                  onChange={(event) => field.onChange(formatCEP(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>
      )}
    </div>
  );
}
