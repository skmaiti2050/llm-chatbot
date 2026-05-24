import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResponse } from '../llm.interface';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

@Injectable()
export class SimulationProvider implements LlmProvider {
  async call(request: LlmRequest): Promise<LlmResponse> {
    const simulatedLatency = Math.floor(Math.random() * 200) + 50;
    await sleep(simulatedLatency);

    const lastUserMessage = [...request.messages].reverse().find((m) => m.role === 'user');
    const text = lastUserMessage
      ? `Simulated reply to: "${lastUserMessage.content.slice(0, 60)}"`
      : 'Simulated response (no user message found)';

    return {
      text,
      model: 'simulation',
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
}
