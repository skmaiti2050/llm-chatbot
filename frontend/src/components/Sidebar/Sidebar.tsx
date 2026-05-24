import './Sidebar.css'
import { formatTime, shortId, type ConnectionState } from '../../lib/chat'

type SidebarProps = {
  assistantCount: number
  connectionState: ConnectionState
  conversationId: string
  lastUpdate?: string
  statusNote: string
  userCount: number
}

export function Sidebar({
  assistantCount,
  connectionState,
  conversationId,
  lastUpdate,
  statusNote,
  userCount,
}: SidebarProps) {
  return (
    <aside className="sidebar-pane">
      <div className="sidebar-pane__brand">
        <span className="sidebar-pane__eyebrow">Chat application</span>
        <h1>Conversations</h1>
        <p>
          A simple, easy-to-use interface for interacting with the AI assistant and keeping track of your chat history.
        </p>
      </div>

      <section className={`sidebar-pane__status sidebar-pane__status--${connectionState}`} aria-live="polite">
        <span className="sidebar-pane__label">Connection</span>
        <strong>
          {connectionState === 'online'
            ? 'Backend live'
            : connectionState === 'offline'
              ? 'Local preview'
              : 'Connecting'}
        </strong>
        <p>{statusNote}</p>
      </section>

      <dl className="sidebar-pane__metrics">
        <div>
          <dt>Conversation</dt>
          <dd>{conversationId ? shortId(conversationId) : 'pending'}</dd>
        </div>
        <div>
          <dt>Turns</dt>
          <dd>{userCount}</dd>
        </div>
        <div>
          <dt>Replies</dt>
          <dd>{assistantCount}</dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>{lastUpdate ? formatTime(lastUpdate) : '—'}</dd>
        </div>
      </dl>
    </aside>
  )
}
