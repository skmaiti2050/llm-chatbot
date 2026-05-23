export type MessageRole = 'user' | 'assistant';

export interface SendMessageDto {
  conversationId: string;
  content: string;
}

export interface MessageRecord {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}
