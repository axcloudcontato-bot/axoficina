import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminCloseRequest, AdminPurgeRequest } from '@oficina/contracts';
import { accountClosureApi } from './account-closure-api';

export const useCloseOwnAccount = () => useMutation({ mutationFn: accountClosureApi.closeOwn });

// Whatever the manager does to a workshop changes both lists, the active one and the closed one.
function useRefreshingMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: ['saas-subscriptions'] }) });
}

export const useAdminClose = () => useRefreshingMutation(({ id, input }: { id: string; input: AdminCloseRequest }) => accountClosureApi.adminClose(id, input));
export const useAdminRestore = () => useRefreshingMutation((id: string) => accountClosureApi.adminRestore(id));
export const useAdminPurge = () => useRefreshingMutation(({ id, input }: { id: string; input: AdminPurgeRequest }) => accountClosureApi.adminPurge(id, input));
