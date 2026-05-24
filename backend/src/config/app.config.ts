export interface AppConfig {
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  llmProvider: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  contextWindowSize: number;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT) || 4000,
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    databaseUrl: process.env.DATABASE_URL || '',
    llmProvider: process.env.LLM_PROVIDER || 'openai-compatible',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
    contextWindowSize: Number(process.env.CONTEXT_WINDOW_SIZE) || 20,
  };
}
