import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ConversationStatus = 'active' | 'paused' | 'canceled';

export class ConversationRecord {
  @ApiProperty({ description: 'Conversation UUID' })
  id!: string;

  @ApiProperty({ description: 'Conversation status', enum: ['active', 'paused', 'canceled'] })
  status!: ConversationStatus;

  @ApiProperty({ description: 'ISO 8601 creation timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last update timestamp' })
  updatedAt!: string;

  @ApiPropertyOptional({ description: 'ISO 8601 cancellation timestamp' })
  canceledAt?: string;

  @ApiPropertyOptional({ description: 'Arbitrary metadata' })
  metadata?: Record<string, unknown>;
}
