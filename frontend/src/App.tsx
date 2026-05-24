import { useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import './App.css'
import { ConfirmDialog } from './components/ConfirmDialog/ConfirmDialog'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Workspace } from './components/Workspace/Workspace'
import {
  apiBase,
  createLocalReply,
  createSeedMessages,
  type ChatMessage,
  type ConnectionState,
  type ConversationStatus,
  type ConversationSummary,
  type CreateConversationResponse,
  promptPresets,
} from './lib/chat'

function App() {
  const [conversationId, setConversationId] = useState('')
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('active')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [connectionState, setConnectionState] = useState<ConnectionState>('booting')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState('Connecting to the API…')
  const booted = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void initApp()
  }, [])

  useEffect(() => {
    if (connectionState !== 'offline') return

    const id = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/health`)

        if (response.ok) {
          setConnectionState('online')
          setStatusNote('Backend reconnected')
          void loadConversations()
        }
      } catch {
        // still offline
      }
    }, 15_000)

    return () => clearInterval(id)
  }, [connectionState])

  async function loadMessages(id: string) {
    const response = await fetch(`${apiBase}/conversations/${id}/messages`)

    if (!response.ok) {
      throw new Error('Could not load the current conversation')
    }

    const data = (await response.json()) as ChatMessage[]
    setMessages(data)
  }

  async function loadConversations(activeId?: string) {
    setIsLoadingConversations(true)

    try {
      const response = await fetch(`${apiBase}/conversations`)

      if (response.ok) {
        const data = (await response.json()) as ConversationSummary[]
        setConversations(data)

        const id = activeId ?? conversationId
        const current = data.find((c) => c.id === id)
        if (current) {
          setConversationStatus(current.status)
        }
      }
    } catch {
      // Silently fail — conversations list is best-effort
    } finally {
      setIsLoadingConversations(false)
    }
  }

  async function bootConversation() {
    // Kept for backward compat — same as createNewConversation
    return createNewConversation()
  }

  async function initApp() {
    setConnectionState('booting')
    setStatusNote('Connecting to the API…')

    try {
      const response = await fetch(`${apiBase}/health`)

      if (!response.ok) {
        throw new Error('Backend not healthy')
      }

      setConnectionState('online')
      setStatusNote('Connected to the backend')
      await loadConversations()
    } catch {
      setConversationId('local-preview')
      setConversationStatus('active')
      setMessages(createSeedMessages())
      setConnectionState('offline')
      setStatusNote('Running local preview mode')
    }
  }

  async function createNewConversation() {
    try {
      const response = await fetch(`${apiBase}/conversations`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Could not create a conversation')
      }

      const data = (await response.json()) as CreateConversationResponse
      setConversationId(data.conversationId)
      setConversationStatus('active')
      await loadMessages(data.conversationId)
      void loadConversations(data.conversationId)
      setConnectionState('online')
      setStatusNote('Connected to the backend')
    } catch {
      setConnectionState('offline')
      setStatusNote('Could not reach the backend')
    }
  }

  async function handleSelectConversation(id: string) {
    if (id === conversationId) return

    try {
      setConversationId(id)
      await loadMessages(id)

      const found = conversations.find((c) => c.id === id)
      if (found) {
        setConversationStatus(found.status)
      }
    } catch {
      // Stay on current conversation if loading fails
      setConnectionState('offline')
      setStatusNote('Could not load the conversation')
    }
  }

  async function handleCancelConversation() {
    if (!conversationId || connectionState !== 'online') return

    cancelRef.current = true
    abortRef.current?.abort()
    setIsSending(false)

    try {
      const response = await fetch(`${apiBase}/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      })

      if (!response.ok) {
        throw new Error('Could not cancel conversation')
      }

      setConversationStatus('canceled')
      setStatusNote('Conversation canceled')
      void loadConversations(conversationId)
    } catch {
      setStatusNote('Failed to cancel conversation')
    }
  }

  async function handleDeleteConversation(id: string) {
    if (connectionState !== 'online') return
    setDeleteConfirmId(id)
  }

  async function confirmDelete() {
    const id = deleteConfirmId
    if (!id) return

    setDeleteConfirmId(null)

    try {
      const response = await fetch(`${apiBase}/conversations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Could not delete conversation')
      }

      if (id === conversationId) {
        const remaining = conversations.filter((c) => c.id !== id)
        const next = remaining[0]

        if (next) {
          setConversationId(next.id)
          setConversationStatus(next.status)
          await loadMessages(next.id)
          void loadConversations(next.id)
        } else {
          setConversationId('')
          setConversationStatus('active')
          setMessages([])
          void loadConversations()
        }
      } else {
        void loadConversations(conversationId)
      }
    } catch {
      setStatusNote('Failed to delete conversation')
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    const content = draft.trim()
    if (!content || isSending) return

    cancelRef.current = false
    setDraft('')

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }

    const assistantId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, userMessage, assistantMessage])

    if (connectionState === 'online') {
      setIsSending(true)
      setStatusNote('Waiting for response…')

      try {
        let targetId = conversationId

        if (!targetId) {
          const createRes = await fetch(`${apiBase}/conversations`, {
            method: 'POST',
          })

          if (!createRes.ok) {
            throw new Error('Could not create conversation')
          }

          const { conversationId: newId } = await createRes.json() as CreateConversationResponse
          targetId = newId
          setConversationId(newId)
          setConversationStatus('active')
        }

        const controller = new AbortController()
        abortRef.current = controller

        const response = await fetch(`${apiBase}/conversations/${targetId}/messages/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          const msg =
            typeof body.message === 'string'
              ? body.message
              : Array.isArray(body.message)
                ? body.message[0]
                : 'Message send failed'

          setStatusNote(msg)
          setMessages((current) => current.filter((m) => m.id !== assistantId))
          return
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue

            const payload = trimmed.slice(6)
            const chunk = JSON.parse(payload)

            if (chunk.finishReason) {
              if (chunk.text) {
                setMessages((current) =>
                  current.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: chunk.text }
                      : m,
                  ),
                )
              }
              setStatusNote('Turn recorded')
            } else if (chunk.text) {
              setMessages((current) =>
                current.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk.text }
                    : m,
                ),
              )
            }
          }
        }

        void loadConversations()
      } catch {
        if (cancelRef.current) return
        setConnectionState('offline')
        setStatusNote('Backend unavailable; staying in local preview mode')
      } finally {
        setIsSending(false)
      }
    } else {
      setIsSending(true)

      try {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const reply = createLocalReply(content)
        setMessages((current) =>
          current.map((m) =>
            m.id === assistantId ? { ...m, content: reply } : m,
          ),
        )
        setStatusNote('Turn recorded')
      } finally {
        setIsSending(false)
      }
    }
  }

  const userCount = messages.filter((message) => message.role === 'user').length
  const assistantCount = messages.length - userCount
  const lastUpdate = messages[messages.length - 1]?.createdAt

  return (
    <main className="app-shell">
      <Sidebar
        activeConversationId={conversationId}
        assistantCount={assistantCount}
        connectionState={connectionState}
        conversations={conversations}
        isLoadingConversations={isLoadingConversations}
        lastUpdate={lastUpdate}
        onDeleteConversation={handleDeleteConversation}
        onNewConversation={() => void bootConversation()}
        onSelectConversation={handleSelectConversation}
        statusNote={statusNote}
        userCount={userCount}
      />

      <Workspace
        apiBase={apiBase}
        conversationStatus={conversationStatus}
        draft={draft}
        isSending={isSending}
        messages={messages}
        onCancelConversation={() => void handleCancelConversation()}
        onDeleteConversation={() => void handleDeleteConversation(conversationId)}
        onDraftChange={setDraft}
        onNewSession={() => void bootConversation()}
        onPresetSelect={setDraft}
        onSubmit={handleSubmit}
        promptPresets={promptPresets}
      />

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Delete conversation"
        message="This will permanently delete this conversation and all its messages. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </main>
  )
}

export default App
