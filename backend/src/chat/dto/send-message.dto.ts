export interface SendMessageDto {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface MessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
