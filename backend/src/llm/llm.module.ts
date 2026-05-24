import { Module } from '@nestjs/common';
import type { LlmProvider } from './llm.interface';
import { LlmRouterService } from './llm-router.service';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { SimulationProvider } from './providers/simulation.provider';

const providerFactory = {
  provide: 'LlmProvider',
  useFactory: (
    router: LlmRouterService,
    openai: OpenAiCompatibleProvider,
    anthropic: AnthropicProvider,
    simulation: SimulationProvider,
  ): LlmProvider => {
    const preferred = process.env.LLM_PROVIDER ?? 'openai-compatible';

    router.register(openai);
    router.register(anthropic);
    router.register(simulation);

    const defaultName = ['anthropic', 'openai-compatible', 'simulation'].includes(preferred)
      ? preferred
      : 'simulation';

    router.setDefault(defaultName);
    return router;
  },
  inject: [LlmRouterService, OpenAiCompatibleProvider, AnthropicProvider, SimulationProvider],
};

@Module({
  providers: [LlmRouterService, OpenAiCompatibleProvider, AnthropicProvider, SimulationProvider, providerFactory],
  exports: ['LlmProvider'],
})
export class LlmModule {}
