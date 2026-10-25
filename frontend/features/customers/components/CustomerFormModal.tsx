'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import Link from 'next/link';
import type { CustomerAddress, CustomerListItemResponse } from '@oficina/contracts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { WarningCircle, Check, CaretLeft, CaretRight, User } from '@phosphor-icons/react';
import { extractErrorMessage, extractFieldErrors } from '@/lib/api/client';
import { useCreateCustomer, useUpdateCustomer } from '../hooks/use-customers';
import { CustomerGeneralTab } from './tabs/CustomerGeneralTab';
import { CustomerAddressTab } from './tabs/CustomerAddressTab';
import { CustomerContactTab } from './tabs/CustomerContactTab';
import { CustomerPreferencesTab } from './tabs/CustomerPreferencesTab';
import { CustomerNotesTab } from './tabs/CustomerNotesTab';
import { CustomerHistoryTab } from './tabs/CustomerHistoryTab';
import type { CustomerRegistrationSeed } from '@/lib/registration-seed';

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

export const customerSchema = z.object({
  notifyServiceOrderUpdates: z.boolean().default(false),
  type: z.enum(['PF', 'PJ']),
  document: z.string().max(24, 'Documento muito longo'),
  name: z.string().trim().min(1, 'Informe o nome').max(200),
  phone: z.string().trim().min(1, 'Informe o telefone').max(30),
  email: z.union([z.string().email('Informe um e-mail válido'), z.literal('')]).optional(),
  notes: z.string().optional(),
  address: addressSchema,
  // Feature 6 (Cadastro de Cliente Expandido) — todos opcionais.
  rg: z.string().optional(),
  stateRegistration: z.string().optional(),
  secondaryContactName: z.string().optional(),
  secondaryContactPhone: z.string().optional(),
  secondaryContactRelation: z.string().optional(),
  preferredContactChannel: z.enum(['PHONE', 'WHATSAPP', 'EMAIL', 'SMS']).optional(),
  preferredContactTime: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANY']).optional(),
}).superRefine((values, context) => {
  const digits = values.phone.replace(/\D/g, '');
  if (values.notifyServiceOrderUpdates && !([10, 11].includes(digits.length) || /^55\d{10,11}$/.test(digits))) context.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'Informe um telefone com DDD válido para ativar os avisos pelo WhatsApp.' });
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

const EMPTY_ADDRESS: NonNullable<CustomerFormValues['address']> = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
};

const EMPTY_VALUES: CustomerFormValues = {
  notifyServiceOrderUpdates: false,
  type: 'PF',
  document: '',
  name: '',
  phone: '',
  email: '',
  notes: '',
  address: EMPTY_ADDRESS,
  rg: '',
  stateRegistration: '',
  secondaryContactName: '',
  secondaryContactPhone: '',
  secondaryContactRelation: '',
  preferredContactChannel: undefined,
  preferredContactTime: undefined,
};

const GUIDED_STEPS = [
  { id: 'general', label: 'Dados gerais', fields: ['type', 'document', 'name', 'phone', 'email', 'rg', 'stateRegistration'] },
  { id: 'address', label: 'Endereço', fields: ['address'] },
  { id: 'contact', label: 'Contato', fields: ['secondaryContactName', 'secondaryContactPhone', 'secondaryContactRelation'] },
  { id: 'preferences', label: 'Preferências', fields: ['preferredContactChannel', 'preferredContactTime', 'notifyServiceOrderUpdates'] },
  { id: 'notes', label: 'Observações', fields: ['notes'] },
] as const;

// Campos em branco não devem virar `{ street: "", ... }` no payload — nem
// um objeto totalmente vazio quando o cliente não preencheu nenhum campo de
// endereço (o backend trata `undefined` como "não mudou", ver UpdateCustomerInput).
function buildAddressPayload(address: CustomerFormValues['address']): CustomerAddress | undefined {
  if (!address) {
    return undefined;
  }
  const entries = Object.entries(address).filter(([, value]) => Boolean(value));
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries) as CustomerAddress;
}

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = modo criação, definido = modo edição (type/document viram somente leitura). */
  customer?: CustomerListItemResponse;
  onCreated?: (customer: CustomerListItemResponse) => void;
  presentation?: 'modal' | 'page';
  initialValues?: CustomerRegistrationSeed;
}

export function CustomerFormModal({ open, onOpenChange, customer, onCreated, presentation = 'modal', initialValues }: CustomerFormModalProps) {
  const isEditing = Boolean(customer);
  const isGuidedCreate = presentation === 'page' && !isEditing;
  const [activeTab, setActiveTab] = useState('general');
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const isPending = create.isPending || update.isPending;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveTab('general');
    form.reset(
      customer
        ? {
            type: customer.type,
            document: customer.document,
            name: customer.name,
            phone: customer.phone,
            email: customer.email ?? '',
            notes: customer.notes ?? '',
            address: { ...EMPTY_ADDRESS, ...customer.address },
            rg: customer.rg ?? '',
            stateRegistration: customer.stateRegistration ?? '',
            secondaryContactName: customer.secondaryContactName ?? '',
            secondaryContactPhone: customer.secondaryContactPhone ?? '',
            secondaryContactRelation: customer.secondaryContactRelation ?? '',
            preferredContactChannel: customer.preferredContactChannel,
            preferredContactTime: customer.preferredContactTime,
            notifyServiceOrderUpdates: customer.notifyServiceOrderUpdates ?? false,
          }
        : { ...EMPTY_VALUES, ...initialValues },
    );
  }, [open, customer, initialValues, form]);

  function onSubmit(values: CustomerFormValues) {
    const onSuccess = (result?: { customer: CustomerListItemResponse }) => {
      if (!isEditing && result?.customer) onCreated?.(result.customer);
      toast.success(isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      onOpenChange(false);
    };
    const onError = (error: unknown) => {
      const fieldErrors = extractFieldErrors(error);
      if (Object.keys(fieldErrors).length > 0) {
        Object.entries(fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof CustomerFormValues, { message });
        });
      } else {
        toast.error(extractErrorMessage(error));
      }
    };
    const address = buildAddressPayload(values.address);
    const sharedFields = {
      notifyServiceOrderUpdates: values.notifyServiceOrderUpdates,
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      notes: values.notes || undefined,
      address,
      rg: values.rg || undefined,
      stateRegistration: values.stateRegistration || undefined,
      secondaryContactName: values.secondaryContactName || undefined,
      secondaryContactPhone: values.secondaryContactPhone || undefined,
      secondaryContactRelation: values.secondaryContactRelation || undefined,
      preferredContactChannel: values.preferredContactChannel,
      preferredContactTime: values.preferredContactTime,
    };

    if (isEditing && customer) {
      update.mutate({ id: customer.id, ...sharedFields, document: values.document,
        email: values.email || null, notes: values.notes || null, address: address ?? null,
        rg: values.rg || null, stateRegistration: values.stateRegistration || null,
        secondaryContactName: values.secondaryContactName || null,
        secondaryContactPhone: values.secondaryContactPhone || null,
        secondaryContactRelation: values.secondaryContactRelation || null,
        preferredContactChannel: values.preferredContactChannel ?? null,
        preferredContactTime: values.preferredContactTime ?? null,
      }, { onSuccess, onError });
    } else {
      create.mutate({ type: values.type, document: values.document || undefined, ...sharedFields }, { onSuccess, onError });
    }
  }

  function onInvalid(errors: FieldErrors<CustomerFormValues>) {
    const firstPath = Object.keys(errors)[0] ?? '';
    if (['type', 'document', 'name', 'phone', 'email', 'rg', 'stateRegistration'].includes(firstPath)) {
      setActiveTab('general');
    } else if (firstPath.startsWith('address.')) {
      setActiveTab('address');
    } else if (firstPath.startsWith('secondaryContact')) {
      setActiveTab('contact');
    } else if (firstPath.startsWith('preferredContact') || firstPath === 'notifyServiceOrderUpdates') {
      setActiveTab('preferences');
    } else if (firstPath === 'notes') {
      setActiveTab('notes');
    }
  }

  async function goToNextGuidedStep() {
    const currentIndex = GUIDED_STEPS.findIndex((item) => item.id === activeTab);
    if (currentIndex < 0 || currentIndex === GUIDED_STEPS.length - 1) return;
    const valid = await form.trigger(GUIDED_STEPS[currentIndex].fields as never);
    if (valid) setActiveTab(GUIDED_STEPS[currentIndex + 1].id);
  }

  function goToPreviousGuidedStep() {
    const currentIndex = GUIDED_STEPS.findIndex((item) => item.id === activeTab);
    if (currentIndex > 0) setActiveTab(GUIDED_STEPS[currentIndex - 1].id);
  }

  const hasGeneralErrors = ['type', 'document', 'name', 'phone', 'email', 'rg', 'stateRegistration'].some((field) => Boolean(form.formState.errors[field as keyof CustomerFormValues]));
  const hasAddressErrors = Boolean(form.formState.errors.address);
  const hasContactErrors = ['secondaryContactName', 'secondaryContactPhone', 'secondaryContactRelation'].some((field) => Boolean(form.formState.errors[field as keyof CustomerFormValues]));
  const hasPreferenceErrors = ['preferredContactChannel', 'preferredContactTime', 'notifyServiceOrderUpdates'].some((field) => Boolean(form.formState.errors[field as keyof CustomerFormValues]));
  const hasNotesErrors = Boolean(form.formState.errors.notes);

  return (
    <Dialog open={open} modal={presentation !== 'page'} onOpenChange={onOpenChange}>
      <DialogContent
        data-page={presentation === 'page' ? true : undefined}
        className={presentation === 'page' ? 'max-h-[92vh]' : 'max-h-[92vh] sm:max-w-5xl lg:max-w-6xl'}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
              <User className="size-[18px]" aria-hidden="true" />
            </span>
            {isEditing ? 'Editar cliente' : 'Novo cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Corrija os dados e remova informações opcionais quando deixarem de ser necessárias.'
              : 'Cadastre um cliente pessoa física ou jurídica da sua oficina.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
            <p className="rounded-button bg-muted p-3 text-xs leading-5 text-text-muted">Para o cadastro básico, informe nome e telefone. CPF/CNPJ e os demais dados são opcionais: preencha apenas o necessário ao atendimento ou a uma obrigação legal. Dados de contato não autorizam marketing. <Link href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de privacidade</Link>.</p>
            {isGuidedCreate ? (
              <div className="flex flex-col gap-5">
                <ol aria-label="Etapas do cadastro do cliente" className="grid gap-2 sm:grid-cols-5">
                  {GUIDED_STEPS.map((item, index) => {
                    const currentIndex = GUIDED_STEPS.findIndex((stepItem) => stepItem.id === activeTab);
                    const complete = index < currentIndex;
                    const active = item.id === activeTab;
                    return <li key={item.id} className={`flex items-center gap-2 rounded-button border px-3 py-2 text-xs font-semibold ${active ? 'border-primary/40 bg-primary-subtle text-primary-strong' : complete ? 'border-success/30 bg-success-subtle text-success-strong' : 'border-border bg-surface text-text-muted'}`} aria-current={active ? 'step' : undefined}><span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${active ? 'bg-primary text-primary-foreground' : complete ? 'bg-success text-white' : 'bg-muted text-text-muted'}`}>{complete ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}</span>{item.label}</li>;
                  })}
                </ol>
                {activeTab === 'general' && <CustomerGeneralTab form={form} isEditing={false} />}
                {activeTab === 'address' && <CustomerAddressTab form={form} />}
                {activeTab === 'contact' && <CustomerContactTab form={form} />}
                {activeTab === 'preferences' && <CustomerPreferencesTab form={form} />}
                {activeTab === 'notes' && <CustomerNotesTab form={form} />}
              </div>
            ) : <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex w-full justify-start gap-1 overflow-x-auto p-1">
                <TabsTrigger className="shrink-0" value="general">Dados Gerais{hasGeneralErrors && <WarningCircle className="ml-1.5 size-3.5 text-danger" aria-label="com erros" />}</TabsTrigger>
                <TabsTrigger className="shrink-0" value="address">Endereço{hasAddressErrors && <WarningCircle className="ml-1.5 size-3.5 text-danger" aria-label="com erros" />}</TabsTrigger>
                <TabsTrigger className="shrink-0" value="contact">Contato{hasContactErrors && <WarningCircle className="ml-1.5 size-3.5 text-danger" aria-label="com erros" />}</TabsTrigger>
                <TabsTrigger className="shrink-0" value="preferences">Preferências{hasPreferenceErrors && <WarningCircle className="ml-1.5 size-3.5 text-danger" aria-label="com erros" />}</TabsTrigger>
                <TabsTrigger className="shrink-0" value="notes">Observações{hasNotesErrors && <WarningCircle className="ml-1.5 size-3.5 text-danger" aria-label="com erros" />}</TabsTrigger>
                <TabsTrigger className="shrink-0" value="history">Histórico</TabsTrigger>
              </TabsList>
              {/* Altura fixa (do tamanho da maior aba — Endereço): o conteúdo de
                  cada aba tem um tamanho diferente. Sem isso, a altura do modal
                  mudava a cada troca de aba e, como ele é centralizado na tela,
                  parecia "pular" de posição. Fixar só esta área (em vez do
                  modal inteiro) evita sobrar espaço vazio nas abas curtas. */}
              <div className="h-[380px] overflow-y-auto pr-1 pt-1">
                <TabsContent value="general">
                  <CustomerGeneralTab form={form} isEditing={isEditing} />
                </TabsContent>
                <TabsContent value="address">
                  <CustomerAddressTab form={form} />
                </TabsContent>
                <TabsContent value="contact">
                  <CustomerContactTab form={form} />
                </TabsContent>
                <TabsContent value="preferences">
                  <CustomerPreferencesTab form={form} />
                </TabsContent>
                <TabsContent value="notes">
                  <CustomerNotesTab form={form} />
                </TabsContent>
                <TabsContent value="history">
                  <CustomerHistoryTab customer={customer} />
                </TabsContent>
              </div>
            </Tabs>}
            <DialogFooter className="gap-2 border-t border-border pt-4 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              {isGuidedCreate && activeTab !== 'general' && <Button type="button" variant="outline" onClick={goToPreviousGuidedStep} disabled={isPending}><CaretLeft className="size-4" aria-hidden="true" /> Voltar</Button>}
              {isGuidedCreate && activeTab !== 'notes' ? <Button type="button" onClick={(event) => { event.preventDefault(); void goToNextGuidedStep(); }} disabled={isPending} className="sm:min-w-32">Próximo <CaretRight className="size-4" aria-hidden="true" /></Button> : <Button type="submit" disabled={isPending} className="sm:min-w-40">
                {isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
              </Button>}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
