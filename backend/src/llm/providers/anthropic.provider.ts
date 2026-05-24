import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamChunk } from '../llm.interface';

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AnthropicContentBlock = {
  type: 'text';
  text: string;
};

type AnthropicResponse = {
  id: string;
  model: string;
  content: AnthropicContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
};

type AnthropicStreamEvent =
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } }
  | { type: 'message_delta'; delta: { stop_reason: string; stop_sequence: string | null }; usage: { output_tokens: number } }
  | { type: 'message_start'; message: { id: string; model: string; usage: AnthropicResponse['usage'] } }
  | { type: 'content_block_start'; index: number; content_block: { type: string; text?: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_stop' }
  | { type: 'error'; error: { type: string; message: string } }
  | { type: 'ping' };

function errorLabel(status: number): string {
  if (status === 401) return 'Authentication failed - check Anthropic API key';
  if (status === 429) return 'Rate limited - try again later';
  if (status >= 500) return `Anthropic error (${status})`;
  return `Request error (${status})`;
}

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    this.defaultModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  }

  async call(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model || this.defaultModel;
    const body = {
      model,
      max_tokens: request.maxTokens ?? 8192,
      messages: request.messages.map((m) => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })) as AnthropicMessage[],
    };

    if (request.messages.some((m) => m.role === 'system')) {
      (body as any).system = request.messages.filter((m) => m.role === 'system').map((m) => ({ type: 'text', text: m.content }));
      (body as any).messages = request.messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const reason = errorLabel(response.status);
      throw new Error(reason);
    }

    const data = (await response.json()) as AnthropicResponse;

    return {
      text: data.content.map((c) => c.text).join(''),
      model: data.model,
      tokenUsage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  async *callStreaming(request: LlmRequest): AsyncIterable<LlmStreamChunk> {
    const model = request.model || this.defaultModel;
    const body: Record<string, any> = {
      model,
      max_tokens: request.maxTokens ?? 8192,
      messages: request.messages.map((m) => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (request.messages.some((m) => m.role === 'system')) {
      body.system = request.messages.filter((m) => m.role === 'system').map((m) => ({ type: 'text', text: m.content }));
      body.messages = request.messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const reason = errorLabel(response.status);
      throw new Error(reason);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Anthropic response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';
    let modelName = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('event: ')) continue;

        if (!trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (!payload) continue;

        try {
          const event = JSON.parse(payload) as AnthropicStreamEvent;

          if (event.type === 'message_start') {
            modelName = event.message.model;
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            if (text) yield { text };
          } else if (event.type === 'message_delta') {
            const reason = event.delta.stop_reason === 'max_tokens' ? 'length' : 'stop';
            yield { text: '', finishReason: reason };
            return;
          } else if (event.type === 'error') {
            throw new Error(`Anthropic stream error: ${event.error.message}`);
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Anthropic stream error:')) {
            throw e;
          }
        }
      }
    }
  }
}
