import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamChunk } from '../llm.interface';

function errorLabel(status: number): string {
  if (status === 401) return 'Authentication failed - check API key';
  if (status === 429) return 'Rate limited - try again later';
  if (status >= 500) return `Provider error (${status})`;
  return `Request error (${status})`;
}

type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenAiChoice = {
  message: OpenAiChatMessage;
  finish_reason: string;
};

type OpenAiUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type OpenAiResponse = {
  id: string;
  model: string;
  choices: OpenAiChoice[];
  usage?: OpenAiUsage;
};

type OpenAiStreamChoice = {
  delta: { content?: string };
  finish_reason: string | null;
};

type OpenAiStreamChunk = {
  id: string;
  model: string;
  choices: OpenAiStreamChoice[];
  usage?: OpenAiUsage;
};

@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = 'openai-compatible';

  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
    this.apiKey = process.env.LLM_API_KEY ?? '';
    this.defaultModel = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  }

  async call(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model || this.defaultModel;
    const maxTokens = request.maxTokens ?? 8192;
    const body = {
      model,
      messages: request.messages,
      max_tokens: maxTokens,
      temperature: request.temperature ?? 0.7,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const reason = errorLabel(response.status);
      throw new Error(reason);
    }

    const data = (await response.json()) as OpenAiResponse;
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('LLM returned no choices');
    }

    if (choice.finish_reason === 'length') {
      console.warn(`LLM response truncated (finish_reason=length). Current max_tokens: ${maxTokens}. Response length: ${choice.message.content.length} chars`);
    }

    return {
      text: choice.message.content,
      model: data.model,
      tokenUsage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *callStreaming(request: LlmRequest): AsyncIterable<LlmStreamChunk> {
    const model = request.model || this.defaultModel;
    const maxTokens = request.maxTokens ?? 8192;
    const body = {
      model,
      messages: request.messages,
      max_tokens: maxTokens,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const reason = errorLabel(response.status);
      throw new Error(reason);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('LLM response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;

        try {
          const chunk = JSON.parse(payload) as OpenAiStreamChunk;
          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const text = choice.delta?.content ?? '';
          if (text) {
            yield { text };
          }

          if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
            if (choice.finish_reason === 'length') {
              console.warn(`LLM response truncated (finish_reason=length). Current max_tokens: ${maxTokens}.`);
            }
            yield { text: '', finishReason: choice.finish_reason };
            return;
          }
        } catch {
        }
      }
    }
  }
}
