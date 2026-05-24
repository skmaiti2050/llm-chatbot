import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInferenceLogDto, normalizeInferenceLogInput } from '../ingestion/inference-log.dto';

@Injectable()
@Processor('inference-logs')
export class LogsProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process()
  async processLog(job: Job<CreateInferenceLogDto>) {
    const normalized = normalizeInferenceLogInput(job.data);
    if (!normalized) return;

    try {
      await this.prisma.inferenceLog.create({
        data: {
          sessionId: normalized.sessionId,
          requestId: normalized.requestId,
          messageId: normalized.messageId,
          traceId: normalized.traceId,
          provider: normalized.provider,
          model: normalized.model,
          startedAt: new Date(normalized.startedAt),
          finishedAt: normalized.finishedAt ? new Date(normalized.finishedAt) : null,
          latencyMs: normalized.latencyMs,
          status: normalized.status,
          inputPreview: normalized.inputPreview,
          outputPreview: normalized.outputPreview,
          errorMessage: normalized.errorMessage,
          tokenUsage: normalized.tokenUsage as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return;
      }
      throw err;
    }
  }
}
