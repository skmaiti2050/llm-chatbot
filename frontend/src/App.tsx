import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import './App.css'
import { NotesPanel } from './components/NotesPanel/NotesPanel'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Workspace } from './components/Workspace/Workspace'
import {
  apiBase,
  createLocalReply,
  createSeedMessages,
  type ChatMessage,
  type ConnectionState,
  type CreateConversationResponse,
  promptPresets,
} from './lib/chat'

function App() {
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [connectionState, setConnectionState] = useState<ConnectionState>('booting')
  const [isSending, setIsSending] = useState(false)
  const [statusNote, setStatusNote] = useState('Connecting to the API…')

  useEffect(() => {
    void bootConversation()
  }, [])

  async function loadMessages(id: string) {
    const response = await fetch(`${apiBase}/conversations/${id}/messages`)

    if (!response.ok) {
      throw new Error('Could not load the current conversation')
    }

    const data = (await response.json()) as ChatMessage[]
    setMessages(data)
  }

  async function bootConversation() {
    setConnectionState('booting')
    setStatusNote('Opening a fresh conversation…')

    try {
      const response = await fetch(`${apiBase}/conversations`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Could not create a conversation')
      }

      const data = (await response.json()) as CreateConversationResponse
      setConversationId(data.conversationId)
      await loadMessages(data.conversationId)
      setConnectionState('online')
      setStatusNote('Connected to the backend')
    } catch {
      const fallbackId = 'local-preview'
      setConversationId(fallbackId)
      setMessages(createSeedMessages())
      setConnectionState('offline')
      setStatusNote('Running local preview mode')
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    const content = draft.trim()
    if (!content || isSending) {
      return
    }

    setIsSending(true)

    try {
      if (connectionState === 'online' && conversationId) {
        const response = await fetch(`${apiBase}/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        })

        if (!response.ok) {
          throw new Error('Message send failed')
        }

        await loadMessages(conversationId)
      } else {
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
        }

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: createLocalReply(content),
          createdAt: new Date().toISOString(),
        }

        setMessages((current) => [...current, userMessage, assistantMessage])
      }

      setDraft('')
      setStatusNote('Turn recorded')
    } catch {
      setConnectionState('offline')
      setStatusNote('Backend unavailable; staying in local preview mode')

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: createLocalReply(content),
        createdAt: new Date().toISOString(),
      }

      setMessages((current) => [...current, userMessage, assistantMessage])
      setDraft('')
    } finally {
      setIsSending(false)
    }
  }

  const userCount = messages.filter((message) => message.role === 'user').length
  const assistantCount = messages.length - userCount
  const lastUpdate = messages[messages.length - 1]?.createdAt

  return (
    <main className="app-shell">
      <Sidebar
        connectionState={connectionState}
        conversationId={conversationId}
        assistantCount={assistantCount}
        lastUpdate={lastUpdate}
        statusNote={statusNote}
        userCount={userCount}
      />

      <Workspace
        apiBase={apiBase}
        draft={draft}
        isSending={isSending}
        messages={messages}
        onDraftChange={setDraft}
        onNewSession={() => void bootConversation()}
        onPresetSelect={setDraft}
        onSubmit={handleSubmit}
        promptPresets={promptPresets}
      />

      <NotesPanel onPresetSelect={setDraft} />
    </main>
  )
}

export default App
