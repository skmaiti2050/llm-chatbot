import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResponse } from '../llm.interface';

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

@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
    this.apiKey = process.env.LLM_API_KEY ?? '';
    this.model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  }

  async call(request: LlmRequest): Promise<LlmResponse> {
    const maxTokens = request.maxTokens ?? 2048;
    const body = {
      model: this.model,
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
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
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
}
