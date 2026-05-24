import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ConversationStatus = 'active' | 'paused' | 'cancelled';

export class ConversationRecord {
  @ApiProperty({ description: 'Conversation UUID' })
  id!: string;

  @ApiProperty({ description: 'Conversation status', enum: ['active', 'paused', 'cancelled'] })
  status!: ConversationStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: string;

  @ApiProperty({ description: 'Cancellation timestamp' })
  cancelledAt?: string;

  @ApiPropertyOptional({ description: 'Arbitrary metadata' })
  metadata?: Record<string, unknown>;
}
