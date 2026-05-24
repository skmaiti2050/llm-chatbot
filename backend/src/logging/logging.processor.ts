import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import * as Bull from 'bull';
import { CreateInferenceLogDto, normalizeInferenceLogInput } from '../ingestion/inference-log.dto';
import { PrismaInferenceLogRepository } from '../ingestion/prisma-inference-log.repository';

@Injectable()
@Processor('inference-logs')
export class LogsProcessor {
  constructor(private readonly inferenceLogRepository: PrismaInferenceLogRepository) {}

  @Process()
  async processLog(job: Bull.Job<CreateInferenceLogDto>) {
    const normalized = normalizeInferenceLogInput(job.data);
    if (!normalized) return;

    await this.inferenceLogRepository.insert(normalized);
  }
}
