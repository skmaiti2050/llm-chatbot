import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoggingService, CallModelResult } from '../logging/logging.service';
import { SendMessageDto, MessageRecord } from './dto/send-message.dto';
import { ConversationRecord, ConversationStatus } from './dto/conversation-record.dto';
import { PrismaConversationRepository } from './repositories/prisma-conversation.repository';
import { PrismaMessageRepository } from './repositories/prisma-message.repository';
import type { LlmMessage, LlmStreamChunk } from '../llm/llm.interface';

@Injectable()
export class ChatService {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly conversationRepository: PrismaConversationRepository,
    private readonly messageRepository: PrismaMessageRepository,
  ) {}

  async createConversation(): Promise<string> {
    const record = await this.conversationRepository.insert();
    return record.id;
  }

  async listConversations(): Promise<ConversationRecord[]> {
    return this.conversationRepository.findAll();
  }

  async getConversation(id: string): Promise<ConversationRecord> {
    const record = await this.conversationRepository.findById(id);
    if (!record) throw new NotFoundException('conversation not found');
    return record;
  }

  async updateConversationStatus(id: string, status: ConversationStatus): Promise<ConversationRecord> {
    const record = await this.conversationRepository.updateStatus(id, status);
    if (!record) throw new NotFoundException('conversation not found');
    return record;
  }

  async deleteConversation(id: string): Promise<void> {
    const record = await this.conversationRepository.findById(id);
    if (!record) throw new NotFoundException('conversation not found');
    await this.conversationRepository.delete(id);
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const conv = await this.conversationRepository.findById(conversationId);
    if (!conv) throw new NotFoundException('conversation not found');
    return this.messageRepository.findByConversationId(conversationId);
  }

  async sendMessage(payload: SendMessageDto): Promise<MessageRecord> {
    const conv = await this.conversationRepository.findById(payload.conversationId);
    if (!conv) throw new NotFoundException('conversation not found');

    const content = payload.content.trim();
    if (content.length === 0) {
      throw new BadRequestException('content is required');
    }

    await this.messageRepository.insert(payload.conversationId, 'user', payload.content);

    const convAfter = await this.conversationRepository.findById(payload.conversationId);
    if (convAfter && convAfter.status === 'cancelled') {
      throw new BadRequestException('conversation was cancelled');
    }

    const history = await this.messageRepository.findByConversationId(payload.conversationId);
    const contextSize = Number(process.env.CONTEXT_WINDOW_SIZE) || 20;
    const recent = history.slice(-contextSize);
    const maxTokens = Number(process.env.LLM_MAX_TOKENS) || 8192;

    const systemPrompt = process.env.SYSTEM_PROMPT;
    const messages: LlmMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push(...recent.map((msg) => ({
      role: msg.role as LlmMessage['role'],
      content: msg.content,
    })));

    const provider = process.env.LLM_PROVIDER || 'openai-compatible';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const messageId = randomUUID();

    const result: CallModelResult = await this.loggingService.callModelAndLog({
      sessionId: payload.conversationId,
      requestId: randomUUID(),
      messageId,
      provider,
      model,
      messages,
      maxTokens,
    });

    const convFinal = await this.conversationRepository.findById(payload.conversationId);
    if (convFinal && convFinal.status === 'cancelled') {
      throw new BadRequestException('conversation was cancelled during LLM call');
    }

    return this.messageRepository.insert(
      payload.conversationId,
      'assistant',
      result.text,
      undefined,
      messageId,
    );
  }

  async *sendMessageStream(
    payload: SendMessageDto,
  ): AsyncIterable<LlmStreamChunk> {
    const conv = await this.conversationRepository.findById(payload.conversationId);
    if (!conv) throw new NotFoundException('conversation not found');

    const content = payload.content.trim();
    if (content.length === 0) {
      throw new BadRequestException('content is required');
    }

    await this.messageRepository.insert(payload.conversationId, 'user', payload.content);

    const convAfter = await this.conversationRepository.findById(payload.conversationId);
    if (convAfter && convAfter.status === 'cancelled') {
      throw new BadRequestException('conversation was cancelled');
    }

    const history = await this.messageRepository.findByConversationId(payload.conversationId);
    const contextSize = Number(process.env.CONTEXT_WINDOW_SIZE) || 20;
    const recent = history.slice(-contextSize);
    const maxTokens = Number(process.env.LLM_MAX_TOKENS) || 8192;

    const systemPrompt = process.env.SYSTEM_PROMPT;
    const messages: LlmMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push(...recent.map((msg) => ({
      role: msg.role as LlmMessage['role'],
      content: msg.content,
    })));

    const provider = process.env.LLM_PROVIDER || 'openai-compatible';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const messageId = randomUUID();
    let fullText = '';

    try {
      for await (const chunk of this.loggingService.callModelAndLogStreaming({
        sessionId: payload.conversationId,
        requestId: randomUUID(),
        messageId,
        provider,
        model,
        messages,
        maxTokens,
      })) {
        if (chunk.finishReason) {
          const convFinal = await this.conversationRepository.findById(payload.conversationId);
          if (convFinal && convFinal.status === 'cancelled') {
            yield chunk;
            return;
          }
          yield chunk;
        } else {
          fullText += chunk.text;
          yield chunk;
        }
      }
    } finally {
      if (fullText) {
        await this.messageRepository.insert(
          payload.conversationId,
          'assistant',
          fullText,
          undefined,
          messageId,
        ).catch(() => {});
      }
    }
  }
}
