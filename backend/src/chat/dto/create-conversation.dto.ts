import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationResult {
  @ApiProperty({ description: 'ID of the created conversation' })
  conversationId!: string;
}
