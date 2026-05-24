import { randomUUID } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateInferenceLogDto, normalizeInferenceLogInput } from '../ingestion/inference-log.dto';
import { PrismaInferenceLogRepository } from '../ingestion/prisma-inference-log.repository';
import type { LlmProvider, LlmMessage, LlmRequest, LlmResponse, LlmStreamChunk } from '../llm/llm.interface';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { OpenRedaction } from 'openredaction';

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
  private readonly redactor = new OpenRedaction({
    customPatterns: [
      {
        type: 'API_KEY',
        regex: /\b(sk-[a-zA-Z0-9-]{20,}|sk-ant-[a-zA-Z0-9-_]{20,}|ghp_[a-zA-Z0-9]{36,})\b/gi,
        priority: 10,
        placeholder: '[API_KEY]',
      },
      {
        type: 'CREDENTIALS',
        regex: /\b(bearer|api[_-]?key|secret|password)\s*[:=]\s*[a-zA-Z0-9_\-\.]{10,}\b/gi,
        priority: 10,
        placeholder: '[REDACTED_CREDENTIALS]',
      }
    ]
  });

  private async redactText(text: string): Promise<string> {
    const result = await this.redactor.detect(text);
    return result.redacted;
  }

  constructor(
    @Inject('LlmProvider') private readonly llmProvider: LlmProvider,
    @Optional() @InjectQueue('inference-logs') private readonly logsQueue: Queue | null,
    private readonly inferenceLogRepository: PrismaInferenceLogRepository,
    @InjectMetric('llm_requests_total') private readonly requestsCounter: Counter<string>,
    @InjectMetric('llm_request_latency_seconds') private readonly latencyHistogram: Histogram<string>,
    @InjectMetric('llm_tokens_total') private readonly tokensCounter: Counter<string>,
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

    const inputRaw = payload.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const inputPreview = (await this.redactText(inputRaw)).slice(0, PREVIEW_MAX_LENGTH);

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
      outputPreview: (await this.redactText(llmResponse.text)).slice(0, PREVIEW_MAX_LENGTH),
      errorMessage,
      tokenUsage: llmResponse.tokenUsage,
    };

    await this.persistLog(log);

    this.requestsCounter.labels(payload.provider, llmResponse.model, status).inc();
    this.latencyHistogram.labels(payload.provider, llmResponse.model, status).observe(latencyMs / 1000);
    
    if (llmResponse.tokenUsage) {
      if (llmResponse.tokenUsage.promptTokens) {
        this.tokensCounter.labels(payload.provider, llmResponse.model, 'prompt').inc(llmResponse.tokenUsage.promptTokens);
      }
      if (llmResponse.tokenUsage.completionTokens) {
        this.tokensCounter.labels(payload.provider, llmResponse.model, 'completion').inc(llmResponse.tokenUsage.completionTokens);
      }
    }

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
    const inputRaw = payload.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const inputPreview = (await this.redactText(inputRaw)).slice(0, PREVIEW_MAX_LENGTH);

    const status = errorMessage ? 'error' : 'success';
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
      status,
      inputPreview,
      outputPreview: (await this.redactText(fullText)).slice(0, PREVIEW_MAX_LENGTH),
      errorMessage,
    };

    await this.persistLog(log);

    this.requestsCounter.labels(payload.provider, payload.model, status).inc();
    this.latencyHistogram.labels(payload.provider, payload.model, status).observe(latencyMs / 1000);
  }
}
