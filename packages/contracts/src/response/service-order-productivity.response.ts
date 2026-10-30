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
  // Efficiency: standard time of the services delivered (catalog) over the time recorded on those same orders.
  // Only orders whose labor all has a standard time count; null when there is none.
  soldMinutes: number;
  efficiencyBaseMinutes: number;
  efficiencyPercent: number | null;
  // Labor per recorded hour, only on orders with recorded time.
  valuePerHourCents: number | null;
  // Time on timers started in the month, against the workshop's open hours so far.
  sessionMinutes: number;
  occupancyPercent: number | null;
  // Orders this technician worked on that came back under warranty in the month.
  reworkCount: number;
  // Time registered as not on an order (waiting for parts, cleaning…) in the month.
  idleMinutes: number;
}

export interface TechnicianProductivityOrder {
  id: string;
  orderNumber: number;
  deliveredAt: string;
  laborCents: number;
  workedMinutes: number;
  estimated: boolean;
  // Standard time of the whole order (catalog), null when some labor has none.
  standardMinutes: number | null;
  // Time recorded on the order by everyone.
  orderWorkedMinutes: number;
}

export interface TechnicianProductivityResponse {
  startAt: string;
  endAt: string;
  items: TechnicianProductivityItem[];
  totals: { completedCount: number; laborRevenueCents: number; workedMinutes: number; unassignedCount: number; estimatedCount: number; soldMinutes?: number; efficiencyBaseMinutes?: number; efficiencyPercent?: number | null; valuePerHourCents?: number | null; sessionMinutes?: number; reworkCount?: number; idleMinutes?: number };
  // Open hours of one technician in the month so far, and the workshop's hourly labor rate.
  availableMinutes?: number;
  laborRateCents?: number | null;
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
  efficiencyPercent?: number | null;
  reworkCount?: number;
  idleMinutes?: number;
  // Timer not on an order running now, if any.
  idle?: { id: string; reason: string; startedAt: string } | null;
}

export interface TechnicianProductivityOrdersResponse {
  items: TechnicianProductivityOrder[];
  total: number;
  offset: number;
  limit: number;
}

export interface ProductivityTrendMonth {
  month: string;
  completedCount: number;
  laborRevenueCents: number;
  workedMinutes: number;
}

export interface ProductivityTrendResponse {
  months: ProductivityTrendMonth[];
}

export interface WarrantyReturnCandidate {
  id: string;
  orderNumber: number;
  deliveredAt: string;
  warrantyDays: number;
  technicianName: string | null;
}

export interface WarrantyReturnResponse {
  current: { originalOrderId: string; orderNumber: number; reason: string | null } | null;
  candidates: WarrantyReturnCandidate[];
}

export interface TechnicianCommission {
  technicianId: string;
  technicianName: string;
  laborRevenueCents: number;
  laborPercentBp: number | null;
  bonusPercentBp: number;
  targetReached: boolean;
  commissionCents: number;
  reworkCount: number;
}

export interface CommissionsResponse {
  month: string;
  items: TechnicianCommission[];
  totalCents: number;
}

export interface IdleSessionResponse {
  id: string;
  reason: string;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
}

export interface MyIdleResponse {
  open: IdleSessionResponse | null;
  today: IdleSessionResponse[];
}
