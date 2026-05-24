import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamChunk } from './llm.interface';

@Injectable()
export class LlmRouterService implements LlmProvider {
  readonly name = 'router';

  private providers = new Map<string, LlmProvider>();
  private defaultProvider = 'simulation';

  register(provider: LlmProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefault(name: string): void {
    this.defaultProvider = name;
  }

  private resolve(request: LlmRequest): LlmProvider {
    const name = request.provider || this.defaultProvider;
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${name}. Available: ${[...this.providers.keys()].join(', ')}`);
    }
    return provider;
  }

  async call(request: LlmRequest): Promise<LlmResponse> {
    return this.resolve(request).call(request);
  }

  callStreaming(request: LlmRequest): AsyncIterable<LlmStreamChunk> {
    return this.resolve(request).callStreaming(request);
  }
}
