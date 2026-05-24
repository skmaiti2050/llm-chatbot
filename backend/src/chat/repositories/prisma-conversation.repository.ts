import { Injectable } from '@nestjs/common';
import { Conversation, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationRecord, ConversationStatus } from '../dto/conversation-record.dto';

@Injectable()
export class PrismaConversationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async insert(): Promise<ConversationRecord> {
    const record = await this.prismaService.conversation.create({ data: {} });
    return mapConversation(record);
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const record = await this.prismaService.conversation.findUnique({
      where: { id },
    });
    return record ? mapConversation(record) : null;
  }

  async findAll(): Promise<ConversationRecord[]> {
    const records = await this.prismaService.conversation.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map(mapConversation);
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<ConversationRecord | null> {
    const data: Prisma.ConversationUpdateInput = { status };

    if (status === 'canceled') {
      data.canceledAt = new Date();
    }

    try {
      const record = await this.prismaService.conversation.update({
        where: { id },
        data,
      });
      return mapConversation(record);
    } catch {
      return null;
    }
  }
}

function mapConversation(record: Conversation): ConversationRecord {
  return {
    id: record.id,
    status: record.status as ConversationStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    canceledAt: record.canceledAt?.toISOString() ?? undefined,
    metadata: (record.metadata as Record<string, unknown> | undefined) ?? undefined,
  };
}
