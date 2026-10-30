'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AcceptInviteRequest, InviteUserRequest, ManageUserAccessRequest, RenameUserRequest, UserListRequest } from '@oficina/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { usersApi } from '../api/users-api';

const USERS_LIST_KEY = 'users-list';

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: InviteUserRequest) => usersApi.invite(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_LIST_KEY] });
    },
  });
}

export function useAcceptInvite() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (request: AcceptInviteRequest) => usersApi.acceptInvite(request),
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    },
  });
}

export function useUsersList(request: UserListRequest) {
  return useQuery({
    queryKey: [USERS_LIST_KEY, request],
    queryFn: () => usersApi.list(request),
    placeholderData: (previousData) => previousData,
  });
}

function useUserAccessMutation(action: 'disable' | 'delete') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ManageUserAccessRequest) => usersApi[action](request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_LIST_KEY] }),
  });
}

export function useRenameUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: RenameUserRequest) => usersApi.rename(request),
    onSuccess: ({ user: renamed }) => {
      queryClient.invalidateQueries({ queryKey: [USERS_LIST_KEY] });
      // Se o administrador renomeou a si mesmo, o nome no cabeçalho acompanha.
      const { user, accessToken, refreshToken, setSession } = useAuthStore.getState();
      if (user?.id === renamed.id && accessToken && refreshToken) setSession({ accessToken, refreshToken, user: { ...user, name: renamed.name } });
    },
  });
}
export function useDisableUser() { return useUserAccessMutation('disable'); }
export function useEnableUser() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: usersApi.enable, onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_LIST_KEY] }) });
}
export function useDeleteUser() { return useUserAccessMutation('delete'); }
export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: usersApi.resendInvite, onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_LIST_KEY] }) });
}

export function usePasswordResetLink() {
  return useMutation({ mutationFn: usersApi.passwordResetLink });
}
