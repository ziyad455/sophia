import { ExternalLink, NotebookPen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ReaderHighlight } from '../highlights'
import {
  highlightMarkClass,
  isStructurallyUnresolved,
} from '../highlights/highlight.utils'
import type { ReaderNote } from '../notes'
import type { HighlightAnnotationListItem } from './annotation.types'
import { highlightLocationLabel } from './annotation.utils'

type HighlightListItemProps = {
  item: HighlightAnnotationListItem
  active: boolean
  deleting: boolean
  onNavigate: (highlight: ReaderHighlight) => void
  onAddNote: (highlight: ReaderHighlight) => void
  onViewNote: (note: ReaderNote) => void
  onDelete: (highlightId: string) => Promise<void>
}

export function HighlightListItem({
  item,
  active,
  deleting,
  onNavigate,
  onAddNote,
  onViewNote,
  onDelete,
}: HighlightListItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { highlight, attachedNotes, chapterTitle } = item
  const location = highlightLocationLabel(highlight, chapterTitle)
  const unresolved = isStructurallyUnresolved(highlight)

  async function handleDelete() {
    try {
      await onDelete(highlight.id)
    } catch {
      // The highlights hook keeps the error local and retryable.
    }
  }

  return (
    <article
      className={
        'border-b border-sophia-border px-4 py-4 ' +
        (active ? 'bg-sophia-bg' : '')
      }
      aria-current={active ? 'location' : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 h-4 w-1.5 shrink-0 rounded-full ${highlightMarkClass[highlight.color]}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-xs font-semibold capitalize text-sophia-primary">
            {highlight.color} highlight
          </p>
          <p className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
            {location}
          </p>
        </div>
      </div>

      <blockquote className="mb-0 mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-sophia-text">
        “{highlight.text}”
      </blockquote>

      {unresolved ? (
        <p className="mb-0 mt-2 text-xs leading-5 text-sophia-text-muted">
          Saved by page; an exact inline location is unavailable.
        </p>
      ) : null}

      {attachedNotes.length > 0 ? (
        <div
          className="mt-3 rounded-lg border border-sophia-border bg-sophia-bg/70"
          aria-label={`${attachedNotes.length} ${attachedNotes.length === 1 ? 'note' : 'notes'} attached to this highlight`}
        >
          <p className="m-0 border-b border-sophia-border px-3 py-2 text-xs font-semibold text-sophia-text-muted">
            {attachedNotes.length === 1
              ? 'Attached note'
              : `${attachedNotes.length} attached notes`}
          </p>
          {attachedNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-2 border-b border-sophia-border px-3 py-3 last:border-b-0"
            >
              <p className="m-0 min-w-0 flex-1 line-clamp-2 whitespace-pre-wrap text-sm leading-5 text-sophia-text">
                {note.content}
              </p>
              <button
                type="button"
                className="min-h-10 shrink-0 rounded-md px-2 text-xs font-semibold text-sophia-primary hover:bg-sophia-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                onClick={() => onViewNote(note)}
                aria-label={`View attached note from ${location}`}
              >
                View
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {confirmingDelete ? (
        <div className="mt-4 rounded-lg border border-rose-700/35 bg-rose-950/10 px-3 py-3">
          <p className="m-0 text-sm font-semibold">Delete this highlight?</p>
          <p className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
            Attached notes will remain as passage notes.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md bg-rose-700 px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-wait disabled:opacity-55"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-label={`Confirm delete highlight from ${location}`}
            >
              {deleting ? 'Deleting' : 'Delete highlight'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => onNavigate(highlight)}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Go to source
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => onAddNote(highlight)}
          >
            <NotebookPen className="h-4 w-4" aria-hidden="true" />
            Add note
          </button>
          <button
            type="button"
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete highlight from ${location}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </article>
  )
}
