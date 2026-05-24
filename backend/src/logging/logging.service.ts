import { randomUUID } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateInferenceLogDto, normalizeInferenceLogInput } from '../ingestion/inference-log.dto';
import { PrismaInferenceLogRepository } from '../ingestion/prisma-inference-log.repository';
import type { LlmProvider, LlmMessage, LlmRequest, LlmResponse, LlmStreamChunk } from '../llm/llm.interface';

export type CallModelPayload = {
  sessionId: string;
  requestId?: string;
  messageId?: string;
  traceId?: string;
  provider: string;
  model: string;
  messages: LlmMessage[];
  maxTokens?: number;
};

export type CallModelResult = {
  text: string;
  latencyMs: number;
  tokenUsage?: LlmResponse['tokenUsage'];
};

const PREVIEW_MAX_LENGTH = 500;

@Injectable()
export class LoggingService {
  constructor(
    @Inject('LlmProvider') private readonly llmProvider: LlmProvider,
    @Optional() @InjectQueue('inference-logs') private readonly logsQueue: Queue | null,
    private readonly inferenceLogRepository: PrismaInferenceLogRepository,
  ) {}

  private async persistLog(log: CreateInferenceLogDto): Promise<void> {
    if (this.logsQueue) {
      await this.logsQueue.add(log);
      return;
    }

    const normalized = normalizeInferenceLogInput(log);
    if (!normalized) return;

    await this.inferenceLogRepository.insert(normalized);
  }

  async callModelAndLog(payload: CallModelPayload): Promise<CallModelResult> {
    const requestId = payload.requestId ?? randomUUID();
    const startedAt = new Date();

    const inputPreview = payload.messages.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, PREVIEW_MAX_LENGTH);

    let llmResponse: LlmResponse;
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;

    try {
      const request: LlmRequest = {
        messages: payload.messages,
        maxTokens: payload.maxTokens,
        provider: payload.provider,
        model: payload.model,
      };

      llmResponse = await this.llmProvider.call(request);
    } catch (err) {
      status = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
      llmResponse = {
        text: `LLM call failed: ${errorMessage}`,
        model: payload.model,
      };
    }

    const finishedAt = new Date();
    const latencyMs = finishedAt.getTime() - startedAt.getTime();

    const log: CreateInferenceLogDto = {
      sessionId: payload.sessionId,
      requestId,
      messageId: payload.messageId,
      traceId: payload.traceId,
      provider: payload.provider,
      model: llmResponse.model,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs,
      status,
      inputPreview,
      outputPreview: llmResponse.text.slice(0, PREVIEW_MAX_LENGTH),
      errorMessage,
      tokenUsage: llmResponse.tokenUsage,
    };

    await this.persistLog(log);

    return {
      text: llmResponse.text,
      latencyMs,
      tokenUsage: llmResponse.tokenUsage,
    };
  }

  async *callModelAndLogStreaming(payload: CallModelPayload): AsyncIterable<LlmStreamChunk> {
    const requestId = payload.requestId ?? randomUUID();
    const startedAt = new Date();
    let fullText = '';
    let finalFinishReason: 'stop' | 'length' | undefined;
    let errorMessage: string | undefined;

    try {
      const request: LlmRequest = {
        messages: payload.messages,
        maxTokens: payload.maxTokens,
        provider: payload.provider,
        model: payload.model,
      };

      for await (const chunk of this.llmProvider.callStreaming(request)) {
        if (chunk.finishReason) {
          finalFinishReason = chunk.finishReason;
        } else {
          fullText += chunk.text;
        }
        yield chunk;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      fullText = `LLM call failed: ${errorMessage}`;
      yield { text: fullText, finishReason: 'stop' };
    }

    const finishedAt = new Date();
    const latencyMs = finishedAt.getTime() - startedAt.getTime();
    const inputPreview = payload.messages.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, PREVIEW_MAX_LENGTH);

    const log: CreateInferenceLogDto = {
      sessionId: payload.sessionId,
      requestId,
      messageId: payload.messageId,
      traceId: payload.traceId,
      provider: payload.provider,
      model: payload.model,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs,
      status: errorMessage ? 'error' : 'success',
      inputPreview,
      outputPreview: fullText.slice(0, PREVIEW_MAX_LENGTH),
      errorMessage,
    };

    await this.persistLog(log);
  }
}
