import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateInferenceLogDto,
  InferenceLogRecord,
  InferenceLogStatus,
  normalizeInferenceLogInput,
} from './inference-log.dto';
import { PrismaInferenceLogRepository } from './prisma-inference-log.repository';

@Injectable()
export class IngestionService {
  constructor(
    private readonly inferenceLogRepository: PrismaInferenceLogRepository,
  ) {}

  async createLog(payload: CreateInferenceLogDto): Promise<InferenceLogRecord> {
    const normalizedPayload = normalizeInferenceLogInput(payload);

    if (!normalizedPayload) {
      throw new BadRequestException('Invalid inference log payload');
    }

    return this.inferenceLogRepository.insert(normalizedPayload);
  }

  async listLogs(): Promise<InferenceLogRecord[]> {
    return this.inferenceLogRepository.findAll();
  }

  async listStatuses(): Promise<InferenceLogStatus[]> {
    const logs = await this.inferenceLogRepository.findAll();
    return logs.map((entry) => entry.status);
  }
}
