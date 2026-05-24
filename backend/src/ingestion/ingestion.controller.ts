import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { CreateInferenceLogDto, InferenceLogRecord } from './inference-log.dto';

@ApiTags('Ingestion')
@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('logs')
  @ApiOperation({ summary: 'Ingest an inference log' })
  @ApiResponse({ status: 201, description: 'Log created', type: InferenceLogRecord })
  createLog(@Body() body: CreateInferenceLogDto) {
    return this.ingestionService.createLog(body);
  }

  @Get('logs')
  @ApiOperation({ summary: 'List all inference logs' })
  @ApiResponse({ status: 200, description: 'List of inference logs', type: [InferenceLogRecord] })
  listLogs() {
    return this.ingestionService.listLogs();
  }
}
