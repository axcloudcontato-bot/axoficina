'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardText, User, CarProfile } from '@phosphor-icons/react';
import type { CustomerListItemResponse, ServiceOrderListItemResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CustomerFormModal } from '@/features/customers/components/CustomerFormModal';
import { ServiceOrderFormModal } from '@/features/service-orders/components/ServiceOrderFormModal';
import { VehicleFormModal } from '@/features/vehicles/components/VehicleFormModal';
import { inferRegistrationField, registrationSeed, type RegistrationSeed } from '@/lib/registration-seed';

type Step = 'customer' | 'vehicle' | 'order' | 'done';

const STEPS: Array<{ id: Exclude<Step, 'done'>; label: string; description: string; icon: typeof User }> = [
  { id: 'customer', label: 'Cliente', description: 'Quem trouxe o veículo', icon: User },
  { id: 'vehicle', label: 'Veículo', description: 'Carro que será atendido', icon: CarProfile },
  { id: 'order', label: 'Ordem de serviço', description: 'Serviço e responsável', icon: ClipboardText },
];

export default function NewServiceOrderPage() {
  const [step, setStep] = useState<Step>('customer');
  const [customer, setCustomer] = useState<Pick<CustomerListItemResponse, 'id' | 'name'>>();
  const [vehicle, setVehicle] = useState<{ id: string; brand: string; model: string; plate: string; customerId: string; customerName: string }>();
  const [serviceOrder, setServiceOrder] = useState<ServiceOrderListItemResponse>();
  const [seed, setSeed] = useState<RegistrationSeed>({ customer: {}, vehicle: {} });
  const advancing = useRef(false);

  function closeCurrentStep() {
    if (advancing.current) {
      advancing.current = false;
      return;
    }
    window.history.back();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Link href="/ordens-de-servico" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para ordens de serviço
      </Link>

      <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">Atendimento guiado</p>
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Novo atendimento</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Cadastre o cliente, identifique o veículo e abra a ordem de serviço em uma única sequência. O calendário de agendamento entra como próxima etapa do fluxo.</p>
          </div>
        </div>

        <nav aria-label="Etapas do novo atendimento" className="mt-5 grid gap-2 sm:grid-cols-3">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const active = step === item.id;
            const complete = step === 'done' || (item.id === 'customer' && Boolean(customer)) || (item.id === 'vehicle' && Boolean(vehicle));
            return <div key={item.id} aria-current={active ? 'step' : undefined} className={`relative rounded-card border px-3 py-2.5 transition-colors ${active ? 'border-primary/40 bg-primary-subtle' : complete ? 'border-success/30 bg-success-subtle' : 'border-border bg-surface'}`}><div className="flex items-center gap-2.5"><span className={`flex size-8 shrink-0 items-center justify-center rounded-button ${active ? 'bg-primary text-primary-foreground' : complete ? 'bg-success text-white' : 'bg-muted text-text-muted'}`}>{complete ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}</span><span><span className="block text-sm font-bold text-text">{index + 1}. {item.label}</span><span className="mt-0.5 block text-xs text-text-muted">{item.description}</span></span></div></div>;
          })}
        </nav>
      </section>

      {step === 'done' && serviceOrder && (
        <Card className="border-success/30 bg-success-subtle">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-success-strong"><Check className="size-5" aria-hidden="true" /><p className="font-bold">Atendimento iniciado com sucesso</p></div><p className="mt-2 text-sm text-text-muted">A OS de {serviceOrder.vehicleBrand} {serviceOrder.vehicleModel} já está disponível para sua equipe.</p></div><Button asChild><Link href={`/ordens-de-servico/${serviceOrder.id}`}>Abrir OS <ArrowRight className="size-4" aria-hidden="true" /></Link></Button></CardContent>
        </Card>
      )}

      <CustomerFormModal presentation="page" open={step === 'customer'} initialValues={seed.customer} onOpenChange={(open) => !open && closeCurrentStep()} onCreated={(created) => { advancing.current = true; setCustomer(created); setStep('vehicle'); }} />
      <VehicleFormModal presentation="page" open={step === 'vehicle'} initialValues={seed.vehicle} onOpenChange={(open) => !open && closeCurrentStep()} initialCustomer={customer ? { id: customer.id, name: customer.name } : undefined} onCreated={(created) => { advancing.current = true; setVehicle(created); setStep('order'); }} />
      <ServiceOrderFormModal presentation="page" open={step === 'order'} onOpenChange={(open) => !open && closeCurrentStep()} initialCustomer={customer ? { id: customer.id, name: customer.name } : undefined} initialVehicleId={vehicle?.id} initialVehicleLabel={vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : undefined} onRequestNewCustomer={(text) => { setSeed(registrationSeed(text, inferRegistrationField(text, 'customer'))); setCustomer(undefined); setVehicle(undefined); setStep('customer'); }} onRequestNewVehicle={(text, owner) => { setSeed(registrationSeed(text, inferRegistrationField(text, 'vehicle'))); if (owner) setCustomer(owner); setVehicle(undefined); setStep('vehicle'); }} onCreated={(created) => { advancing.current = true; setServiceOrder(created); setStep('done'); }} />
    </div>
  );
}
