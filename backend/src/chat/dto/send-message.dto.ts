import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type MessageRole = 'user' | 'assistant';

export class SendMessageDto {
  @ApiProperty({ description: 'Message text to send', minLength: 1, maxLength: 10000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({ description: 'Conversation UUID (set from URL param)' })
  @IsOptional()
  conversationId!: string;
}

export class UpdateConversationStatusDto {
  @ApiProperty({ description: 'New conversation status', enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsString()
  status!: 'active' | 'paused' | 'cancelled';
}

export class MessageRecord {
  @ApiProperty({ description: 'Message UUID' })
  id!: string;

  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant'] })
  role!: MessageRole;

  @ApiProperty({ description: 'Message content' })
  content!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  createdAt!: string;
}
