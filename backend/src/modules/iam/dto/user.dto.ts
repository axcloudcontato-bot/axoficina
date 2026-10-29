import { Type } from 'class-transformer';
import { Equals, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { INVITABLE_ROLES, LEGAL_VERSION, MIN_PASSWORD_LENGTH, USER_ROLES, USER_STATUSES } from '@oficina/contracts';
import type { AcceptInviteRequest, InviteUserRequest, RenameUserRequest, UserListFilters, UserListRequest } from '@oficina/contracts';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 100;

export class InviteUserDto implements InviteUserRequest {
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;

  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  // ADMIN de propósito fora da lista — ver INVITABLE_ROLES em contracts.
  @IsIn(INVITABLE_ROLES, { message: 'role must be one of MANAGER, MECHANIC, FRONT_DESK' })
  role!: InviteUserRequest['role'];
}

export class AcceptInviteDto implements AcceptInviteRequest {
  @Equals(true, { message: 'Aceite os Termos de uso para continuar.' })
  acceptedTerms!: boolean;

  @Equals(LEGAL_VERSION, { message: 'Leia e aceite a versão atual dos documentos.' })
  legalVersion!: string;

  @IsNotEmpty({ message: 'invite_token is required' })
  inviteToken!: string;

  @MinLength(MIN_PASSWORD_LENGTH, { message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` })
  password!: string;
}

export class ManageUserAccessDto {
  @IsUUID()
  id!: string;
}

export class RenameUserDto implements RenameUserRequest {
  @IsUUID()
  id!: string;

  @IsString() @IsNotEmpty({ message: 'name is required' }) @MaxLength(100)
  name!: string;
}

class UserListFiltersDto implements UserListFilters {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;
  @IsOptional()
  @IsIn(USER_STATUSES, { message: 'status must be one of active, invited, disabled' })
  status?: UserListFilters['status'];

  @IsOptional()
  @IsIn(USER_ROLES, { message: 'role must be one of ADMIN, MANAGER, MECHANIC, FRONT_DESK' })
  role?: UserListFilters['role'];
}

export class UserListDto implements UserListRequest {
  @IsOptional()
  @ValidateNested()
  @Type(() => UserListFiltersDto)
  filters?: UserListFilters;

  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;
}
