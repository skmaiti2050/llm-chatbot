import { Module } from '@nestjs/common';
import type { LlmProvider } from './llm.interface';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { SimulationProvider } from './providers/simulation.provider';

const providerFactory = {
  provide: 'LlmProvider',
  useFactory: (): LlmProvider => {
    const configured = process.env.LLM_API_KEY && process.env.LLM_API_KEY.length > 0;
    if (!configured) {
      return new SimulationProvider();
    }

    const type = process.env.LLM_PROVIDER ?? 'openai-compatible';
    if (type === 'openai-compatible') {
      return new OpenAiCompatibleProvider();
    }

    return new SimulationProvider();
  },
};

@Module({
  providers: [providerFactory],
  exports: ['LlmProvider'],
})
export class LlmModule {}
