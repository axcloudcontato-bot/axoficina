'use client';

import type { CompanySettingsResponse } from '@oficina/contracts';
import Image from 'next/image';
import { ChangeEvent, useEffect, useState } from 'react';
import { Buildings, Image as ImageIcon, FloppyDisk, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { useSettings, useUpdateCompanySettings } from '../hooks/use-settings';
import { useUnsavedSettings } from '../hooks/use-unsaved-settings';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const EMPTY: CompanySettingsResponse = { name: '', document: '' };

export function CompanySettingsForm() {
  const settings = useSettings();
  const update = useUpdateCompanySettings();
  const [form, setForm] = useState<CompanySettingsResponse>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'settings.manage');
  useEffect(() => { if (settings.data && !loaded) { setForm(settings.data.company); setLoaded(true); } }, [settings.data, loaded]);
  const dirty = loaded && JSON.stringify(form) !== JSON.stringify(settings.data?.company);
  useUnsavedSettings(dirty && !update.isPending);
  const set = (key: keyof CompanySettingsResponse, value: string | undefined) => setForm((current) => ({ ...current, [key]: value }));

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return toast.error('Use uma imagem PNG, JPEG ou WebP.');
    if (file.size > 500 * 1024) return toast.error('A logo deve ter no máximo 500 KiB.');
    const reader = new FileReader();
    reader.onload = () => set('logoDataUrl', String(reader.result));
    reader.readAsDataURL(file);
  }

  function save() {
    if (!canManage || !settings.data) return;
    if (!form.name.trim() || !form.document.trim()) return toast.error('Informe o nome e o CPF/CNPJ da empresa.');
    if (![11, 14].includes(form.document.replace(/\D/g, '').length)) return toast.error('CPF/CNPJ deve ter 11 ou 14 dígitos.');
    if (form.addressPostalCode && !/^\d{5}-?\d{3}$/.test(form.addressPostalCode.trim())) return toast.error('Informe um CEP válido.');
    if (form.website && !/^https?:\/\//i.test(form.website.trim())) return toast.error('Informe o endereço do site com http:// ou https://.');
    update.mutate(form, {
      onSuccess: () => { toast.success('Dados da empresa atualizados.'); settings.refetch(); },
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar os dados da empresa.')),
    });
  }

  if (settings.isLoading) return <div className="h-96 animate-pulse rounded-card bg-muted" />;
  if (settings.isError || !settings.data) return <div role="alert" className="rounded-card border border-danger/30 p-6"><p>Não foi possível carregar os dados da empresa.</p><Button variant="outline" className="mt-3" onClick={() => settings.refetch()}>Tentar novamente</Button></div>;
  return <fieldset disabled={!canManage || update.isPending} className="space-y-6">
    {!canManage && <p className="text-sm text-text-muted">Seu perfil permite consultar estes dados, mas não alterá-los.</p>}
    <Section title="Identidade da oficina" description="Esta marca aparecerá no sistema e nos documentos impressos.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-card border border-slate-700 bg-slate-900">
          {form.logoDataUrl ? <Image src={form.logoDataUrl} alt="Prévia da logo" width={112} height={112} unoptimized className="size-full object-contain p-2" /> : <Buildings className="size-10 text-text-muted" />}
        </div>
        <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><label className="cursor-pointer"><ImageIcon className="size-4" />Selecionar logo<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectLogo} /></label></Button>{form.logoDataUrl && <Button variant="ghost" className="text-danger" onClick={() => set('logoDataUrl', undefined)}><Trash className="size-4" />Remover</Button>}</div><p className="text-xs text-text-muted">PNG, JPEG ou WebP · até 500 KiB · preferência por fundo transparente.</p></div>
      </div>
    </Section>
    <Section title="Dados cadastrais" description="Informações usadas nos relatórios e comunicações."><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome fantasia" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field><Field label="Razão social"><Input value={form.legalName ?? ''} onChange={(e) => set('legalName', e.target.value)} /></Field><Field label="CPF/CNPJ" required><Input value={form.document} onChange={(e) => set('document', e.target.value)} /></Field><Field label="Inscrição estadual"><Input value={form.stateRegistration ?? ''} onChange={(e) => set('stateRegistration', e.target.value)} /></Field></div></Section>
    <Section title="Contato"><div className="grid gap-4 sm:grid-cols-2"><Field label="Telefone"><Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field><Field label="WhatsApp"><Input value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} /></Field><Field label="E-mail"><Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field><Field label="Site"><Input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} /></Field></div></Section>
    <Section title="Endereço"><div className="grid gap-4 sm:grid-cols-6"><div className="sm:col-span-4"><Field label="Logradouro"><Input value={form.addressStreet ?? ''} onChange={(e) => set('addressStreet', e.target.value)} /></Field></div><div className="sm:col-span-2"><Field label="Número"><Input value={form.addressNumber ?? ''} onChange={(e) => set('addressNumber', e.target.value)} /></Field></div><div className="sm:col-span-3"><Field label="Complemento"><Input value={form.addressComplement ?? ''} onChange={(e) => set('addressComplement', e.target.value)} /></Field></div><div className="sm:col-span-3"><Field label="Bairro"><Input value={form.addressDistrict ?? ''} onChange={(e) => set('addressDistrict', e.target.value)} /></Field></div><div className="sm:col-span-3"><Field label="Cidade"><Input value={form.addressCity ?? ''} onChange={(e) => set('addressCity', e.target.value)} /></Field></div><Field label="UF"><Input maxLength={2} value={form.addressState ?? ''} onChange={(e) => set('addressState', e.target.value.toUpperCase())} /></Field><div className="sm:col-span-2"><Field label="CEP"><Input value={form.addressPostalCode ?? ''} onChange={(e) => set('addressPostalCode', e.target.value)} /></Field></div></div></Section>
    <Section title="Documentos"><Field label="Texto do rodapé"><Textarea maxLength={500} value={form.documentFooter ?? ''} onChange={(e) => set('documentFooter', e.target.value)} placeholder="Ex.: Obrigado pela preferência. Garantia conforme condições da ordem de serviço." /></Field></Section>
    <Section title="Prévia da identificação" description="Confira como a oficina será identificada nos documentos."><div className="rounded-button border border-border bg-white p-5 text-slate-900"><div className="flex items-center gap-3">{form.logoDataUrl && <Image src={form.logoDataUrl} alt="" width={56} height={56} unoptimized className="size-14 object-contain" />}<div><p className="font-bold">{form.name || 'Nome da oficina'}</p><p className="text-xs">{form.legalName || 'Razão social'} · {form.document || 'CPF/CNPJ'}</p></div></div><p className="mt-3 text-xs">{[form.addressStreet, form.addressNumber, form.addressCity, form.addressState, form.addressPostalCode].filter(Boolean).join(', ') || 'Endereço da oficina'}</p><p className="mt-1 text-xs">{[form.phone, form.email, form.website].filter(Boolean).join(' · ') || 'Dados de contato'}</p>{form.documentFooter && <p className="mt-4 border-t border-slate-200 pt-2 text-xs">{form.documentFooter}</p>}</div></Section>
    {canManage && <div className="flex justify-end"><Button onClick={save} disabled={!dirty || update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar alterações'}</Button></div>}
  </fieldset>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <div className="rounded-card border border-border bg-card p-5 shadow-sm"><h2 className="text-base font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-text-muted">{description}</p>}<div className="mt-5">{children}</div></div>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold">{label}{required && <span className="sr-only"> obrigatório</span>}{children}</label>; }
