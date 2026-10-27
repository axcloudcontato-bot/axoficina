import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CUSTOMER_CONTACT_CHANNELS, CUSTOMER_CONTACT_TIMES, CUSTOMER_TYPES } from '@oficina/contracts';
import type {
  CreateCustomerRequest,
  CustomerAddress,
  CustomerContactChannel,
  CustomerContactTime,
  CustomerListRequest,
  DeleteCustomerRequest,
  UpdateCustomerRequest,
} from '@oficina/contracts';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 100;

class CustomerAddressDto implements CustomerAddress {
  @IsOptional() @IsString() @MaxLength(200)
  street?: string;
  @IsOptional() @IsString() @MaxLength(200)
  number?: string;
  @IsOptional() @IsString() @MaxLength(200)
  complement?: string;
  @IsOptional() @IsString() @MaxLength(200)
  neighborhood?: string;
  @IsOptional() @IsString() @MaxLength(200)
  city?: string;
  @IsOptional() @IsString() @MaxLength(200)
  state?: string;
  @IsOptional() @IsString() @MaxLength(200)
  zipCode?: string;
}

export class CreateCustomerDto implements CreateCustomerRequest {
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  careMessagesEnabled?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  notifyServiceOrderUpdates?: boolean;
  @IsIn(CUSTOMER_TYPES, { message: 'type must be one of PF, PJ' })
  type!: CreateCustomerRequest['type'];

  @IsOptional() @IsString() @MaxLength(24)
  document?: string;

  @IsString() @MaxLength(200)
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsString() @MaxLength(30)
  @IsNotEmpty({ message: 'phone is required' })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;

  @IsOptional()
  @IsObject() @ValidateNested() @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto;

  @IsOptional()
  @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString() @MaxLength(2000)
  rg?: string;

  @IsOptional()
  @IsString() @MaxLength(2000)
  stateRegistration?: string;

  @IsOptional()
  @IsString() @MaxLength(2000)
  secondaryContactName?: string;

  @IsOptional()
  @IsString() @MaxLength(2000)
  secondaryContactPhone?: string;

  @IsOptional()
  @IsString() @MaxLength(2000)
  secondaryContactRelation?: string;

  @IsOptional()
  @IsIn(CUSTOMER_CONTACT_CHANNELS, { message: 'preferred_contact_channel must be one of PHONE, WHATSAPP, EMAIL, SMS' })
  preferredContactChannel?: CustomerContactChannel;

  @IsOptional()
  @IsIn(CUSTOMER_CONTACT_TIMES, { message: 'preferred_contact_time must be one of MORNING, AFTERNOON, EVENING, ANY' })
  preferredContactTime?: CustomerContactTime;
}

export class UpdateCustomerDto implements UpdateCustomerRequest {
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string | null;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  careMessagesEnabled?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  notifyServiceOrderUpdates?: boolean;
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(24)
  document?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString() @MaxLength(200)
  @IsNotEmpty({ message: 'name cannot be empty' })
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString() @MaxLength(200)
  @IsNotEmpty({ message: 'phone cannot be empty' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string | null;

  @IsOptional()
  @IsObject() @ValidateNested() @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto | null;

  @IsOptional()
  @IsString() @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString() @MaxLength(2000)
  rg?: string | null;

  @IsOptional()
  @IsString() @MaxLength(2000)
  stateRegistration?: string | null;

  @IsOptional()
  @IsString() @MaxLength(2000)
  secondaryContactName?: string | null;

  @IsOptional()
  @IsString() @MaxLength(2000)
  secondaryContactPhone?: string | null;

  @IsOptional()
  @IsString() @MaxLength(2000)
  secondaryContactRelation?: string | null;

  @IsOptional()
  @IsIn(CUSTOMER_CONTACT_CHANNELS, { message: 'preferred_contact_channel must be one of PHONE, WHATSAPP, EMAIL, SMS' })
  preferredContactChannel?: CustomerContactChannel | null;

  @IsOptional()
  @IsIn(CUSTOMER_CONTACT_TIMES, { message: 'preferred_contact_time must be one of MORNING, AFTERNOON, EVENING, ANY' })
  preferredContactTime?: CustomerContactTime | null;
}

export class DeleteCustomerDto implements DeleteCustomerRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class GetCustomerDto {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class CustomerListDto implements CustomerListRequest {
  @IsOptional()
  @IsString() @MaxLength(2000)
  search?: string;

  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;
}
