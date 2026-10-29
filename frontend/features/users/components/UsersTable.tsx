'use client';

import { useState } from 'react';
import type { AccessProfileResponse, UserListItemResponse } from '@oficina/contracts';
import { Check, PencilSimple, X } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Gestor',
  MECHANIC: 'Mecânico',
  FRONT_DESK: 'Recepção',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'border-success/30 bg-success/10 text-success',
  invited: 'border-warning/30 bg-warning/10 text-warning',
  disabled: 'border-danger/30 bg-danger/10 text-danger',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  invited: 'Convidado',
  disabled: 'Desabilitado',
};

interface UsersTableProps {
  items: UserListItemResponse[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  profiles?: AccessProfileResponse[];
  onAssignProfile?: (userId: string, profileId: string) => void;
  currentUserId?: string;
  canManage?: boolean;
  canManageAdmins?: boolean;
  onDisable?: (user: UserListItemResponse) => void;
  onEnable?: (user: UserListItemResponse) => void;
  onResendInvite?: (user: UserListItemResponse) => void;
  onDelete?: (user: UserListItemResponse) => void;
  onRename?: (user: UserListItemResponse, name: string) => void;
  renaming?: boolean;
}

export function UsersTable({ items, isLoading, isError, onRetry, profiles = [], onAssignProfile, currentUserId, canManage, canManageAdmins = false, onDisable, onEnable, onResendInvite, onDelete, onRename, renaming }: UsersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  function startRename(user: UserListItemResponse) { setEditingId(user.id); setDraftName(user.name); }
  function saveRename(user: UserListItemResponse) {
    const name = draftName.trim();
    if (name && name !== user.name) onRename?.(user, name);
    setEditingId(null);
  }
  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando usuários" className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-sm text-danger">Não foi possível carregar os usuários.</p>
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">
        Nenhum usuário ainda. Convide o primeiro clicando em &quot;Convidar usuário&quot;.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Papel</TableHead>
            {profiles.length > 0 && <TableHead>Perfil de acesso</TableHead>}
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="min-w-56 font-medium text-text">
                {editingId === user.id ? (
                  <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); saveRename(user); }}>
                    <Input autoFocus aria-label={`Nome de ${user.name}`} value={draftName} maxLength={100} disabled={renaming} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditingId(null); }} className="h-9" />
                    <Button type="submit" variant="ghost" size="icon" disabled={renaming || !draftName.trim()} aria-label="Salvar nome"><Check className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={renaming} onClick={() => setEditingId(null)} aria-label="Cancelar"><X className="size-4" /></Button>
                  </form>
                ) : (
                  <span className="flex items-center gap-1">
                    {user.name}
                    {canManage && (user.role !== 'ADMIN' || canManageAdmins) && onRename && <Button type="button" variant="ghost" size="icon" className="size-7 text-text-muted" onClick={() => startRename(user)} aria-label={`Editar nome de ${user.name}`}><PencilSimple className="size-3.5" /></Button>}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-text-muted">{user.email}</TableCell>
              <TableCell>{ROLE_LABELS[user.role] ?? user.role}</TableCell>
              {profiles.length > 0 && <TableCell className="min-w-52">
                <Select value={user.profileId} onValueChange={(profileId) => onAssignProfile?.(user.id, profileId)}>
                  <SelectTrigger aria-label={`Perfil de ${user.name}`}><SelectValue placeholder="Selecionar perfil" /></SelectTrigger>
                  <SelectContent>{profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>}
              <TableCell>
                <Badge variant="outline" className={STATUS_STYLES[user.status]}>
                  {STATUS_LABELS[user.status] ?? user.status}
                </Badge>
              </TableCell>
              {canManage && <TableCell className="text-right">
                {user.id !== currentUserId && (user.role !== 'ADMIN' || canManageAdmins) && <div className="flex justify-end gap-2">
                  {user.status !== 'disabled' && <Button variant="outline" size="sm" onClick={() => onDisable?.(user)}>Bloquear</Button>}
                  {user.status === 'disabled' && <Button variant="outline" size="sm" onClick={() => onEnable?.(user)}>Reativar</Button>}
                  {user.status === 'invited' && <Button variant="outline" size="sm" onClick={() => onResendInvite?.(user)}>Reenviar convite</Button>}
                  <Button variant="outline" size="sm" className="border-danger/30 text-danger hover:bg-danger/10" onClick={() => onDelete?.(user)}>Excluir</Button>
                </div>}
              </TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
