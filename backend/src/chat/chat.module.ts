import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaConversationRepository } from './repositories/prisma-conversation.repository';
import { PrismaMessageRepository } from './repositories/prisma-message.repository';

@Module({
  controllers: [ChatController],
  providers: [ChatService, PrismaConversationRepository, PrismaMessageRepository],
})
export class ChatModule {}
