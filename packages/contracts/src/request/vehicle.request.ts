import type { PageableRequest } from '../response/pagination.response';

export interface CreateVehicleRequest {
  customerId: string;
  brand: string;
  model: string;
  plate: string;
  year?: number;
  engine?: string;
  fuelType?: string;
  chassis?: string;
  mileage?: number;
  color?: string;
  photos?: string[];
}

export interface UpdateVehicleRequest {
  id: string;
  brand?: string;
  model?: string;
  year?: number;
  engine?: string;
  fuelType?: string;
  plate?: string;
  chassis?: string;
  mileage?: number;
  // Needed to lower the mileage of a vehicle: a typo with one digit less looks exactly like this.
  confirmMileageDecrease?: boolean;
  color?: string;
  photos?: string[];
}

export interface DeleteVehicleRequest {
  id: string;
}

export interface VehicleListRequest extends PageableRequest {
  search?: string;
  customerId?: string;
  // Além de marca/modelo/placa, também casa `search` contra o nome/documento
  // do cliente dono do veículo. Opt-in explícito (default false) — só o
  // VehicleSearchCombobox (abertura de OS) liga isso; a tela de Veículos
  // mantém o comportamento de busca original.
  matchOwner?: boolean;
  // The archived vehicles instead of the active ones.
  archived?: boolean;
  // Adds the number of orders and the last visit to each vehicle (costs a little more, so it is opt-in).
  withStats?: boolean;
  // INACTIVE: no delivered order in the last 6 months (or ever). IN_SERVICE: has an order in progress.
  filter?: 'INACTIVE' | 'IN_SERVICE';
  // recent = newest registration first. The others sort by that column; empty values always go last.
  sort?: 'recent' | 'plate' | 'year' | 'mileage';
  direction?: 'asc' | 'desc';
}

export interface VehicleOverviewRequest {
  id: string;
}

// The new owner. Past orders keep the owner of their time.
export interface TransferVehicleRequest {
  id: string;
  customerId: string;
}

export interface RestoreVehicleRequest {
  id: string;
}

export interface VehicleArchiveImpactRequest {
  id: string;
}

export interface ImportVehicleRow {
  // Line in the spreadsheet, so a problem can point at it.
  line: number;
  plate: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  fuelType?: string;
  chassis?: string;
  mileage?: number;
  // The owner is found by document first, then by phone (and name, if the phone is shared).
  ownerDocument?: string;
  ownerPhone?: string;
  ownerName?: string;
}
export interface ImportVehiclesRequest { rows: ImportVehicleRow[] }
