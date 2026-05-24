import { IsString, MinLength, MaxLength } from 'class-validator';

export type MessageRole = 'user' | 'assistant';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  conversationId!: string;
}

export class UpdateConversationStatusDto {
  @IsString()
  status!: 'active' | 'paused' | 'canceled';
}

export interface MessageRecord {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}
