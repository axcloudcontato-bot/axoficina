export interface CustomerReplyNotification {
  id: string;
  serviceOrderId: string;
  orderNumber: number;
  customerName: string;
  question: string;
  selectedOption: string;
  channel: 'EMAIL' | 'WHATSAPP';
  answeredAt: string;
  readAt?: string;
}

export interface CustomerReplyNotificationsResponse {
  items: CustomerReplyNotification[];
  unreadCount: number;
  nextCursor?: string;
}
