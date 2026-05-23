import { Body, Controller, Get, Post } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import type { CreateInferenceLogDto } from './inference-log.dto';

@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('logs')
  createLog(@Body() body: CreateInferenceLogDto) {
    return this.ingestionService.createLog(body);
  }

  @Get('logs')
  listLogs() {
    return this.ingestionService.listLogs();
  }
}
