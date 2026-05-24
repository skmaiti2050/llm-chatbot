import './NotesPanel.css'
import { promptPresets } from '../../lib/chat'

type NotesPanelProps = {
  onPresetSelect: (value: string) => void
}

export function NotesPanel({ onPresetSelect }: NotesPanelProps) {
  return (
    <aside className="notes-pane">
      <div className="notes-pane__block">
        <span className="notes-pane__eyebrow">Session notes</span>
        <h3>Working rules</h3>
        <ul>
          <li>Keep the transcript compact and easy to scan.</li>
          <li>Use the backend when it is available.</li>
          <li>Fall back to a local preview when it is not.</li>
        </ul>
      </div>

      <div className="notes-pane__block">
        <span className="notes-pane__eyebrow">Prompt rack</span>
        <h3>Useful angles</h3>
        <div className="notes-pane__stack">
          <button className="notes-pane__card" type="button" onClick={() => onPresetSelect(promptPresets[0])}>
            Short summary
          </button>
          <button className="notes-pane__card" type="button" onClick={() => onPresetSelect(promptPresets[1])}>
            Anomaly check
          </button>
          <button className="notes-pane__card" type="button" onClick={() => onPresetSelect(promptPresets[2])}>
            Team update
          </button>
        </div>
      </div>
    </aside>
  )
}
