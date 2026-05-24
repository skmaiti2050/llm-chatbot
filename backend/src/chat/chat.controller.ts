import { Body, Controller, Get, Param, Patch, Post, ValidationPipe } from '@nestjs/common';
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
    return this.chatService.updateConversationStatus(id, dto.status as any);
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
}
