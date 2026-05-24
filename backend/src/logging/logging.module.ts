import { Global, Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { LoggingService } from './logging.service';

@Global()
@Module({
  imports: [LlmModule],
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {}
