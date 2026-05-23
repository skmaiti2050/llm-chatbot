import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { SendMessageDto, MessageRecord } from './dto/send-message.dto';

type Conversation = {
  id: string;
  status: 'active' | 'paused' | 'canceled';
  messages: MessageRecord[];
};

@Injectable()
export class ChatService {
  private conversations = new Map<string, Conversation>();

  constructor(private readonly loggingService: LoggingService) {}

  createConversation(): string {
    const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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
    return conv.messages;
  }

  async sendMessage(payload: SendMessageDto): Promise<MessageRecord> {
    const conv = this.conversations.get(payload.conversationId);
    if (!conv) throw new NotFoundException('conversation not found');

    const userMsg: MessageRecord = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      role: 'user',
      content: payload.content,
      createdAt: new Date().toISOString(),
    };

    conv.messages.push(userMsg);

    const result = await this.loggingService.callModelAndLog({
      sessionId: payload.conversationId,
      requestId: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      provider: process.env.LLM_PROVIDER ?? 'local-sim',
      model: process.env.LLM_MODEL ?? 'sim-model',
      inputPreview: payload.content,
    });

    const assistantMsg: MessageRecord = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      role: 'assistant',
      content: (result && (result as any).text) ?? 'no response',
      createdAt: new Date().toISOString(),
    };

    conv.messages.push(assistantMsg);

    return assistantMsg;
  }
}
