import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggingService } from './logging.service';
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

    const providers: any[] = [LoggingService];
    if (redisConfig) {
      providers.push(LogsProcessor);
    }

    return {
      module: LoggingModule,
      imports: [LlmModule, PrismaModule, ...bullImports],
      providers,
      exports: [LoggingService],
    };
  }
}
