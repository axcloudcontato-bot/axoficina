export const USER_ROLES = ['ADMIN', 'MANAGER', 'MECHANIC', 'FRONT_DESK'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ADMIN de propósito fora daqui: contas admin só nascem via signup
// self-service. Deixar ADMIN convidável permitiria um MANAGER (que também
// pode chamar /users/invite) promover alguém a ADMIN — escalação de
// privilégio. Ver UserManager.invite.
export const INVITABLE_ROLES = ['MANAGER', 'MECHANIC', 'FRONT_DESK'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const USER_STATUSES = ['active', 'invited', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserResponse {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  profileId?: string;
  profileName?: string;
  permissions?: import('./access-profile.response').PermissionKey[];
  status: UserStatus;
  createdAt: string;
}

export type UserListItemResponse = UserResponse & { lastLoginAt?: string | null };

export interface InviteUserResponse {
  user: UserResponse;
  /** Sempre presente como fallback manual, mesmo quando emailSent é true. */
  inviteLink: string;
  /** true se o convite foi enviado por e-mail (SMTP do tenant configurado e ativo). */
  emailSent: boolean;
}
