import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { SendMessageDto, MessageRecord } from './dto/send-message.dto';

type Conversation = {
  id: string;
  status: 'active' | 'paused' | 'canceled';
  messages: MessageRecord[];
};

type ModelCallResult = Awaited<ReturnType<LoggingService['callModelAndLog']>>;

@Injectable()
export class ChatService {
  private conversations = new Map<string, Conversation>();

  constructor(private readonly loggingService: LoggingService) {}

  private createId(): string {
    return randomUUID();
  }

  private createMessage(role: MessageRecord['role'], content: string): MessageRecord {
    return {
      id: this.createId(),
      role,
      content,
      createdAt: new Date().toISOString(),
    };
  }

  createConversation(): string {
    const id = this.createId();
    this.conversations.set(id, {
      id,
      status: 'active',
      messages: [],
    });
    return id;
  }

  listMessages(conversationId: string): MessageRecord[] {
    const conv = this.conversations.get(conversationId);
    if (!conv) throw new NotFoundException('conversation not found');
    return [...conv.messages];
  }

  async sendMessage(payload: SendMessageDto): Promise<MessageRecord> {
    const conv = this.conversations.get(payload.conversationId);
    if (!conv) throw new NotFoundException('conversation not found');

    const content = payload.content.trim();
    if (content.length === 0) {
      throw new BadRequestException('content is required');
    }

    const userMsg = this.createMessage('user', payload.content);
    conv.messages.push(userMsg);

    const result: ModelCallResult = await this.loggingService.callModelAndLog({
      sessionId: payload.conversationId,
      requestId: this.createId(),
      provider: process.env.LLM_PROVIDER ?? 'local-sim',
      model: process.env.LLM_MODEL ?? 'sim-model',
      inputPreview: payload.content,
    });

    const assistantMsg = this.createMessage('assistant', result.text ?? 'no response');
    conv.messages.push(assistantMsg);

    return assistantMsg;
  }
}
