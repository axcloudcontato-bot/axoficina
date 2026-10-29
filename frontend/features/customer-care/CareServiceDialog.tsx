'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_CARE_CAMPAIGNS, type CareCampaign, type CarePlanResponse, type CareServiceKey } from '@oficina/contracts';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VehicleSearchCombobox } from '@/features/vehicles/components/VehicleSearchCombobox';
import { extractErrorMessage } from '@/lib/api/client';
import { useRecordCareService } from './use-customer-care';

const inputClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm';
export function CareServiceDialog({ open, onOpenChange, plan, campaigns = DEFAULT_CARE_CAMPAIGNS, vehicle, defaultServiceKey }: { open: boolean; onOpenChange: (open: boolean) => void; plan?: CarePlanResponse; campaigns?: CareCampaign[]; /** The car is already known (opened from its page): no search needed. */ vehicle?: { id: string; label: string }; defaultServiceKey?: CareServiceKey }) {
  const save = useRecordCareService();
  const [vehicleId, setVehicleId] = useState(''); const [serviceKey, setServiceKey] = useState<CareServiceKey>('PERIODIC_REVIEW');
  const today = new Date().toLocaleDateString('en-CA');
  const [date, setDate] = useState(today); const [mileage, setMileage] = useState(''); const [months, setMonths] = useState(''); const [km, setKm] = useState('');
  useEffect(() => { if (open) { setVehicleId(plan?.vehicleId ?? vehicle?.id ?? ''); setServiceKey(plan?.serviceKey ?? defaultServiceKey ?? 'PERIODIC_REVIEW'); setDate(today); setMileage(''); setMonths(''); setKm(''); } }, [open, plan, vehicle, defaultServiceKey, today]);
  const campaign = campaigns.find(item => item.key === serviceKey)!;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Registrar um cuidado realizado</DialogTitle><DialogDescription>A data real do serviço inicia o próximo lembrete deste cuidado. Cada veículo mantém seu próprio plano.</DialogDescription></DialogHeader>
    <form onSubmit={event => { event.preventDefault(); save.mutate({ vehicleId, serviceKey, completedAt: date, ...(mileage !== '' ? { mileage: Number(mileage) } : {}), ...(months !== '' ? { intervalMonths: Number(months) } : {}), ...(km !== '' ? { intervalKm: Number(km) } : {}) }, { onSuccess: () => { toast.success('Cuidado registrado. O próximo retorno já está no plano.'); onOpenChange(false); }, onError: error => toast.error(extractErrorMessage(error)) }); }} className="space-y-4">
      <label className="block space-y-1.5 text-sm font-semibold"><span>Veículo e cliente</span><VehicleSearchCombobox value={vehicleId} onChange={setVehicleId} initialLabel={plan ? `${plan.customerName} — ${plan.vehicleName} · ${plan.plate}` : vehicle?.label} placeholder="Busque placa, veículo ou cliente" required /></label>
      <label className="block space-y-1.5 text-sm font-semibold"><span>Cuidado realizado</span><select className={inputClass} value={serviceKey} onChange={event => setServiceKey(event.target.value as CareServiceKey)}>{DEFAULT_CARE_CAMPAIGNS.filter(item => item.key !== 'BIRTHDAY').map(item => <option key={item.key} value={item.key}>{item.emoji} {item.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5 text-sm font-semibold"><span>Data do serviço</span><Input type="date" value={date} max={today} min="1970-01-01" onChange={event => setDate(event.target.value)} required /></label><label className="space-y-1.5 text-sm font-semibold"><span>Quilometragem (opcional)</span><Input type="number" min={0} max={9999999} step={1} value={mileage} onChange={event => setMileage(event.target.value)} placeholder="KM real do veículo" /></label></div>
      <details className="rounded-button border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Personalizar prazo para este veículo</summary><p className="mt-2 text-xs leading-5 text-muted-foreground">Deixe em branco para usar o prazo configurado na campanha. Confira o manual e as condições de uso antes de definir o retorno.</p><div className="mt-3 grid grid-cols-2 gap-3"><label className="space-y-1 text-sm"><span>Intervalo em meses</span><Input type="number" min={1} max={120} value={months} onChange={event => setMonths(event.target.value)} placeholder={`Padrão: ${campaign.intervalMonths}`} /></label><label className="space-y-1 text-sm"><span>Intervalo em KM</span><Input type="number" min={500} max={200000} step={500} value={km} onChange={event => setKm(event.target.value)} placeholder={campaign.intervalKm ? `Padrão: ${campaign.intervalKm}` : 'Sem prazo por KM'} /></label></div></details>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={!vehicleId || save.isPending}>{save.isPending ? 'Registrando…' : 'Registrar cuidado'}</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}
