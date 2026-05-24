export type ConversationStatus = 'active' | 'paused' | 'canceled';

export interface ConversationRecord {
  id: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  canceledAt?: string;
  metadata?: Record<string, unknown>;
}
