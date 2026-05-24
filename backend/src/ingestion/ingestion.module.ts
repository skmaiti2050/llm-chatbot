import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { IngestionService } from './ingestion.service';
import { PrismaInferenceLogRepository } from './prisma-inference-log.repository';

@Module({
  imports: [PrismaModule],
  controllers: [IngestionController],
  providers: [IngestionService, PrismaInferenceLogRepository],
  exports: [IngestionService, PrismaInferenceLogRepository],
})
export class IngestionModule {}
