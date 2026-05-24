import './Sidebar.css'
import { formatTime, shortId, type ConnectionState, type ConversationSummary } from '../../lib/chat'

type SidebarProps = {
  activeConversationId: string
  assistantCount: number
  connectionState: ConnectionState
  conversations: ConversationSummary[]
  isLoadingConversations: boolean
  lastUpdate?: string
  onDeleteConversation: (id: string) => void
  onNewConversation: () => void
  onSelectConversation: (id: string) => void
  statusNote: string
  userCount: number
}

export function Sidebar({
  activeConversationId,
  assistantCount,
  connectionState,
  conversations,
  isLoadingConversations,
  lastUpdate,
  onDeleteConversation,
  onNewConversation,
  onSelectConversation,
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

      <section className="sidebar-pane__list">
        <div className="sidebar-pane__list-header">
          <span className="sidebar-pane__label">History</span>
          {connectionState === 'online' && (
            <button className="sidebar-pane__new-btn" type="button" onClick={onNewConversation}>
              + New
            </button>
          )}
        </div>

        {isLoadingConversations && <p className="sidebar-pane__list-empty">Loading…</p>}

        {!isLoadingConversations && conversations.length === 0 && connectionState === 'online' && (
          <p className="sidebar-pane__list-empty">No conversations yet.</p>
        )}

        {connectionState === 'offline' && (
          <p className="sidebar-pane__list-empty">Unavailable offline.</p>
        )}

        {conversations.length > 0 && (
          <ul className="sidebar-pane__items">
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId

              return (
                <li key={conv.id}>
                  <div
                    className={`sidebar-pane__item${isActive ? ' sidebar-pane__item--active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={isActive ? undefined : () => onSelectConversation(conv.id)}
                    onKeyDown={isActive ? undefined : (e) => { if (e.key === 'Enter') onSelectConversation(conv.id) }}
                  >
                    <span className="sidebar-pane__item-id">{shortId(conv.id)}</span>
                    <span className={`sidebar-pane__item-badge sidebar-pane__item-badge--${conv.status}`}>
                      {conv.status}
                    </span>
                    <time className="sidebar-pane__item-time">{formatTime(conv.createdAt)}</time>
                    <button
                      className="sidebar-pane__item-delete"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id) }}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <dl className="sidebar-pane__metrics">
        <div>
          <dt>Conversation</dt>
          <dd>{activeConversationId ? shortId(activeConversationId) : 'pending'}</dd>
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
