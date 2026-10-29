'use client';

import { useEffect, useState } from 'react';
import type { ServiceOrderResponse } from '@oficina/contracts';
import { parseChecklist, serializeChecklist } from '../checklist';
import { useUpdateServiceOrder } from './use-service-orders';
import { extractErrorMessage } from '@/lib/api/client';
import { toast } from 'sonner';

function valuesFrom(order: ServiceOrderResponse) {
  const localDate = order.expectedDeliveryAt ? new Date(order.expectedDeliveryAt) : null;
  return {
    technicianId: order.technicianId ?? '', diagnosis: order.diagnosis ?? '',
    warrantyDays: order.warrantyDays?.toString() ?? '', exitMileage: order.exitMileage?.toString() ?? '',
    entryMileage: order.entryMileage?.toString() ?? '', customerComplaint: order.customerComplaint ?? '',
    receptionNotes: order.receptionNotes ?? '', recommendedService: order.recommendedService ?? '',
    expectedDeliveryAt: localDate ? new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '',
    checklist: parseChecklist(order.checklist),
  };
}

export function useServiceOrderDraft(order: ServiceOrderResponse) {
  const update = useUpdateServiceOrder();
  const [state, setState] = useState(() => ({ values: valuesFrom(order), baseline: valuesFrom(order) }));
  const dirty = JSON.stringify(state.values) !== JSON.stringify(state.baseline);
  useEffect(() => {
    // Background refreshes after uploads, item edits or customer replies must
    // never overwrite what the employee is still typing.
    setState(current => JSON.stringify(current.values) !== JSON.stringify(current.baseline) ? current : { values: valuesFrom(order), baseline: valuesFrom(order) });
  }, [order]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  function set<K extends keyof typeof state.values>(field: K, value: typeof state.values[K]) {
    setState(current => ({ ...current, values: { ...current.values, [field]: value } }));
  }
  async function save() {
    if (!dirty) return true;
    if (update.isPending) return false;
    const values = state.values;
    const mileage = values.entryMileage === '' ? null : Number(values.entryMileage);
    if (mileage !== null && (!Number.isInteger(mileage) || mileage < 0 || mileage > 2_147_483_647)) { toast.error('Informe uma quilometragem válida.'); return false; }
    const warranty = values.warrantyDays === '' ? null : Number(values.warrantyDays);
    if (warranty !== null && (!Number.isInteger(warranty) || warranty < 0 || warranty > 3650)) { toast.error('Informe a garantia em dias, de 0 a 3650.'); return false; }
    const exitMileage = values.exitMileage === '' ? null : Number(values.exitMileage);
    if (exitMileage !== null && (!Number.isInteger(exitMileage) || exitMileage < 0 || exitMileage > 2_147_483_647)) { toast.error('Informe uma quilometragem de saída válida.'); return false; }
    try {
      await update.mutateAsync({ id: order.id, technicianId: values.technicianId || undefined, diagnosis: values.diagnosis, warrantyDays: warranty, exitMileage,
        checklist: serializeChecklist(values.checklist), entryMileage: mileage,
        customerComplaint: values.customerComplaint || null, receptionNotes: values.receptionNotes || null,
        recommendedService: values.recommendedService || null, expectedDeliveryAt: values.expectedDeliveryAt ? new Date(values.expectedDeliveryAt).toISOString() : null });
      setState(current => ({ ...current, baseline: values }));
      toast.success('Alterações salvas.');
      return true;
    } catch (error) { toast.error(extractErrorMessage(error)); return false; }
  }
  return { values: state.values, set, dirty, saving: update.isPending, save, discard: () => setState(current => ({ ...current, values: current.baseline })) };
}
