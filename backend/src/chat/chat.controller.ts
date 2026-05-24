import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { ConversationRecord, ConversationStatus } from './dto/conversation-record.dto';
import type { CreateConversationResult } from './dto/create-conversation.dto';
import type { MessageRecord } from './dto/send-message.dto';

@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async createConversation(): Promise<CreateConversationResult> {
    const id = await this.chatService.createConversation();
    return { conversationId: id };
  }

  @Get()
  async listConversations(): Promise<ConversationRecord[]> {
    return this.chatService.listConversations();
  }

  @Get(':id')
  async getConversation(@Param('id') id: string): Promise<ConversationRecord> {
    return this.chatService.getConversation(id);
  }

  @Patch(':id')
  async updateConversationStatus(
    @Param('id') id: string,
    @Body('status') status: ConversationStatus,
  ): Promise<ConversationRecord> {
    return this.chatService.updateConversationStatus(id, status);
  }

  @Get(':id/messages')
  async listMessages(@Param('id') id: string): Promise<MessageRecord[]> {
    return this.chatService.listMessages(id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body('content') content: string,
  ): Promise<MessageRecord> {
    return this.chatService.sendMessage({
      conversationId: id,
      content,
    });
  }
}
