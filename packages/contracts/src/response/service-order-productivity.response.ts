export interface TechnicianProductivityItem {
  technicianId: string;
  technicianName: string;
  // OS entregues (status DELIVERED) com closedAt dentro do período pedido.
  completedCount: number;
  // Mão de obra líquida da OS, rateada por tempo registrado quando houver.
  laborRevenueCents: number;
  // OS em execução, aguardando peças ou prontas para entrega, agora.
  activeOrders: number;
  workedMinutes: number;
  estimatedCount: number;
  target: { completedCount: number; laborRevenueCents: number; workedMinutes: number } | null;
}

export interface TechnicianProductivityOrder {
  id: string;
  orderNumber: number;
  deliveredAt: string;
  laborCents: number;
  workedMinutes: number;
  estimated: boolean;
}

export interface TechnicianProductivityResponse {
  startAt: string;
  endAt: string;
  items: TechnicianProductivityItem[];
  totals: { completedCount: number; laborRevenueCents: number; workedMinutes: number; unassignedCount: number; estimatedCount: number };
}

export interface TechnicianProductivityOrdersResponse {
  items: TechnicianProductivityOrder[];
  total: number;
  offset: number;
  limit: number;
}
