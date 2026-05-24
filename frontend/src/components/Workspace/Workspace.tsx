import type { SyntheticEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './Workspace.css'
import { formatTime, type ChatMessage, type ConversationStatus } from '../../lib/chat'

type WorkspaceProps = {
  apiBase: string
  conversationStatus: ConversationStatus
  draft: string
  isSending: boolean
  messages: ChatMessage[]
  onCancelConversation: () => void
  onDeleteConversation: () => void
  onDraftChange: (value: string) => void
  onNewSession: () => void
  onPresetSelect: (value: string) => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
  promptPresets: string[]
}

export function Workspace({
  apiBase,
  conversationStatus,
  draft,
  isSending,
  messages,
  onCancelConversation,
  onDeleteConversation,
  onDraftChange,
  onNewSession,
  onPresetSelect,
  onSubmit,
  promptPresets,
}: WorkspaceProps) {
  return (
    <section className="workspace-pane">
      <header className="workspace-pane__header">
        <div>
          <span className="workspace-pane__eyebrow">Current session</span>
          <h2>Welcome to the AI Chat Assistant.</h2>
        </div>

        <div className="workspace-pane__actions">
          {conversationStatus === 'active' && (
            <button className="workspace-pane__action-btn" type="button" onClick={onCancelConversation}>
              Cancel
            </button>
          )}
          <button className="workspace-pane__action-btn workspace-pane__action-btn--danger" type="button" onClick={onDeleteConversation}>
            Delete
          </button>
          <span className="workspace-pane__hint">API base: {apiBase}</span>
        </div>
      </header>

      <section className="workspace-pane__transcript" aria-label="Conversation transcript">
        {messages.length === 0 ? (
          <div className="workspace-pane__empty">
            <h3>The transcript is empty.</h3>
            <p>Start with one of the prompts below, or write your own message.</p>
            <div className="workspace-pane__chips" aria-label="Prompt presets">
              {promptPresets.map((prompt) => (
                <button key={prompt} className="workspace-pane__chip" type="button" onClick={() => { if (conversationStatus !== 'active') return; onPresetSelect(prompt) }} disabled={conversationStatus !== 'active'}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`workspace-pane__message workspace-pane__message--${message.role}`}
              aria-label={`${message.role} message`}
            >
              <div className="workspace-pane__meta">
                <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              </div>
              {message.role === 'assistant' ? (
                <div className="workspace-pane__body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </article>
          ))
        )}

        {isSending && (
          <article className="workspace-pane__message workspace-pane__message--assistant workspace-pane__message--typing" aria-label="Assistant is typing">
            <div className="workspace-pane__meta">
              <span>Assistant</span>
            </div>
            <div className="workspace-pane__typing">
              <span className="workspace-pane__dot" />
              <span className="workspace-pane__dot" />
              <span className="workspace-pane__dot" />
            </div>
          </article>
        )}
      </section>

      <form className="workspace-pane__composer" onSubmit={onSubmit}>
        <label className="workspace-pane__label" htmlFor="message">
          Message
        </label>
        <div className="workspace-pane__input-wrapper">
          <textarea
            id="message"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                document.getElementById('workspace-submit')?.click()
              }
            }}
            placeholder={conversationStatus !== 'active' ? `Conversation is ${conversationStatus}` : 'Type your message here…'}
            rows={1}
            disabled={conversationStatus !== 'active'}
          />
          <button id="workspace-submit" className="workspace-pane__button--overlay" type="submit" disabled={isSending || draft.trim().length === 0 || conversationStatus !== 'active'}>
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
