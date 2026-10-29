import type { PageableRequest } from '../response/pagination.response';
import type { InvitableRole, UserRole, UserStatus } from '../response/user.response';
import type { LegalAcknowledgement } from '../legal';

export interface InviteUserRequest {
  email: string;
  name: string;
  role: InvitableRole;
}

export interface AcceptInviteRequest extends LegalAcknowledgement {
  inviteToken: string;
  password: string;
}

export interface ManageUserAccessRequest {
  id: string;
}

export interface RenameUserRequest {
  id: string;
  name: string;
}

export interface UserListFilters {
  status?: UserStatus;
  role?: UserRole;
}

export interface UserListRequest extends PageableRequest {
  filters?: UserListFilters;
}
