'use client';

import type { ServiceOrderItemResponse, ServiceOrderPhotoAngle, ServiceOrderPhotoCategory, ServiceOrderPhotoResponse } from '@oficina/contracts';
import { SERVICE_ORDER_PHOTO_ANGLES } from '@oficina/contracts';
import { Camera, CheckCircle, CircleNotch, Trash, UploadSimple, WarningCircle, Wrench, X } from '@phosphor-icons/react';
import Image from 'next/image';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { compressImageFile, ImagePreparationError } from '@/lib/compress-image';
import { isAxiosError } from 'axios';
import { useDeleteServiceOrderPhoto, useServiceOrderPhotoBlob, useServiceOrderPhotos, useUploadServiceOrderPhoto } from '../hooks/use-service-orders';

const ANGLE_LABELS: Record<ServiceOrderPhotoAngle, string> = {
  FRONT: 'Frente',
  REAR: 'Traseira',
  LEFT_SIDE: 'Lateral esquerda',
  RIGHT_SIDE: 'Lateral direita',
  SPARE_TIRE: 'Estepe/porta-malas',
  DASHBOARD: 'Painel (km)',
};

const VEHICLE_SECTION_COPY: Record<'ENTRY' | 'EXIT', { title: string; description: string }> = {
  ENTRY: { title: 'Fotos de entrada do veículo', description: 'Registre os 6 ângulos padrão de como o veículo chegou.' },
  EXIT: { title: 'Fotos de saída do veículo', description: 'Repita os mesmos ângulos para comparar com a entrada antes da entrega.' },
};

type Payload = { category: ServiceOrderPhotoCategory; angle?: ServiceOrderPhotoAngle; serviceOrderItemId?: string };

// Seção autocontida (busca as fotos, mantém seu próprio visualizador) pra
// poder ser usada isolada em passos diferentes do fluxo da OS — entrada na
// abertura, saída no fechamento — em vez de uma galeria única misturando
// os dois momentos.
export function VehiclePhotoSection({ serviceOrderId, category, canManage }: { serviceOrderId: string; category: 'ENTRY' | 'EXIT'; canManage: boolean }) {
  const query = useServiceOrderPhotos(serviceOrderId);
  const [selected, setSelected] = useState<ServiceOrderPhotoResponse | null>(null);
  const photos = query.data?.photos ?? [];
  const copy = VEHICLE_SECTION_COPY[category];

  const byAngle = useMemo(() => {
    const map = new Map<ServiceOrderPhotoAngle, ServiceOrderPhotoResponse[]>();
    for (const photo of photos) {
      if (photo.category !== category || !photo.angle) continue;
      map.set(photo.angle, [...(map.get(photo.angle) ?? []), photo]);
    }
    return map;
  }, [photos, category]);

  const coveredCount = SERVICE_ORDER_PHOTO_ANGLES.filter((angle) => (byAngle.get(angle) ?? []).length > 0).length;

  return <section aria-labelledby={`vehicle-photos-${category}`} className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
    <header className="flex items-start gap-3 border-b border-border pb-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-primary-subtle text-primary"><Camera className="size-5" /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Evidências da OS</p>
        <h3 id={`vehicle-photos-${category}`} className="mt-1 text-lg font-bold">{copy.title} <span className="ml-1 text-sm font-semibold text-text-muted">{coveredCount}/6</span></h3>
        <p className="mt-1 text-sm text-text-muted">{copy.description}</p>
        <p className="mt-2 text-xs leading-5 text-text-muted">Fotografe somente o veículo e as evidências necessárias ao serviço. Evite rostos, documentos e objetos pessoais.</p>
      </div>
    </header>
    {query.isLoading && <div className="flex h-40 items-center justify-center text-text-muted"><CircleNotch className="size-6 animate-spin" /></div>}
    {query.isError && <p role="alert" className="py-4 text-center text-sm font-semibold text-danger">Não foi possível atualizar as fotos. <button type="button" className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
    {!query.isLoading && (!query.isError || query.data) && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SERVICE_ORDER_PHOTO_ANGLES.map((angle) => <PhotoSlot key={`${serviceOrderId}:${category}:${angle}`} serviceOrderId={serviceOrderId} payload={{ category, angle }} label={ANGLE_LABELS[angle]} photos={byAngle.get(angle) ?? []} canManage={canManage} onSelect={setSelected} />)}
    </div>}
    <PhotoViewer photo={selected} onClose={() => setSelected(null)} canManage={canManage} serviceOrderId={serviceOrderId} />
  </section>;
}

export function ItemPhotosSection({ serviceOrderId, items, canManage }: { serviceOrderId: string; items: ServiceOrderItemResponse[]; canManage: boolean }) {
  const query = useServiceOrderPhotos(serviceOrderId);
  const [selected, setSelected] = useState<ServiceOrderPhotoResponse | null>(null);
  const photos = query.data?.photos ?? [];

  const byItem = useMemo(() => {
    const map = new Map<string, ServiceOrderPhotoResponse[]>();
    for (const photo of photos) {
      if (!photo.serviceOrderItemId) continue;
      const key = `${photo.serviceOrderItemId}:${photo.category}`;
      map.set(key, [...(map.get(key) ?? []), photo]);
    }
    return map;
  }, [photos]);

  return <section aria-labelledby="item-photos-title" className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
    <header className="flex items-start gap-3 border-b border-border pb-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-primary-subtle text-primary"><Wrench className="size-5" /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Evidências da OS</p>
        <h3 id="item-photos-title" className="mt-1 text-lg font-bold">Antes e depois por item</h3>
        <p className="mt-1 text-sm text-text-muted">Para cada peça ou serviço lançado na OS, registre uma foto do problema e uma da solução.</p>
        <p className="mt-2 text-xs leading-5 text-text-muted">Limite as imagens à peça e ao serviço; evite pessoas, documentos e objetos pessoais.</p>
      </div>
    </header>
    {query.isLoading && <div className="flex h-40 items-center justify-center text-text-muted"><CircleNotch className="size-6 animate-spin" /></div>}
    {query.isError && <p role="alert" className="py-4 text-center text-sm font-semibold text-danger">Não foi possível atualizar as fotos. <button type="button" className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
    {!query.isLoading && (!query.isError || query.data) && (
      items.length === 0
        ? <div className="mt-4 flex min-h-20 items-center justify-center rounded-button border border-dashed border-border bg-muted/30 px-4 text-center text-xs text-text-muted">Nenhum item lançado nesta OS ainda.</div>
        : <div className="mt-4 space-y-3">
          {items.map((item) => <div key={item.id} className="rounded-button border border-border bg-card p-3">
            <p className="mb-2 text-sm font-semibold text-text">{item.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <PhotoSlot serviceOrderId={serviceOrderId} payload={{ category: 'ISSUE', serviceOrderItemId: item.id }} label="Antes (problema)" photos={byItem.get(`${item.id}:ISSUE`) ?? []} canManage={canManage} onSelect={setSelected} />
              <PhotoSlot serviceOrderId={serviceOrderId} payload={{ category: 'RESOLVED', serviceOrderItemId: item.id }} label="Depois (solução)" photos={byItem.get(`${item.id}:RESOLVED`) ?? []} canManage={canManage} onSelect={setSelected} />
            </div>
          </div>)}
        </div>
    )}
    <PhotoViewer photo={selected} onClose={() => setSelected(null)} canManage={canManage} serviceOrderId={serviceOrderId} />
  </section>;
}

function PhotoSlot({ serviceOrderId, payload, label, photos, canManage, onSelect }: { serviceOrderId: string; payload: Payload; label: string; photos: ServiceOrderPhotoResponse[]; canManage: boolean; onSelect: (photo: ServiceOrderPhotoResponse) => void }) {
  const upload = useUploadServiceOrderPhoto();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const preparedFile = useRef<File | null>(null);
  const [stage, setStage] = useState<'idle' | 'preparing' | 'uploading' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const busy = stage === 'preparing' || stage === 'uploading' || upload.isPending;
  const latest = photos[photos.length - 1];

  function fail(error: unknown) {
    const message = error instanceof ImagePreparationError ? error.message
      : isAxiosError(error) && error.response?.status === 413 ? 'A foto excedeu o limite de envio do servidor. Selecione uma foto menor.'
      : isAxiosError(error) && !error.response ? 'A conexão foi interrompida. Confira se a foto apareceu na galeria antes de tentar novamente.'
      : extractErrorMessage(error, 'Não foi possível enviar a foto. Confira a conexão e tente novamente.');
    setErrorMessage(message);
    setStage('error');
    toast.error(message);
  }

  async function sendPreparedFile(file: File) {
    setStage('uploading');
    await upload.mutateAsync({ serviceOrderId, ...payload, file });
    preparedFile.current = null;
    setStage('saved');
    toast.success(`Foto de ${label.toLowerCase()} salva na OS.`);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Reset synchronously so a second capture with the same name fires change.
    input.value = '';
    if (!file || busyRef.current) return;
    busyRef.current = true;
    preparedFile.current = null;
    setErrorMessage('');
    setStage('preparing');
    try {
      const compressed = await compressImageFile(file);
      preparedFile.current = compressed;
      await sendPreparedFile(compressed);
    } catch (error) { fail(error); }
    finally { busyRef.current = false; }
  }

  async function retry() {
    if (!preparedFile.current || busyRef.current) return;
    busyRef.current = true;
    setErrorMessage('');
    try { await sendPreparedFile(preparedFile.current); }
    catch (error) { fail(error); }
    finally { busyRef.current = false; }
  }

  return <div role="group" aria-label={`Foto: ${label}`} aria-busy={busy} className="overflow-hidden rounded-button border border-border bg-muted">
    <button type="button" disabled={!latest} onClick={() => latest && onSelect(latest)} className="relative block aspect-[4/3] w-full text-left disabled:cursor-default">
      {latest ? <PhotoContent photo={latest} /> : <span className="flex size-full flex-col items-center justify-center gap-1 text-text-muted"><Camera className="size-5" /><span className="text-[10px] font-semibold">Sem foto</span></span>}
      {photos.length > 1 && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">{photos.length}</span>}
    </button>
    <div className="space-y-2 bg-card px-2.5 py-2">
      <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-text">{latest ? <CheckCircle weight="fill" className="size-3.5 shrink-0 text-success" /> : <WarningCircle className="size-3.5 shrink-0 text-text-muted" />}<span className="truncate">{label}</span></span>
      {canManage && <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => cameraInput.current?.click()} disabled={busy} className="flex h-8 items-center justify-center gap-1 rounded-button border border-border text-[11px] font-bold text-primary transition-colors hover:bg-muted disabled:opacity-50"><Camera className="size-3.5" aria-hidden="true" />Câmera</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="flex h-8 items-center justify-center gap-1 rounded-button border border-border text-[11px] font-bold text-primary transition-colors hover:bg-muted disabled:opacity-50"><UploadSimple className="size-3.5" aria-hidden="true" />Arquivo</button>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={selectFile} />
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={selectFile} />
      </div>}
      {stage !== 'idle' && <p role={stage === 'error' ? 'alert' : 'status'} className={`break-words text-xs ${stage === 'error' ? 'text-danger' : 'text-text-muted'}`}>{stage === 'preparing' ? 'Preparando foto...' : stage === 'uploading' ? 'Enviando foto...' : stage === 'saved' ? 'Foto salva na OS.' : errorMessage}</p>}
      {canManage && stage === 'error' && preparedFile.current && <button type="button" onClick={retry} className="min-h-9 w-full rounded-button border border-border px-2 text-xs font-bold text-primary hover:bg-muted">Tentar enviar novamente</button>}
    </div>
  </div>;
}

function PhotoContent({ photo, fit = 'cover' }: { photo: ServiceOrderPhotoResponse; fit?: 'cover' | 'contain' }) {
  const blob = useServiceOrderPhotoBlob(photo.id);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob.data) return;
    const next = URL.createObjectURL(blob.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob.data]);
  if (blob.isError) return <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-danger"><WarningCircle className="size-5" />Não foi possível carregar a foto.</span>;
  if (!url) return <span className="flex size-full items-center justify-center text-text-muted"><CircleNotch className="size-5 animate-spin" /></span>;
  return <Image src={url} alt={photo.caption || `Foto ${photo.originalName}`} fill unoptimized sizes={fit === 'contain' ? '100vw' : '(max-width: 640px) 50vw, 25vw'} className={fit === 'contain' ? 'object-contain' : 'object-cover transition-transform duration-300 group-hover:scale-[1.03]'} />;
}

function PhotoViewer({ photo, onClose, canManage, serviceOrderId }: { photo: ServiceOrderPhotoResponse | null; onClose: () => void; canManage: boolean; serviceOrderId: string }) {
  const remove = useDeleteServiceOrderPhoto(serviceOrderId);
  function deletePhoto() {
    if (!photo || !window.confirm('Excluir esta foto da ordem de serviço?')) return;
    remove.mutate(photo.id, { onSuccess: () => { toast.success('Foto excluída.'); onClose(); }, onError: (error) => toast.error(extractErrorMessage(error)) });
  }
  return <Dialog open={Boolean(photo)} onOpenChange={(open) => !open && onClose()}><DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1400px)]"><DialogHeader className="sr-only"><DialogTitle>Visualização da foto</DialogTitle></DialogHeader>{photo && <><div className="relative h-[72dvh] w-full bg-slate-950 sm:h-[80dvh]"><PhotoContent photo={photo} fit="contain" /><button onClick={onClose} className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Fechar"><X className="size-5" /></button></div><div className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{photo.caption || photo.originalName}</p><p className="text-xs text-text-muted">{new Date(photo.createdAt).toLocaleString('pt-BR')}</p></div>{canManage && <Button variant="ghost" className="text-danger" onClick={deletePhoto} disabled={remove.isPending}><Trash className="size-4" />Excluir foto</Button>}</div></>}</DialogContent></Dialog>;
}
