import type { SyntheticEvent } from 'react'
import './Workspace.css'
import { formatTime, type ChatMessage } from '../../lib/chat'

type WorkspaceProps = {
  apiBase: string
  draft: string
  isSending: boolean
  messages: ChatMessage[]
  onDraftChange: (value: string) => void
  onNewSession: () => void
  onPresetSelect: (value: string) => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
  promptPresets: string[]
}

export function Workspace({
  apiBase,
  draft,
  isSending,
  messages,
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
          <button className="workspace-pane__button workspace-pane__button--ghost" type="button" onClick={onNewSession}>
            New session
          </button>
          <span className="workspace-pane__hint">API base: {apiBase}</span>
        </div>
      </header>

      <section className="workspace-pane__transcript" aria-label="Conversation transcript">
        {messages.length === 0 ? (
          <div className="workspace-pane__empty">
            <h3>The transcript is empty.</h3>
            <p>Start with one of the prompts on the right, or write your own line below.</p>
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
              <p>{message.content}</p>
            </article>
          ))
        )}
      </section>

      <form className="workspace-pane__composer" onSubmit={onSubmit}>
        <label className="workspace-pane__label" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Type your message here..."
          rows={4}
        />

        <div className="workspace-pane__footer">
          <div className="workspace-pane__chips" aria-label="Prompt presets">
            {promptPresets.map((prompt) => (
              <button key={prompt} className="workspace-pane__chip" type="button" onClick={() => onPresetSelect(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <button className="workspace-pane__button" type="submit" disabled={isSending || draft.trim().length === 0}>
            {isSending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    </section>
  )
}
