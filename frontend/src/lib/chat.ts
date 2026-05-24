export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

export type ConversationStatus = 'active' | 'paused' | 'canceled'

export type ConversationSummary = {
  id: string
  status: ConversationStatus
  createdAt: string
  updatedAt: string
  canceledAt?: string
}

export type ConnectionState = 'booting' | 'online' | 'offline'

export type CreateConversationResponse = {
  conversationId: string
}

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const promptPresets = [
  'Summarize the latest run in three lines.',
  'Flag the metrics that look unusual.',
  'Draft a short note for the team.',
  'Turn this into a crisp release update.',
]

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function shortId(value: string) {
  return value.length > 20 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value
}

export function createSeedMessages(): ChatMessage[] {
  const now = Date.now()

  return [
    {
      id: 'seed-assistant-1',
      role: 'assistant',
      content:
        'Hello! I am your AI assistant. How can I help you today?',
      createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'seed-user-1',
      role: 'user',
      content: 'Can you tell me a little bit about what you can do?',
      createdAt: new Date(now - 1000 * 60 * 8).toISOString(),
    },
    {
      id: 'seed-assistant-2',
      role: 'assistant',
      content:
        'I can answer questions, help write code, summarize text, and assist with a variety of other tasks. Just let me know what you need!',
      createdAt: new Date(now - 1000 * 60 * 6).toISOString(),
    },
  ]
}

export function createLocalReply(content: string) {
  const trimmed = content.trim()

  if (!trimmed) {
    return 'Local fallback stayed quiet because the message was empty.'
  }

  return `Local preview only. I captured: ${trimmed}`
}
