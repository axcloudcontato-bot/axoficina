export interface VehicleResponse {
  id: string;
  tenantId: string;
  customerId: string;
  // Denormalizado pelo Manager pra evitar que a UI precise resolver o nome
  // do dono a partir do id em toda tela que lista veículos (ver
  // VehicleManager.toResponse).
  customerName: string;
  brand: string;
  model: string;
  year?: number;
  engine?: string;
  fuelType?: string;
  plate: string;
  chassis?: string;
  mileage?: number;
  color?: string;
  photos: string[];
  createdAt: string;
  // Set only for archived vehicles.
  archivedAt?: string;
}

// Shown beside each vehicle in the list when asked for.
export interface VehicleListStats { orderCount: number; lastVisitAt?: string }
export type VehicleListItemResponse = VehicleResponse & { stats?: VehicleListStats };

// What archiving a vehicle would leave hanging, so the person decides knowing it.
export interface VehicleArchiveImpactResponse {
  openServiceOrders: number;
  upcomingAppointments: number;
}

export interface VehicleOverviewResponse {
  // Orders that were not cancelled; "delivered" are the ones the car left the workshop after.
  orderCount: number;
  deliveredCount: number;
  lastVisitAt?: string;
  openServiceOrders: Array<{ id: string; orderNumber: number; status: string }>;
  upcomingAppointments: Array<{ id: string; startsAt: string; status: string; serviceDescription: string }>;
  // The next care the car is due for, from what was last done on it.
  care: Array<{ serviceKey: string; serviceName: string; completedAt: string; dueAt: string; dueMileage?: number; overdue: boolean }>;
  // Odometer readings the orders recorded, oldest first.
  mileageHistory: Array<{ at: string; mileage: number; orderNumber: number }>;
}

export interface ImportVehiclesProblem { line: number; plate: string; reason: string }
export interface ImportVehiclesResponse {
  created: number;
  // Rows that were not imported, with the reason (invalid data, owner not found, plate already registered).
  problems: ImportVehiclesProblem[];
}
