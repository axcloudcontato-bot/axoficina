'use client';

import { useState } from 'react';
import type { AccessProfileResponse, PermissionKey } from '@oficina/contracts';
import { Plus, ShieldCheck } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { useAccessProfiles, useCreateAccessProfile, useUpdateAccessProfile } from '../hooks/use-access-profiles';

const MODULES: Array<{ name: string; permissions: Array<{ key: PermissionKey; label: string }> }> = [
  { name: 'Visão e financeiro', permissions: [{ key: 'dashboard.view', label: 'Ver visão da oficina' }, { key: 'finance.view', label: 'Ver informações financeiras' }, { key: 'finance.manage', label: 'Criar e alterar lançamentos' }] },
  { name: 'Ordens de serviço', permissions: [{ key: 'service_orders.view', label: 'Consultar' }, { key: 'service_orders.manage', label: 'Criar e alterar' }, { key: 'service_orders.prices', label: 'Ver e alterar valores' }, { key: 'receipts.manage', label: 'Confirmar e estornar recebimentos' }] },
  { name: 'Agenda', permissions: [{ key: 'appointments.view', label: 'Consultar' }, { key: 'appointments.manage', label: 'Criar e alterar' }] },
  { name: 'Clientes', permissions: [{ key: 'customers.view', label: 'Consultar' }, { key: 'customers.manage', label: 'Criar e alterar' }] },
  { name: 'Veículos', permissions: [{ key: 'vehicles.view', label: 'Consultar' }, { key: 'vehicles.manage', label: 'Criar e alterar' }] },
  { name: 'Alertas', permissions: [{ key: 'alerts.view', label: 'Consultar' }, { key: 'alerts.manage', label: 'Resolver alertas' }] },
  { name: 'Equipe e acesso', permissions: [{ key: 'team.view', label: 'Ver equipe' }, { key: 'team.manage', label: 'Convidar e alterar usuários' }, { key: 'profiles.manage', label: 'Gerenciar perfis' }] },
  { name: 'Configurações', permissions: [{ key: 'settings.view', label: 'Ver empresa, operação e integrações' }, { key: 'settings.manage', label: 'Alterar empresa, operação e integrações' }] },
];

export function AccessProfilesPanel() {
  const query = useAccessProfiles();
  const create = useCreateAccessProfile();
  const update = useUpdateAccessProfile();
  const [editing, setEditing] = useState<AccessProfileResponse | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);

  function open(profile?: AccessProfileResponse) {
    setEditing(profile ?? null);
    setName(profile?.name ?? '');
    setDescription(profile?.description ?? '');
    setPermissions(profile?.permissions ?? ['dashboard.view']);
  }
  function toggle(key: PermissionKey) {
    setPermissions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }
  function save() {
    if (!name.trim()) return toast.error('Informe o nome do perfil.');
    const removed = editing?.permissions.filter((permission) => !permissions.includes(permission)) ?? [];
    if (editing && removed.length && editing.userCount > 0 && !window.confirm(`Este perfil é usado por ${editing.userCount} pessoa(s). Ao salvar, elas perderão ${removed.length} permissão(ões). Confirmar?`)) return;
    const request = editing
      ? update.mutateAsync({ id: editing.id, name, description, permissions })
      : create.mutateAsync({ name, description, permissions });
    request.then(() => { toast.success(editing ? 'Perfil atualizado.' : 'Perfil criado.'); setEditing(undefined); }).catch((error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar o perfil.')));
  }

  return <section className="space-y-3">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-text">Perfis de acesso</h2><p className="text-sm text-text-muted">Defina exatamente quais módulos cada função pode acessar.</p></div><Button onClick={() => open()}><Plus className="size-4" />Novo perfil</Button></div>
    {query.isPending && <p role="status" className="text-sm text-text-muted">Carregando perfis...</p>}
    {query.isError && <div role="alert" className="rounded-card border border-danger/30 p-4 text-sm">Não foi possível carregar os perfis. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar novamente</Button></div>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {query.data?.items.map((profile) => <button key={profile.id} type="button" onClick={() => open(profile)} className="rounded-card border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/30">
        <div className="flex items-start justify-between gap-3"><div className="flex size-9 items-center justify-center rounded-button bg-primary/10 text-primary"><ShieldCheck className="size-4" /></div><span className="text-xs text-text-muted">{profile.userCount} {profile.userCount === 1 ? 'usuário' : 'usuários'}</span></div>
        <h3 className="mt-3 font-bold text-text">{profile.name}</h3><p className="mt-1 min-h-10 text-sm text-text-muted">{profile.description || (profile.isSystem ? 'Perfil padrão do sistema' : 'Perfil personalizado')}</p>
        <p className="mt-3 text-xs font-semibold text-primary">{profile.permissions.length} permissões · clique para configurar</p>
      </button>)}
    </div>
    <Dialog open={editing !== undefined} onOpenChange={(value) => !value && setEditing(undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2.5"><span data-reveal className="flex size-8 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted"><ShieldCheck className="size-[18px]" aria-hidden="true" /></span>{editing ? 'Editar perfil' : 'Novo perfil'}</DialogTitle><DialogDescription>Marque apenas os acessos necessários para esta função. {editing?.userCount ? `As alterações afetarão ${editing.userCount} pessoa(s).` : ''}</DialogDescription></DialogHeader>
        <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Nome do perfil" placeholder="Ex.: Consultor técnico" value={name} disabled={Boolean(editing?.isSystem)} onChange={(e) => setName(e.target.value)} /><Textarea aria-label="Descrição do perfil" className="min-h-10" placeholder="Responsabilidades deste perfil" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">{MODULES.map((module) => <fieldset key={module.name} className="rounded-button border border-border p-3"><legend className="px-1 text-sm font-bold text-text">{module.name}</legend><div className="mt-1 space-y-2">{module.permissions.map((permission) => <label key={permission.key} className="flex cursor-pointer items-center gap-2 text-sm text-text-muted"><input type="checkbox" checked={permissions.includes(permission.key)} onChange={() => toggle(permission.key)} className="size-4 accent-primary" />{permission.label}</label>)}</div></fieldset>)}</div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>Cancelar</Button><Button onClick={save} disabled={create.isPending || update.isPending}>Salvar perfil</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
