'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CarProfile, Plus, MagnifyingGlass, User } from '@phosphor-icons/react';
import type { CustomerListItemResponse, VehicleListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { useCustomersList } from '@/features/customers/hooks/use-customers';
import { VehicleFormModal } from '@/features/vehicles/components/VehicleFormModal';
import { useVehiclesList } from '@/features/vehicles/hooks/use-vehicles';
import { ServiceOrderFormModal } from './ServiceOrderFormModal';
import { inferRegistrationField, registrationSeed, REGISTRATION_FIELDS, type RegistrationField, type RegistrationSeed } from '@/lib/registration-seed';

type Stage = 'search' | 'customer' | 'vehicle' | 'order';
type CustomerSelection = Pick<CustomerListItemResponse, 'id' | 'name'>;

interface NewServiceOrderQuickStartProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  iconOnly?: boolean;
}

export function NewServiceOrderQuickStart({ className, size = 'default', label = 'Novo atendimento', iconOnly = false }: NewServiceOrderQuickStartProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('search');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customer, setCustomer] = useState<CustomerSelection>();
  const [vehicle, setVehicle] = useState<VehicleListItemResponse>();
  const [seed, setSeed] = useState<RegistrationSeed>({ customer: {}, vehicle: {} });
  const [seedField, setSeedField] = useState<RegistrationField>();
  const advancing = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const canSearch = open && stage === 'search' && debouncedQuery.length >= 2 && !customer;
  const customers = useCustomersList({ offset: 0, limit: 8, search: debouncedQuery }, { enabled: canSearch });
  const vehicles = useVehiclesList({ offset: 0, limit: 8, search: debouncedQuery, matchOwner: true }, { enabled: canSearch });
  const customerVehicles = useVehiclesList(
    { offset: 0, limit: 20, customerId: customer?.id },
    { enabled: open && stage === 'search' && Boolean(customer) },
  );

  const searching = customers.isFetching || vehicles.isFetching || (query.trim().length >= 2 && query.trim() !== debouncedQuery);
  const searchError = customers.isError || vehicles.isError;
  const hasSearched = canSearch && query.trim() === debouncedQuery && !searching && !searchError && !customers.isPlaceholderData && !vehicles.isPlaceholderData;
  const noResults = hasSearched && !customer && !(customers.data?.items.length) && !(vehicles.data?.items.length);
  const destination = seedField ?? inferRegistrationField(query);

  function resetAndClose() {
    setOpen(false);
    setStage('search');
    setQuery('');
    setDebouncedQuery('');
    setCustomer(undefined);
    setVehicle(undefined);
    setSeed({ customer: {}, vehicle: {} });
    setSeedField(undefined);
  }

  function handleChildOpenChange(value: boolean) {
    if (value) return;
    if (advancing.current) {
      advancing.current = false;
      return;
    }
    resetAndClose();
  }

  function selectVehicle(selected: VehicleListItemResponse) {
    setVehicle(selected);
    setCustomer({ id: selected.customerId, name: selected.customerName });
    setStage('order');
  }

  function addNewCustomer(text: string, field = inferRegistrationField(text)) {
    setSeed(registrationSeed(text, field));
    setCustomer(undefined); setVehicle(undefined); setStage('customer');
  }

  function addNewVehicle(text = query, owner = customer) {
    setSeed(registrationSeed(text, inferRegistrationField(text, 'vehicle')));
    setCustomer(owner); setVehicle(undefined); setStage('vehicle');
  }

  return <>
    <Button type="button" size={size} className={className} aria-label={iconOnly ? label : undefined} onClick={() => setOpen(true)}>
      <Plus className="size-4" aria-hidden="true" />{!iconOnly && label}
    </Button>

    <Dialog open={open && stage === 'search'} onOpenChange={(value) => !value && resetAndClose()}>
      <DialogContent className="h-[min(34rem,calc(100dvh-1rem))] grid-rows-[auto_minmax(0,1fr)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
              <MagnifyingGlass className="size-[18px]" aria-hidden="true" />
            </span>
            Novo atendimento
          </DialogTitle>
          <DialogDescription>Pesquise pelo nome, CPF/CNPJ, telefone, e-mail ou dados do veículo.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4">
        {!customer ? <>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input autoFocus aria-label="Pesquisar cliente ou veículo" value={query} onChange={(event) => { setQuery(event.target.value); setSeedField(undefined); }} placeholder="Nome, CPF/CNPJ, telefone, e-mail ou placa" className="h-12 pl-10 text-base" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-button border border-border" aria-live="polite">
            {query.trim().length < 2 && <Hint />}
            {searching && <div role="status" className="px-4 py-8 text-center text-sm text-text-muted">Pesquisando cadastros...</div>}
            {hasSearched && !searching && (customers.data?.items.length ?? 0) > 0 && <ResultGroup title="Clientes">
              {customers.data?.items.map((item) => <ResultButton key={item.id} icon={User} title={item.name} detail={`${item.document} · ${item.phone}`} onClick={() => setCustomer(item)} />)}
            </ResultGroup>}
            {hasSearched && (vehicles.data?.items.length ?? 0) > 0 && <ResultGroup title="Veículos">
              {vehicles.data?.items.map((item) => <ResultButton key={item.id} icon={CarProfile} title={item.customerName} detail={`${item.brand} ${item.model} · ${item.plate}`} onClick={() => selectVehicle(item)} />)}
            </ResultGroup>}
            {searchError && <p role="alert" className="p-5 text-center text-sm text-danger">Não foi possível pesquisar os cadastros. Tente novamente antes de cadastrar.</p>}
            {noResults && <div className="flex flex-col items-center px-5 py-6 text-center"><span className="flex size-10 items-center justify-center rounded-full bg-muted text-text-muted"><MagnifyingGlass className="size-5" /></span><p className="mt-3 text-sm font-semibold text-text">Nenhum cadastro encontrado</p><p className="mt-1 text-xs text-text-muted">O texto digitado será aproveitado no campo escolhido.</p><label className="mt-3 grid w-full max-w-xs gap-1.5 text-left text-xs font-semibold">Usar o texto em<select className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={destination} onChange={(event) => setSeedField(event.target.value as RegistrationField)}>{REGISTRATION_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}</select></label><Button className="mt-4" onClick={() => addNewCustomer(query, destination)}><Plus className="size-4" />Adicionar novo</Button></div>}
          </div>
        </> : <>
          <div className="rounded-button border border-primary/20 bg-primary-subtle p-3"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Cliente selecionado</p><p className="mt-1 font-bold text-text">{customer.name}</p><button type="button" className="mt-1 text-xs font-semibold text-primary underline-offset-2 hover:underline" onClick={() => { setCustomer(undefined); setQuery(''); }}>Trocar cliente</button></div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-button border border-border">
            {customerVehicles.isFetching && <div role="status" className="px-4 py-8 text-center text-sm text-text-muted">Buscando veículos...</div>}
            {!customerVehicles.isFetching && customerVehicles.data?.items.map((item) => <ResultButton key={item.id} icon={CarProfile} title={item.customerName} detail={`${item.brand} ${item.model} · ${item.plate}`} onClick={() => selectVehicle(item)} />)}
            {!customerVehicles.isFetching && !(customerVehicles.data?.items.length) && <div className="px-5 py-8 text-center"><p className="text-sm font-semibold text-text">Este cliente ainda não possui veículo</p><p className="mt-1 text-xs text-text-muted">Cadastre o veículo para continuar o atendimento.</p></div>}
          </div>
          <Button onClick={() => addNewVehicle(['plate', 'chassis', 'year'].includes(inferRegistrationField(query)) ? query : '')}><Plus className="size-4" />Adicionar veículo</Button>
        </>}
        </div>
      </DialogContent>
    </Dialog>

    <CustomerFormModal open={open && stage === 'customer'} initialValues={seed.customer} onOpenChange={handleChildOpenChange} onCreated={(created) => { advancing.current = true; setCustomer(created); setStage('vehicle'); }} />
    <VehicleFormModal open={open && stage === 'vehicle'} initialValues={seed.vehicle} onOpenChange={handleChildOpenChange} initialCustomer={customer ? { id: customer.id, name: customer.name } : undefined} onCreated={(created) => { advancing.current = true; setVehicle(created); setStage('order'); }} />
    <ServiceOrderFormModal open={open && stage === 'order'} onOpenChange={handleChildOpenChange} initialCustomer={customer ? { id: customer.id, name: customer.name } : undefined} initialVehicleId={vehicle?.id} initialVehicleLabel={vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : undefined} onRequestNewCustomer={(text) => addNewCustomer(text, inferRegistrationField(text, 'customer'))} onRequestNewVehicle={addNewVehicle} onCreated={(created) => { advancing.current = true; resetAndClose(); router.push(`/ordens-de-servico/${created.id}`); }} />
  </>;
}

function Hint() {
  return <div className="px-5 py-8 text-center"><p className="text-sm font-semibold text-text">Encontre o cadastro antes de começar</p><p className="mt-1 text-xs text-text-muted">Digite pelo menos dois caracteres para pesquisar.</p></div>;
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section aria-label={title}><h3 className="border-b border-border bg-muted/50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">{title}</h3><div className="divide-y divide-border">{children}</div></section>;
}

function ResultButton({ icon: Icon, title, detail, onClick }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-selection focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="flex size-9 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-text">{title}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{detail}</span></span></button>;
}
