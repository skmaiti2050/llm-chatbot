export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface LlmStreamChunk {
  text: string;
  finishReason?: 'stop' | 'length';
}

export interface LlmProvider {
  call(request: LlmRequest): Promise<LlmResponse>;
  callStreaming(request: LlmRequest): AsyncIterable<LlmStreamChunk>;
}
