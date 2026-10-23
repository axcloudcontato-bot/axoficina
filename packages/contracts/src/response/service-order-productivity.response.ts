export interface TechnicianProductivityItem {
  technicianId: string;
  technicianName: string;
  // OS entregues (status DELIVERED) com closedAt dentro do período pedido.
  completedCount: number;
  // Soma do valor de itens tipo LABOR das OS contadas em completedCount.
  laborRevenueCents: number;
  // Média de openedAt -> closedAt, em horas, só das OS contadas acima.
  // null quando o técnico não entregou nenhuma OS no período.
  avgCompletionHours: number | null;
  // OS atualmente abertas/em andamento com este técnico — não depende do
  // período selecionado, é sempre o estado agora.
  activeOrders: number;
}

export interface TechnicianProductivityResponse {
  startAt: string;
  endAt: string;
  items: TechnicianProductivityItem[];
}
