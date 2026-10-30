import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from './billing-api';

const REFRESH_KEYS = [['billing'], ['billing-invoices'], ['workshop-subscription'], ['plan']];

export function useBillingStatus() {
  return useQuery({ queryKey: ['billing'], queryFn: billingApi.status });
}

export function useBillingInvoices(enabled = true) {
  return useQuery({ queryKey: ['billing-invoices'], queryFn: billingApi.invoices, enabled });
}

function useRefreshAfter<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => Promise.all(REFRESH_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))) });
}

export const useCheckout = () => useRefreshAfter(billingApi.checkout);
export const usePaymentPortal = () => useMutation({ mutationFn: billingApi.portal });
export const useCancelSubscription = () => useRefreshAfter(billingApi.cancel);
