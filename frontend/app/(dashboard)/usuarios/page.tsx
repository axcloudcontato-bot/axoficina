'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { InviteUserModal } from '@/features/users/components/InviteUserModal';
import { UsersTable } from '@/features/users/components/UsersTable';
import { useDeleteUser, useDisableUser, useRenameUser, useUsersList } from '@/features/users/hooks/use-users';
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
  const { data, isLoading, isError, refetch } = useUsersList({ offset, limit: PAGE_SIZE });
  const user = useAuthStore((state) => state.user);
  const canManageProfiles = hasPermission(user, 'profiles.manage');
  const profiles = useAccessProfiles(canManageProfiles);
  const assignProfile = useAssignUserProfile();
  const disableUser = useDisableUser();
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
      <div className="flex justify-end">
        <Button onClick={() => setInviteModalOpen(true)}>Convidar usuário</Button>
      </div>

      <UsersTable items={data?.items ?? []} isLoading={isLoading} isError={isError} onRetry={refetch} profiles={visibleProfiles} onAssignProfile={canManageProfiles ? assign : undefined} currentUserId={user?.id} canManage={canManageTeam} onDisable={block} onDelete={remove} onRename={rename} renaming={renameUser.isPending} />

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
