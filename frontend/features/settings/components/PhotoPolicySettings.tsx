'use client';

import { useEffect, useState } from 'react';
import { Camera, FloppyDisk } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { PhotoPolicy } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { usePhotoPolicy, useUpdatePhotoPolicy } from '../hooks/use-settings';

const OPTIONS: Array<{ key: keyof PhotoPolicy; title: string; detail: string }> = [
  { key: 'entry', title: 'Fotos de entrada do veículo', detail: 'As 6 fotos de como o carro chegou, antes de pedir a aprovação ou iniciar o serviço.' },
  { key: 'exit', title: 'Fotos de saída do veículo', detail: 'As 6 fotos de como o carro sai, antes de marcar como pronto para entrega.' },
  { key: 'items', title: 'Fotos de antes e depois das peças', detail: 'Uma foto do problema e outra da solução para cada peça lançada, antes de concluir.' },
];

export function PhotoPolicySettings() {
  const saved = usePhotoPolicy();
  const update = useUpdatePhotoPolicy();
  const [policy, setPolicy] = useState<PhotoPolicy>(saved);
  useEffect(() => setPolicy(saved), [saved.entry, saved.exit, saved.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = policy.entry !== saved.entry || policy.exit !== saved.exit || policy.items !== saved.items;

  function save() {
    update.mutate(policy, {
      onSuccess: () => toast.success('Exigência de fotos atualizada.'),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar a exigência de fotos.')),
    });
  }

  return <section className="rounded-card border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary"><Camera className="size-5" aria-hidden="true" /></span><div><h3 className="text-lg font-bold">Fotos nas ordens de serviço</h3><p className="mt-1 text-sm text-text-muted">Escolha o que é obrigatório para a OS avançar. As fotos continuam podendo ser tiradas mesmo quando não são exigidas.</p></div></div>
    <div className="mt-4 space-y-2">{OPTIONS.map((option) => <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-button border border-border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={policy[option.key]} onChange={(event) => setPolicy((current) => ({ ...current, [option.key]: event.target.checked }))} /><span><span className="block text-sm font-semibold">{option.title}</span><span className="mt-0.5 block text-xs text-text-muted">{option.detail}</span></span></label>)}</div>
    <div className="mt-4 flex justify-end"><Button onClick={save} disabled={!dirty || update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar exigência'}</Button></div>
  </section>;
}
