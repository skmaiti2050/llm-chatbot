import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { LoggingService } from './logging.service';
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { LogsProcessor } from './logging.processor';

function getRedisConfig(): Record<string, any> | null {
  const host = process.env.REDIS_HOST;
  if (!host || host.trim().length === 0) return null;

  const config: Record<string, any> = {
    host,
    port: Number(process.env.REDIS_PORT) || 6379,
  };

  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  if (password) {
    config.password = password;
    if (username) config.username = username;
  }

  if (process.env.REDIS_TLS === 'true') {
    config.tls = {};
  }

  return config;
}

@Global()
@Module({})
export class LoggingModule {
  static register(): DynamicModule {
    const redisConfig = getRedisConfig();
    const bullImports = redisConfig
      ? [
          BullModule.forRoot({ redis: redisConfig }),
          BullModule.registerQueue({ name: 'inference-logs' }),
        ]
      : [];

    const providers: any[] = [
      LoggingService,
      makeCounterProvider({
        name: 'llm_requests_total',
        help: 'Total number of LLM requests',
        labelNames: ['provider', 'model', 'status'],
      }),
      makeHistogramProvider({
        name: 'llm_request_latency_seconds',
        help: 'Latency of LLM requests in seconds',
        labelNames: ['provider', 'model', 'status'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30],
      }),
      makeCounterProvider({
        name: 'llm_tokens_total',
        help: 'Total number of tokens used',
        labelNames: ['provider', 'model', 'type'],
      }),
    ];
    if (redisConfig) {
      providers.push(LogsProcessor);
    }

    return {
      module: LoggingModule,
      imports: [LlmModule, PrismaModule, IngestionModule, ...bullImports],
      providers,
      exports: [LoggingService],
    };
  }
}
