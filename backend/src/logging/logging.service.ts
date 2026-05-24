import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CreateInferenceLogDto } from '../ingestion/inference-log.dto';
import type { LlmProvider, LlmMessage, LlmRequest, LlmResponse, LlmStreamChunk } from '../llm/llm.interface';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

const PREVIEW_MAX_LENGTH = 500;

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

@Injectable()
export class LoggingService {
  private ingestionEndpoint: string;

  constructor(
    @Inject('LlmProvider') private readonly llmProvider: LlmProvider,
  ) {
    this.ingestionEndpoint =
      process.env.INGESTION_ENDPOINT ?? 'http://localhost:4000/ingest/logs';
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

    void this.sendWithRetry(log, 3, 200);

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

    void this.sendWithRetry(log, 3, 200);
  }

  private async sendWithRetry(payload: CreateInferenceLogDto, retries: number, backoffMs: number): Promise<void> {
    try {
      await fetch(this.ingestionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      if (retries > 0) {
        await sleep(backoffMs);
        return this.sendWithRetry(payload, retries - 1, backoffMs * 2);
      }
    }
  }
}
