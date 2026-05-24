# LLM Chatbot

Multi-turn chatbot with streaming responses, inference logging, and a Bull-backed ingestion pipeline.

## Quick Start

### Prerequisites

- Node.js 24+
- PostgreSQL
- Redis (optional - falls back to direct DB write)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # configure API keys, DB URL, etc.
npx prisma migrate dev # apply migrations (safe, preserves data)
npm run dev            # http://localhost:4000
```

> **⚠️ Reset database:** If you need to wipe everything and start fresh, run
> `npx prisma db push --accept-data-loss` instead. This drops and recreates
> tables - **all existing data will be lost**.

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000 (proxies /api → :4000)
```

### Docker Compose

```bash
docker compose up --build
```

Set `LLM_API_KEY` (and other vars) in `.env` or pass them inline:

```bash
LLM_API_KEY=... docker compose up --build
```

## Architecture

```text
Frontend (React)
       │
       │ (HTTP POST & SSE Streaming)
       ▼
Backend (NestJS / ChatController)
       │
       │ (Routes by provider name)
       ▼
   LlmRouter ──▶ [External APIs: OpenAI / Anthropic]
       │
       │ (Wraps LLM call & extracts metadata)
       ▼
 LoggingService
       │
       │ (Enqueues log event)
       ▼
 Bull + Redis Queue (or direct fallback)
       │
       │ (Background worker process)
       ▼
   PostgreSQL
 (Stores Conversations, Messages, Inference Logs)
```

### Layers

- **ChatModule** - conversation CRUD, message persistence, context window
- **LoggingService** - wraps every LLM call, captures metadata (model, provider, latency, tokens, status, previews), enqueues or writes log
- **LlmModule** - provider router; OpenAI-compatible, Anthropic, and simulation providers registered based on available API keys
- **IngestionModule** - external log ingestion endpoint (`POST /ingest/logs`) for third-party integrations
- **Bull queue** (optional) - decouples log persistence from chat flow; when Redis is configured via `REDIS_HOST`, logs flow through the queue; otherwise written directly to DB

## Schema Design

### Conversation

| Column      | Type      | Notes                           |
| ----------- | --------- | ------------------------------- |
| id          | UUID      | PK                              |
| status      | enum      | `active`, `paused`, `cancelled` |
| createdAt   | DateTime  | Defaults to now()               |
| updatedAt   | DateTime  | Auto-updated                    |
| cancelledAt | DateTime? | Set when cancelled              |
| metadata    | JSON?     | Extensible key-value store      |

### Message

| Column         | Type     | Notes                                                        |
| -------------- | -------- | ------------------------------------------------------------ |
| id             | UUID     | PK                                                           |
| conversationId | UUID     | FK → Conversation, CASCADE delete                            |
| role           | enum     | `user`, `assistant` (System prompts are injected at runtime) |
| content        | Text     | Raw message text                                             |
| createdAt      | DateTime | Defaults to now()                                            |
| metadata       | JSON?    | Extensible                                                   |

Index: `(conversationId, createdAt)` - fast message history queries.

### InferenceLog

| Column        | Type      | Notes                                             |
| ------------- | --------- | ------------------------------------------------- |
| id            | UUID      | PK                                                |
| sessionId     | String    | Maps to conversation ID                           |
| requestId     | UUID      | **Unique** - idempotent ingestion                 |
| messageId     | String?   | Links to the generated message                    |
| traceId       | String?   | Optional distributed tracing ID                   |
| provider      | String    | e.g. `openai-compatible`                          |
| model         | String    | e.g. `gpt-4o-mini`                                |
| startedAt     | DateTime  | LLM call start                                    |
| finishedAt    | DateTime? | LLM call end                                      |
| latencyMs     | Int       | Wall-clock duration                               |
| status        | enum      | `success`, `error`                                |
| inputPreview  | String?   | First 500 chars of input                          |
| outputPreview | String?   | First 500 chars of output                         |
| errorMessage  | String?   | Set when status is `error`                        |
| tokenUsage    | JSON?     | `{ promptTokens, completionTokens, totalTokens }` |
| createdAt     | DateTime  | Defaults to now()                                 |
| updatedAt     | DateTime  | Auto-updated                                      |

Indexes: `(sessionId, startedAt)`, `(messageId)`, `(createdAt)`.

### Design Decisions

- **Separate `InferenceLog` from `Message`** - logs are high-volume write-only telemetry; messages are read-often chat history. Different access patterns justify separate tables.
- **`requestId` unique constraint** - enables safe retry of log delivery without duplicates.
- **Previews truncated to 500 chars** - keeps the table lean; full content lives in `Message.content`.
- **JSON columns for metadata and token usage** - avoids schema migrations for new fields.

## Tradeoffs

| Decision                                          | Rationale                                                                | Cost                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Bull queue (optional)                             | Decouples log persistence; uses Redis if available; zero-config fallback | Extra infra dependency when Redis is enabled                 |
| Self-HTTP ingestion replaced by queue             | Removed fragile `fetch()`-to-self pattern that silently swallowed errors | Queue adds eventual consistency (near-instant)               |
| Simulation provider fallback                      | No API key needed to start developing                                    | Simulated responses, not real LLM calls                      |
| Preview truncation (500 chars)                    | Limits storage per row                                                   | Long I/O not visible in logs (full content in Message table) |
| Async generator streaming                         | Backpressure-aware; works with SSE                                       | Error handling is more complex (generator cleanup)           |
| Global ValidationPipe with `forbidNonWhitelisted` | Catches unexpected fields early                                          | Requires every DTO to have class-validator decorators        |
| `prisma migrate deploy` in Docker                 | Safe for production; no `--accept-data-loss`                             | Requires migration files in the image                        |
| Component-scoped CSS                              | No global cascade conflicts                                              | Slightly more files to maintain                              |
| `crypto.randomUUID()`                             | Built-in, no external deps                                               | Not sortable (unlike ULID or UUIDv7)                         |

## What to Improve

- **Advanced multi-provider routing** - add automatic failover, retry logic, and load balancing across providers
- **Metrics dashboard** - real-time latency, throughput, error rate charts (Prometheus + Grafana)
- **PII redaction** - strip emails, phone numbers, keys from log previews
- **Batch ingestion** - buffer logs and flush in batches instead of one-at-a-time writes
- **Health check on queue depth** - alert if logs pile up
- **Dedicated ingestion service** - separate process so log pressure never affects chat
- **k6/artillery load tests** - validate throughput and failure modes under load

## Architecture Notes

### Ingestion Flow

1. `LoggingService.callModelAndLog(Streaming)` wraps every LLM call
2. After the LLM responds (or fails), metadata is assembled into `CreateInferenceLogDto`
3. `persistLog()` writes the log:
   - **If Redis is configured**: enqueues a Bull job → `LogsProcessor` consumes and inserts via Prisma
   - **If no Redis**: writes directly to PostgreSQL
4. External systems can also POST to `/ingest/logs` (with validation + idempotency)
5. Duplicate `requestId`s are silently ignored (Prisma P2002 handler)

### Logging Strategy

- **Every LLM call is logged** - both streaming and non-streaming paths
- **Preview truncation** at 500 characters keeps the row size predictable
- **Timestamps captured client-side** (in the backend) rather than relying on LLM provider response times
- **Error logging** captures the full error message string in `errorMessage`
- **Token usage** is optional (not all providers return it); stored as JSON

### Scaling Considerations

- **Read path** (`GET /ingest/logs`) is not optimised for high throughput - add pagination for production
- **Write path** uses Bull queue (optional) - if logs arrive faster than the DB can write, the queue buffers them
- **Without Redis**, each log write happens synchronously in the request chain - under high load this becomes a bottleneck
- **Separate tables** for messages and logs means chat reads are never blocked by log writes
- **PostgreSQL indexes** on `(sessionId, startedAt)` and `(createdAt)` support the common query patterns

### Failure Handling

- **LLM call failure**: caught by `LoggingService`, logged with `status: error`, user sees "LLM call failed: <reason>"
- **Log persistence failure**: when using the queue, Bull retries with backoff; direct writes throw (caught by global exception filter)
- **Redis unavailable**: `getRedisConfig()` returns `null` → Bull module skipped → direct DB writes
- **Ingestion endpoint**: standalone `POST /ingest/logs` validates input via `normalizeInferenceLogInput()`; returns 400 on invalid payloads
- **Frontend offline mode**: catches connection errors, shows local simulation, polls `/health` every 15s to reconnect
- **Duplicate logs**: `requestId` unique constraint prevents duplicates; P2002 caught and suppressed
