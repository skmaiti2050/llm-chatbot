import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { CreateConversationResult } from './dto/create-conversation.dto';
import type { SendMessageDto, MessageRecord } from './dto/send-message.dto';

@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  createConversation(): CreateConversationResult {
    const id = this.chatService.createConversation();
    return { conversationId: id };
  }

  @Get(':id/messages')
  listMessages(@Param('id') id: string): MessageRecord[] {
    return this.chatService.listMessages(id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body('content') content: string,
  ): Promise<MessageRecord> {
    return this.chatService.sendMessage({
      conversationId: id,
      role: 'user',
      content,
    });
  }
}
