import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ConversationRecord } from './dto/conversation-record.dto';
import { CreateConversationResult } from './dto/create-conversation.dto';
import { MessageRecord } from './dto/send-message.dto';
import { SendMessageDto, UpdateConversationStatusDto } from './dto/send-message.dto';

@ApiTags('Conversations')
@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created', type: CreateConversationResult })
  async createConversation(): Promise<CreateConversationResult> {
    const id = await this.chatService.createConversation();
    return { conversationId: id };
  }

  @Get()
  @ApiOperation({ summary: 'List all conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations', type: [ConversationRecord] })
  async listConversations(): Promise<ConversationRecord[]> {
    return this.chatService.listConversations();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation details', type: ConversationRecord })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string): Promise<ConversationRecord> {
    return this.chatService.getConversation(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation status (pause/cancel)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation updated', type: ConversationRecord })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async updateConversationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateConversationStatusDto,
  ): Promise<ConversationRecord> {
    return this.chatService.updateConversationStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a conversation and its messages' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(@Param('id') id: string): Promise<void> {
    await this.chatService.deleteConversation(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'List of messages', type: [MessageRecord] })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async listMessages(@Param('id') id: string): Promise<MessageRecord[]> {
    return this.chatService.listMessages(id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message and get AI reply' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({ status: 201, description: 'Assistant reply', type: MessageRecord })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async sendMessage(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: SendMessageDto,
  ): Promise<MessageRecord> {
    return this.chatService.sendMessage({
      conversationId: id,
      content: dto.content,
    });
  }

  @Post(':id/messages/stream')
  @ApiOperation({ summary: 'Send a message and stream AI reply' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  async sendMessageStream(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const chunk of this.chatService.sendMessageStream({
        conversationId: id,
        content: dto.content,
      })) {
        if (res.destroyed) return;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      if (res.destroyed) return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ text: '', error: message, finishReason: 'stop' })}\n\n`);
    } finally {
      if (!res.destroyed) res.end();
    }
  }
}
