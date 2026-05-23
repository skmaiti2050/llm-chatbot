import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { CreateInferenceLogDto } from '../ingestion/inference-log.dto';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

@Injectable()
export class LoggingService {
  private ingestionEndpoint: string;

  constructor() {
    this.ingestionEndpoint =
      process.env.INGESTION_ENDPOINT ?? 'http://localhost:4000/ingest/logs';
  }

  async callModelAndLog(payload: Omit<CreateInferenceLogDto, 'startedAt' | 'latencyMs' | 'status' | 'createdAt'> & {
    startedAt?: string;
  }) {
    const startedAt = payload.startedAt ?? new Date().toISOString();

    const simulatedLatency = Math.floor(Math.random() * 200) + 50;
    await sleep(simulatedLatency);

    const finishedAt = new Date().toISOString();

    const log: CreateInferenceLogDto = {
      sessionId: payload.sessionId,
      requestId: payload.requestId ?? randomUUID(),
      traceId: payload.traceId,
      provider: payload.provider,
      model: payload.model,
      startedAt,
      finishedAt,
      latencyMs: simulatedLatency,
      status: 'success',
      inputPreview: payload.inputPreview,
      outputPreview: payload.outputPreview ?? 'simulated response',
      errorMessage: payload.errorMessage,
      tokenUsage: payload.tokenUsage,
    };

    void this.sendWithRetry(log, 3, 200);

    return {
      text: log.outputPreview,
      latencyMs: log.latencyMs,
      tokenUsage: log.tokenUsage,
    };
  }

  private async sendWithRetry(payload: CreateInferenceLogDto, retries: number, backoffMs: number): Promise<void> {
    try {
      await fetch(this.ingestionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (retries > 0) {
        await sleep(backoffMs);
        return this.sendWithRetry(payload, retries - 1, backoffMs * 2);
      }
    }
  }
}
