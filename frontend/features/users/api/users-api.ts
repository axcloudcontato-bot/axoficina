import { apiClient } from '@/lib/api/client';
import type {
  AcceptInviteRequest,
  AuthResponse,
  InviteUserRequest,
  InviteUserResponse,
  PaginationData,
  UserListItemResponse,
  UserListRequest,
  ManageUserAccessRequest,
  RenameUserRequest,
} from '@oficina/contracts';

export const usersApi = {
  async invite(request: InviteUserRequest): Promise<InviteUserResponse> {
    const response = await apiClient.post<InviteUserResponse>('/api/v1/users/invite', request);
    return response.data;
  },

  async acceptInvite(request: AcceptInviteRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/v1/users/accept-invite', request);
    return response.data;
  },

  async list(request: UserListRequest): Promise<PaginationData<UserListItemResponse>> {
    const response = await apiClient.post<PaginationData<UserListItemResponse>>('/api/v1/users/list', request);
    return response.data;
  },

  async rename(request: RenameUserRequest): Promise<{ user: { id: string; name: string } }> {
    return (await apiClient.post('/api/v1/users/rename', request)).data;
  },

  async disable(request: ManageUserAccessRequest): Promise<{ success: true }> {
    return (await apiClient.post('/api/v1/users/disable', request)).data;
  },

  async delete(request: ManageUserAccessRequest): Promise<{ success: true }> {
    return (await apiClient.post('/api/v1/users/delete', request)).data;
  },
};
