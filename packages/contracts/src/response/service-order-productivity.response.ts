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
  // Timers running right now, whatever the month: a forgotten one shows up here.
  openSessions?: OpenWorkSession[];
}

export interface OpenWorkSession {
  id: string;
  technicianId: string;
  technicianName: string;
  serviceOrderId: string;
  orderNumber: number;
  startedAt: string;
  // Minutes that count, stopping at the workshop's closing hour.
  workedMinutes: number;
  // The timer went past closing time: probably forgotten.
  capped: boolean;
}

// What a technician sees about their own month. Money only for people who may see prices.
export interface MyProductivityResponse {
  completedCount: number;
  workedMinutes: number;
  activeOrders: number;
  estimatedCount: number;
  laborRevenueCents?: number;
  target: { completedCount: number; workedMinutes: number; laborRevenueCents?: number } | null;
}

export interface TechnicianProductivityOrdersResponse {
  items: TechnicianProductivityOrder[];
  total: number;
  offset: number;
  limit: number;
}
