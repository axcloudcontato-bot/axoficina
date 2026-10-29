export interface DashboardMonthlyRevenueResponse {
  month: string;
  revenueCents: number;
}

export interface DashboardTechnicianWorkloadResponse {
  technicianId?: string;
  technicianName: string;
  activeOrders: number;
}

export interface DashboardFinancialPipelineItemResponse {
  id: string;
  orderNumber: number;
  status: 'OPEN' | 'AWAITING_APPROVAL' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'DELIVERED';
  customerName: string;
  vehicleLabel: string;
  vehiclePlate: string;
  amountCents: number;
  expectedDeliveryAt?: string;
}

export interface DashboardTopServiceResponse {
  description: string;
  count: number;
  revenueCents: number;
}

export interface DashboardBusinessSummaryResponse {
  monthRevenueCents: number;
  previousMonthRevenueCents: number;
  activePipelineCents: number;
  accountsReceivableCents: number;
  averageTicketCents: number;
  overdueDeliveries: number;
  deliveredThisMonth: number;
  receiptsThisMonth: number;
  partsRevenueCents: number;
  laborRevenueCents: number;
  openOrders: number;
  completedAwaitingDeliveryCents: number;
  inProgressCents: number;
  monthlyRevenue: DashboardMonthlyRevenueResponse[];
  technicianWorkload: DashboardTechnicianWorkloadResponse[];
  financialPipeline: DashboardFinancialPipelineItemResponse[];
  topServices: DashboardTopServiceResponse[];
}

import type { ServiceOrderListItemResponse } from './service-order.response';

export interface DashboardTodayMetricsResponse {
  active: number;
  overdue: number;
  waitingParts: number;
  awaitingApproval: number;
  ready: number;
  unassigned: number;
  dueToday: number;
}

export interface DashboardTodayWorkloadResponse {
  technicianId?: string;
  technicianName: string;
  notStarted: number;
  inProgress: number;
  waitingParts: number;
}

// Orders parked on someone else: the customer (approval) or the pickup.
export interface DashboardWaitingResponse {
  count: number;
  stale: number;
  oldestDays: number;
  // Only present for users allowed to see prices.
  amountCents?: number;
}

// Operational snapshot behind the dashboard: counts are exact (computed in the
// database), lists are short and already prioritized.
export interface DashboardTodayResponse {
  metrics: DashboardTodayMetricsResponse;
  attention: { total: number; items: ServiceOrderListItemResponse[] };
  workload: DashboardTodayWorkloadResponse[];
  waiting: { approvals: DashboardWaitingResponse; ready: DashboardWaitingResponse };
  mine: { total: number; items: ServiceOrderListItemResponse[] };
}
