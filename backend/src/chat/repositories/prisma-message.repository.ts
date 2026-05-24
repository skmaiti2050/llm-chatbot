import { Injectable } from '@nestjs/common';
import { Message, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageRecord, MessageRole } from '../dto/send-message.dto';

@Injectable()
export class PrismaMessageRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async insert(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<MessageRecord> {
    const data: Prisma.MessageCreateInput = {
      role,
      content,
      conversation: { connect: { id: conversationId } },
    };

    if (metadata) {
      data.metadata = metadata as Prisma.InputJsonValue;
    }

    const record = await this.prismaService.message.create({ data });
    return mapMessage(record);
  }

  async findByConversationId(conversationId: string): Promise<MessageRecord[]> {
    const records = await this.prismaService.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(mapMessage);
  }
}

function mapMessage(record: Message): MessageRecord {
  return {
    id: record.id,
    role: record.role as MessageRole,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
  };
}
