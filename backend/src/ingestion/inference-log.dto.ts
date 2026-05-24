import { IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type InferenceLogStatus = 'success' | 'error';

export class InferenceTokenUsage {
  @ApiPropertyOptional({ description: 'Number of prompt tokens' })
  @IsOptional()
  @IsInt()
  @Min(0)
  promptTokens?: number;

  @ApiPropertyOptional({ description: 'Number of completion tokens' })
  @IsOptional()
  @IsInt()
  @Min(0)
  completionTokens?: number;

  @ApiPropertyOptional({ description: 'Total tokens used' })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalTokens?: number;
}

export class CreateInferenceLogDto {
  @ApiProperty({ description: 'Session/conversation identifier' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ description: 'Unique request ID for idempotency' })
  @IsString()
  requestId!: string;

  @ApiPropertyOptional({ description: 'ID of the generated message' })
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiPropertyOptional({ description: 'Trace ID for distributed tracing' })
  @IsOptional()
  @IsString()
  traceId?: string;

  @ApiProperty({ description: 'LLM provider name' })
  @IsString()
  provider!: string;

  @ApiProperty({ description: 'Model name' })
  @IsString()
  model!: string;

  @ApiProperty({ description: 'Start timestamp' })
  @IsString()
  startedAt!: string;

  @ApiPropertyOptional({ description: 'Finish timestamp' })
  @IsOptional()
  @IsString()
  finishedAt?: string;

  @ApiProperty({ description: 'Latency in milliseconds' })
  @IsInt()
  @Min(0)
  latencyMs!: number;

  @ApiProperty({ description: 'Request status', enum: ['success', 'error'] })
  @IsIn(['success', 'error'])
  status!: InferenceLogStatus;

  @ApiPropertyOptional({ description: 'Preview of input messages' })
  @IsOptional()
  @IsString()
  inputPreview?: string;

  @ApiPropertyOptional({ description: 'Preview of model output' })
  @IsOptional()
  @IsString()
  outputPreview?: string;

  @ApiPropertyOptional({ description: 'Error message if status is error' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Token usage breakdown', type: InferenceTokenUsage })
  @IsOptional()
  @ValidateNested()
  @Type(() => InferenceTokenUsage)
  tokenUsage?: InferenceTokenUsage;
}

export class InferenceLogRecord extends CreateInferenceLogDto {
  @ApiProperty({ description: 'Log record UUID' })
  id!: string;

  @ApiProperty({ description: 'ISO 8601 creation timestamp' })
  createdAt!: string;
}

export function normalizeInferenceLogInput(
  payload: CreateInferenceLogDto,
): CreateInferenceLogDto | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const sessionId = normalizeRequiredString(payload.sessionId);
  const requestId = normalizeRequiredString(payload.requestId);
  const provider = normalizeRequiredString(payload.provider);
  const model = normalizeRequiredString(payload.model);
  const status = normalizeStatus(payload.status);
  const latencyMs = normalizeLatency(payload.latencyMs);
  const startedAt = normalizeTimestamp(payload.startedAt);
  const finishedAt = payload.finishedAt
    ? normalizeTimestamp(payload.finishedAt)
    : undefined;

  if (
    !sessionId ||
    !requestId ||
    !provider ||
    !model ||
    !status ||
    latencyMs === null ||
    !startedAt ||
    (payload.finishedAt && !finishedAt)
  ) {
    return null;
  }

  return {
    sessionId,
    requestId,
    traceId: normalizeOptionalString(payload.traceId),
    provider,
    model,
    startedAt,
    finishedAt: finishedAt ?? undefined,
    latencyMs,
    status,
    inputPreview: normalizeOptionalString(payload.inputPreview),
    outputPreview: normalizeOptionalString(payload.outputPreview),
    errorMessage: normalizeOptionalString(payload.errorMessage),
    tokenUsage: normalizeTokenUsage(payload.tokenUsage),
  };
}

function normalizeRequiredString(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized : null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStatus(value: unknown): InferenceLogStatus | null {
  return value === 'success' || value === 'error' ? value : null;
}

function normalizeLatency(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeTokenUsage(value: unknown): InferenceTokenUsage | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const usage = value as Record<string, unknown>;
  const promptTokens = normalizeCount(usage.promptTokens);
  const completionTokens = normalizeCount(usage.completionTokens);
  const totalTokens = normalizeCount(usage.totalTokens);

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function normalizeCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}
