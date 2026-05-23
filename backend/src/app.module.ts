import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionModule } from './ingestion/ingestion.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggingModule } from './logging/logging.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [PrismaModule, IngestionModule, LoggingModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
