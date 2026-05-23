import { Injectable } from '@nestjs/common';
import { Prisma, InferenceLog as PrismaInferenceLog } from '@prisma/client';
import {
  CreateInferenceLogDto,
  InferenceLogRecord,
} from './inference-log.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaInferenceLogRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async insert(payload: CreateInferenceLogDto): Promise<InferenceLogRecord> {
    const record = await this.prismaService.inferenceLog.create({
      data: {
        sessionId: payload.sessionId,
        requestId: payload.requestId,
        traceId: payload.traceId,
        provider: payload.provider,
        model: payload.model,
        startedAt: new Date(payload.startedAt),
        finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : null,
        latencyMs: payload.latencyMs,
        status: payload.status,
        inputPreview: payload.inputPreview,
        outputPreview: payload.outputPreview,
        errorMessage: payload.errorMessage,
        tokenUsage: payload.tokenUsage as Prisma.InputJsonValue | undefined,
      },
    });

    return mapInferenceLog(record);
  }

  async findAll(): Promise<InferenceLogRecord[]> {
    const records = await this.prismaService.inferenceLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return records.map(mapInferenceLog);
  }
}

function mapInferenceLog(record: PrismaInferenceLog): InferenceLogRecord {
  return {
    id: record.id,
    sessionId: record.sessionId,
    requestId: record.requestId,
    traceId: record.traceId ?? undefined,
    provider: record.provider,
    model: record.model,
    startedAt: record.startedAt.toISOString(),
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : undefined,
    latencyMs: record.latencyMs,
    status: record.status,
    inputPreview: record.inputPreview ?? undefined,
    outputPreview: record.outputPreview ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    tokenUsage: (record.tokenUsage as
      | CreateInferenceLogDto['tokenUsage']
      | undefined) ?? undefined,
    createdAt: record.createdAt.toISOString(),
  };
}
