import axios from 'axios';
import type { CreateCustomerMessageRequest, CreatedCustomerMessageResponse, CustomerMessageResponse, PublicCustomerMessageResponse } from '@oficina/contracts';
import { keysToCamel } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

// Public responses must work without a workshop account or session refresh.
const publicClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });

export const customerMessagesApi = {
  async create(input: CreateCustomerMessageRequest) {
    return (await apiClient.post<CreatedCustomerMessageResponse>('/api/v1/service-orders/customer-messages', input)).data;
  },
  async list(serviceOrderId: string) {
    return (await apiClient.get<{ messages: CustomerMessageResponse[] }>('/api/v1/service-orders/customer-messages', { params: { serviceOrderId } })).data;
  },
  async getPublic(token: string): Promise<PublicCustomerMessageResponse> {
    return keysToCamel((await publicClient.get('/api/v1/public/customer-message', { params: { token } })).data) as PublicCustomerMessageResponse;
  },
  async answer(token: string, selectedOption: number): Promise<PublicCustomerMessageResponse> {
    return keysToCamel((await publicClient.post('/api/v1/public/customer-message/answer', { token, selected_option: selectedOption })).data) as PublicCustomerMessageResponse;
  },
};
