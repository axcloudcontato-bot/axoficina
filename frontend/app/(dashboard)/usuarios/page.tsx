'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { InviteUserModal } from '@/features/users/components/InviteUserModal';
import { UsersTable } from '@/features/users/components/UsersTable';
import { useDeleteUser, useDisableUser, useEnableUser, useRenameUser, useResendInvite, useUsersList } from '@/features/users/hooks/use-users';
import type { UserListItemResponse } from '@oficina/contracts';
import { extractErrorMessage } from '@/lib/api/client';
import { AccessProfilesPanel } from '@/features/access-profiles/components/AccessProfilesPanel';
import { useAccessProfiles, useAssignUserProfile } from '@/features/access-profiles/hooks/use-access-profiles';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

function UsersPageContent() {
  const [offset, setOffset] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => setQuerySearch(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  const [status, setStatus] = useState<'all' | 'active' | 'invited' | 'disabled'>('all');
  const { data, isLoading, isError, refetch } = useUsersList({ offset, limit: PAGE_SIZE, filters: { search: querySearch || undefined, status: status === 'all' ? undefined : status } });
  const user = useAuthStore((state) => state.user);
  const canManageProfiles = hasPermission(user, 'profiles.manage');
  const profiles = useAccessProfiles(canManageProfiles);
  const assignProfile = useAssignUserProfile();
  const disableUser = useDisableUser();
  const enableUser = useEnableUser();
  const resendInvite = useResendInvite();
  const [inviteLink, setInviteLink] = useState('');
  const deleteUser = useDeleteUser();
  const renameUser = useRenameUser();
  const canManageTeam = hasPermission(user, 'team.manage');
  const visibleProfiles = canManageProfiles ? profiles.data?.items ?? [] : [];

  function assign(userId: string, profileId: string) {
    assignProfile.mutate({ userId, profileId }, {
      onSuccess: () => toast.success('Perfil do usuário atualizado.'),
      onError: () => toast.error('Não foi possível alterar o perfil.'),
    });
  }

  function block(employee: UserListItemResponse) {
    if (!window.confirm(`Bloquear o acesso de ${employee.name}? As sessões abertas serão encerradas.`)) return;
    disableUser.mutate({ id: employee.id }, {
      onSuccess: () => toast.success(`${employee.name} foi bloqueado.`),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível bloquear o funcionário.')),
    });
  }

  function rename(employee: UserListItemResponse, name: string) {
    renameUser.mutate({ id: employee.id, name }, {
      onSuccess: () => toast.success('Nome atualizado.'),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível alterar o nome.')),
    });
  }

  function remove(employee: UserListItemResponse) {
    if (!window.confirm(`Excluir ${employee.name}? O histórico será preservado, mas o acesso será removido.`)) return;
    deleteUser.mutate({ id: employee.id }, {
      onSuccess: () => toast.success(`${employee.name} foi excluído.`),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível excluir o funcionário.')),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Buscar usuário" placeholder="Buscar nome ou e-mail" className="max-w-xs" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
        <select aria-label="Filtrar por situação" className="h-10 rounded-button border border-input bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setOffset(0); }}><option value="all">Todos</option><option value="active">Ativos</option><option value="invited">Convidados</option><option value="disabled">Bloqueados</option></select>
        {canManageTeam && <Button className="ml-auto" onClick={() => setInviteModalOpen(true)}>Convidar usuário</Button>}
      </div>
      {inviteLink && <div className="rounded-card border border-primary/20 bg-primary-subtle p-4 text-sm"><p className="font-semibold">Link do convite renovado</p><p className="mt-1 break-all">{inviteLink}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); toast.success('Link copiado.'); } catch { toast.error('Copie o link manualmente.'); } }}>Copiar link</Button><Button size="sm" variant="ghost" onClick={() => setInviteLink('')}>Fechar</Button></div></div>}

      <UsersTable items={data?.items ?? []} isLoading={isLoading} isError={isError} onRetry={refetch} profiles={visibleProfiles} onAssignProfile={canManageProfiles ? assign : undefined} currentUserId={user?.id} canManage={canManageTeam} canManageAdmins={user?.role === 'ADMIN'} onDisable={block} onEnable={(employee) => enableUser.mutate({ id: employee.id }, { onSuccess: (result) => { if (result.inviteLink) setInviteLink(result.inviteLink); toast.success(result.inviteLink ? (result.emailSent ? `Convite reenviado para ${employee.name}.` : `Convite renovado para ${employee.name}. Copie o link.`) : `${employee.name} foi reativado.`); }, onError: (error) => toast.error(extractErrorMessage(error)) })} onResendInvite={(employee) => resendInvite.mutate({ id: employee.id }, { onSuccess: (result) => { setInviteLink(result.inviteLink); toast.success(result.emailSent ? 'Convite reenviado por e-mail.' : 'Convite renovado. Copie o link para enviar.'); }, onError: (error) => toast.error(extractErrorMessage(error)) })} onDelete={remove} onRename={rename} renaming={renameUser.isPending} />

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{data.total} usuários no total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <InviteUserModal open={inviteModalOpen} onOpenChange={setInviteModalOpen} />
      {canManageProfiles && <div className="mt-4 border-t border-border pt-6"><AccessProfilesPanel /></div>}
    </div>
  );
}

export default function UsersPage() {
  // Restrição de papel específica desta página — o AuthGuard do layout
  // (app/(dashboard)/layout.tsx) só garante "está logado", não papéis.
  // Redireciona pra /customers (não pro default '/usuarios' do AuthGuard,
  // que aqui seria um loop) quando o papel não tem acesso.
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER']} redirectOnForbiddenTo="/clientes">
      <UsersPageContent />
    </AuthGuard>
  );
}
