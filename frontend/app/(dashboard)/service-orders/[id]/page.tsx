'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, CaretLeft, CaretRight, ClockCounterClockwise, Printer } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeleteServiceOrderDialog } from '@/features/service-orders/components/DeleteServiceOrderDialog';
import { InspectionChecklist } from '@/features/service-orders/components/InspectionChecklist';
import { ServiceOrderItemsSection } from '@/features/service-orders/components/ServiceOrderItemsSection';
import { StatusBadge } from '@/features/service-orders/components/StatusBadge';
import { StatusHistoryTimeline } from '@/features/service-orders/components/StatusHistoryTimeline';
import { StatusTransitionButtons } from '@/features/service-orders/components/StatusTransitionButtons';
import { VehicleServiceHistoryDialog } from '@/features/service-orders/components/VehicleServiceHistoryDialog';
import { ServiceOrderPaymentSection } from '@/features/service-orders/components/ServiceOrderPaymentSection';
import { ServiceOrderQuoteActions } from '@/features/service-orders/components/ServiceOrderQuoteActions';
import { ItemPhotosSection, VehiclePhotoSection } from '@/features/service-orders/components/ServiceOrderPhotoGallery';
import { parseChecklist, serializeChecklist, type InspectionItem } from '@/features/service-orders/checklist';
import { useServiceOrder, useUpdateServiceOrder } from '@/features/service-orders/hooks/use-service-orders';
import { useUsersList } from '@/features/users/hooks/use-users';
import { extractErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/features/auth/permissions';

const TECHNICIAN_PICKER_LIMIT = 100;

export default function ServiceOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const router = useRouter();
  const { data, isLoading, isError } = useServiceOrder(params.id);
  const update = useUpdateServiceOrder();
  const { data: usersData } = useUsersList({ offset: 0, limit: TECHNICIAN_PICKER_LIMIT, filters: { status: 'active' } });
  const [technicianId, setTechnicianId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [entryMileage, setEntryMileage] = useState('');
  const [customerComplaint, setCustomerComplaint] = useState('');
  const [receptionNotes, setReceptionNotes] = useState('');
  const [recommendedService, setRecommendedService] = useState('');
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState('');
  const [checklistItems, setChecklistItems] = useState<InspectionItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleHistoryOpen, setVehicleHistoryOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  useEffect(() => {
    if (!data) return;
    setTechnicianId(data.serviceOrder.technicianId ?? '');
    setDiagnosis(data.serviceOrder.diagnosis ?? '');
    setEntryMileage(data.serviceOrder.entryMileage?.toString() ?? '');
    setCustomerComplaint(data.serviceOrder.customerComplaint ?? '');
    setReceptionNotes(data.serviceOrder.receptionNotes ?? '');
    setRecommendedService(data.serviceOrder.recommendedService ?? '');
    setExpectedDeliveryAt(data.serviceOrder.expectedDeliveryAt ? toLocalDateTimeInput(data.serviceOrder.expectedDeliveryAt) : '');
    setChecklistItems(parseChecklist(data.serviceOrder.checklist));
  }, [data]);

  if (isLoading) return <div className="h-56 animate-pulse rounded-card bg-surface" />;
  if (isError || !data) return <div className="rounded-card border border-danger/30 bg-danger-subtle p-8 text-center text-sm font-semibold text-danger-strong">Não foi possível carregar esta ordem de serviço.</div>;

  const { serviceOrder } = data;
  const canManagePhotos = hasPermission(currentUser, 'service_orders.manage');

  function handleSave() {
    update.mutate(
      {
        id: serviceOrder.id,
        technicianId: technicianId || undefined,
        diagnosis: diagnosis || undefined,
        checklist: serializeChecklist(checklistItems),
        entryMileage: entryMileage ? Number(entryMileage) : null,
        customerComplaint: customerComplaint || null,
        receptionNotes: receptionNotes || null,
        recommendedService: recommendedService || null,
        expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt).toISOString() : null,
      },
      {
        onSuccess: () => {
          toast.success('Ordem de serviço atualizada.');
          setActiveStep(4);
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">OS #{String(serviceOrder.orderNumber).padStart(5, '0')}</p><StatusBadge status={serviceOrder.status} /></div>
          <h2 className="text-2xl font-bold tracking-tight text-text">{serviceOrder.vehicleBrand} {serviceOrder.vehicleModel} · {serviceOrder.vehiclePlate}</h2>
          <p className="mt-1 text-sm text-text-muted">{serviceOrder.customerName} · Entrada em {new Date(serviceOrder.openedAt).toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pt-2">
          <Button variant="outline" size="sm" onClick={() => openPrintVersion(serviceOrder.id, 'summary')}><Printer className="size-4" />Resumo</Button>
          <Button variant="outline" size="sm" onClick={() => openPrintVersion(serviceOrder.id, 'full')}><Printer className="size-4" />Detalhado</Button>
          <StatusTransitionButtons serviceOrderId={serviceOrder.id} status={serviceOrder.status} />
        </div>
      </header>

      <section aria-label="Resumo da ordem de serviço" className="grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Cliente" value={serviceOrder.customerName} detail={serviceOrder.customerPhone} />
        <Summary label="Veículo" value={`${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`} detail={serviceOrder.vehiclePlate} />
        <Summary label="Quilometragem" value={serviceOrder.entryMileage ? `${serviceOrder.entryMileage.toLocaleString('pt-BR')} km` : 'Não informada'} />
        <Summary label="Técnico" value={serviceOrder.technicianName ?? 'Não atribuído'} />
        <Summary label="Previsão" value={serviceOrder.expectedDeliveryAt ? new Date(serviceOrder.expectedDeliveryAt).toLocaleString('pt-BR') : 'Não definida'} />
      </section>

      {hasPermission(currentUser, 'service_orders.prices') && <ServiceOrderQuoteActions serviceOrder={serviceOrder} />}

      <ServiceOrderStepper activeStep={activeStep} onStepChange={setActiveStep} />

      {activeStep === 1 && <div className="space-y-5">
        <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
          <SectionTitle number="1" title="Entrada do veículo" description="Registre com clareza o que o cliente solicitou e as condições combinadas." />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Solicitação ou queixa do cliente"><Textarea value={customerComplaint} onChange={(event) => setCustomerComplaint(event.target.value)} placeholder="Ex.: ruído ao frear e revisão preventiva" /></Field>
            <Field label="Observações da recepção"><Textarea value={receptionNotes} onChange={(event) => setReceptionNotes(event.target.value)} placeholder="Condições de entrada, avarias visíveis ou acordos com o cliente" /></Field>
            <Field label="Quilometragem de entrada"><Input type="number" min={0} value={entryMileage} onChange={(event) => setEntryMileage(event.target.value)} placeholder="Ex.: 82450" /></Field>
            <Field label="Previsão de entrega"><Input type="datetime-local" value={expectedDeliveryAt} onChange={(event) => setExpectedDeliveryAt(event.target.value)} /></Field>
          </div>
        </section>
        <VehiclePhotoSection serviceOrderId={serviceOrder.id} category="ENTRY" canManage={canManagePhotos} />
        <StepActions onNext={() => setActiveStep(2)} />
      </div>}

      {activeStep === 2 && <div><div className="mb-3"><SectionTitle number="2" title="Inspeção do veículo" description="Verifique os pontos de entrada antes de definir o serviço." /></div><InspectionChecklist items={checklistItems} onChange={setChecklistItems} disabled={update.isPending} /><StepActions onBack={() => setActiveStep(1)} onNext={() => setActiveStep(3)} /></div>}

      {activeStep === 3 && <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
        <SectionTitle number="3" title="Diagnóstico técnico" description="Registre o que foi encontrado e a solução recomendada." />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field label="Diagnóstico encontrado"><Textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="Problema identificado e causa provável" /></Field>
          <Field label="Serviço recomendado"><Textarea value={recommendedService} onChange={(event) => setRecommendedService(event.target.value)} placeholder="Serviços necessários para corrigir o problema" /></Field>
          <Field label="Técnico responsável"><Select value={technicianId} onValueChange={setTechnicianId}><SelectTrigger><SelectValue placeholder="Nenhum técnico atribuído" /></SelectTrigger><SelectContent>{usersData?.items.map((technician) => <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setActiveStep(2)}><CaretLeft className="size-4" />Anterior</Button><Button onClick={handleSave} loading={update.isPending}>{update.isPending ? 'Salvando...' : 'Salvar e continuar'}</Button></div>
      </section>}

      {activeStep === 4 && <div className="space-y-5">
        <ServiceOrderItemsSection serviceOrder={serviceOrder} />
        <ItemPhotosSection serviceOrderId={serviceOrder.id} items={serviceOrder.items ?? []} canManage={canManagePhotos} />
        <StepActions onBack={() => setActiveStep(3)} onNext={() => setActiveStep(5)} />
      </div>}

      {activeStep === 5 && <div className="space-y-5">
        <VehiclePhotoSection serviceOrderId={serviceOrder.id} category="EXIT" canManage={canManagePhotos} />
        <StepActions onBack={() => setActiveStep(4)} onNext={() => setActiveStep(6)} />
      </div>}

      {activeStep === 6 && <div className="space-y-5">
        {(hasPermission(currentUser, 'receipts.manage') || (currentUser?.role === 'ADMIN' && (!currentUser.profileName || currentUser.profileName === 'ADMIN'))) && <ServiceOrderPaymentSection serviceOrder={serviceOrder} />}
        <StepActions onBack={() => setActiveStep(5)} />
      </div>}

      <details className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5"><summary className="cursor-pointer text-lg font-bold tracking-tight text-text">Histórico da OS</summary><div className="mt-4"><StatusHistoryTimeline history={serviceOrder.statusHistory ?? []} /></div></details>

      <div className="flex justify-between border-t border-border pt-4"><Button variant="outline" size="sm" onClick={() => setVehicleHistoryOpen(true)}><ClockCounterClockwise className="mr-2 size-4" />Ver histórico do veículo</Button><Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setDeleteDialogOpen(true)}>Excluir OS</Button></div>

      <DeleteServiceOrderDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} serviceOrder={serviceOrder} onDeleted={() => router.push('/service-orders')} />
      <VehicleServiceHistoryDialog open={vehicleHistoryOpen} onOpenChange={setVehicleHistoryOpen} vehicleId={serviceOrder.vehicleId} vehicleLabel={`${serviceOrder.vehicleBrand} ${serviceOrder.vehicleModel}`} plate={serviceOrder.vehiclePlate} />
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="bg-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 truncate text-sm font-bold text-text">{value}</p>{detail && <p className="mt-0.5 truncate text-xs text-text-muted">{detail}</p>}</div>;
}

function SectionTitle({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><div><h3 className="text-lg font-bold tracking-tight text-text">{title}</h3><p className="mt-0.5 text-sm text-text-muted">{description}</p></div></div>;
}

const STEPS = [
  { number: 1 as const, label: 'Entrada do veículo', shortLabel: 'Entrada' },
  { number: 2 as const, label: 'Inspeção do veículo', shortLabel: 'Inspeção' },
  { number: 3 as const, label: 'Diagnóstico técnico', shortLabel: 'Diagnóstico' },
  { number: 4 as const, label: 'Serviços executados', shortLabel: 'Serviços' },
  { number: 5 as const, label: 'Saída do veículo', shortLabel: 'Saída' },
  { number: 6 as const, label: 'Pagamento', shortLabel: 'Pagamento' },
];

function ServiceOrderStepper({ activeStep, onStepChange }: { activeStep: 1 | 2 | 3 | 4 | 5 | 6; onStepChange: (step: 1 | 2 | 3 | 4 | 5 | 6) => void }) {
  return <nav aria-label="Etapas da ordem de serviço" className="rounded-card border border-border bg-card px-3 py-4 shadow-sm sm:px-6">
    <ol className="grid grid-cols-6">
      {STEPS.map((step, index) => {
        const active = step.number === activeStep;
        const completed = step.number < activeStep;
        return <li key={step.number} className="relative flex justify-center">
          {index > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-4 h-0.5 w-full ${step.number <= activeStep ? 'bg-primary' : 'bg-border'}`} />}
          <button type="button" onClick={() => onStepChange(step.number)} aria-current={active ? 'step' : undefined} className="group relative z-10 flex min-w-0 flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${active ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/10' : completed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-text-muted group-hover:border-primary/50'}`}>{completed ? <Check className="size-4" /> : step.number}</span>
            <span className={`text-[11px] font-semibold sm:text-sm ${active ? 'text-text' : 'text-text-muted'}`}><span className="sm:hidden">{step.shortLabel}</span><span className="hidden sm:inline">{step.label}</span></span>
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}

function StepActions({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  return <div className={`mt-5 flex gap-3 border-t border-border pt-4 ${onBack ? 'justify-between' : 'justify-end'}`}>{onBack && <Button variant="outline" onClick={onBack}><CaretLeft className="size-4" />Anterior</Button>}{onNext && <Button onClick={onNext}>Próxima etapa<CaretRight className="size-4" /></Button>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function openPrintVersion(id: string, mode: 'summary' | 'full') {
  window.open(`/service-orders/${id}/print?mode=${mode}`, '_blank', 'noopener,noreferrer');
}
