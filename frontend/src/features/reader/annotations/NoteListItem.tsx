import { ExternalLink, Eye, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  highlightColorLabel,
  highlightColorValue,
} from '../highlights/highlight.utils'
import type { ReaderNote } from '../notes'
import { noteCanNavigate } from '../notes/note.utils'
import type { NoteAnnotationListItem } from './annotation.types'
import {
  noteLocationLabel,
  noteTypeLabel,
  noteWasEdited,
} from './annotation.utils'

type NoteListItemProps = {
  item: NoteAnnotationListItem
  deleting: boolean
  onNavigate: (note: ReaderNote) => void
  onView: (note: ReaderNote) => void
  onEdit: (note: ReaderNote) => void
  onDelete: (noteId: string) => Promise<void>
}

export function NoteListItem({
  item,
  deleting,
  onNavigate,
  onView,
  onEdit,
  onDelete,
}: NoteListItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { note, linkedHighlight } = item
  const location = noteLocationLabel(note)

  async function handleDelete() {
    try {
      await onDelete(note.id)
    } catch {
      // The notes hook keeps the error local and retryable.
    }
  }

  return (
    <article className="border-b border-sophia-border px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xs font-semibold text-sophia-primary">
            {noteTypeLabel(note)}
          </p>
          <p className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
            {location}
          </p>
        </div>
        {noteWasEdited(note) ? (
          <span className="shrink-0 rounded-full bg-sophia-bg px-2 py-1 text-[11px] font-semibold text-sophia-text-muted">
            Edited
          </span>
        ) : null}
      </div>

      {linkedHighlight ? (
        <p className="mb-0 mt-2 inline-flex items-center gap-2 text-xs capitalize text-sophia-text-muted">
          <span
            className="h-3 w-3 rounded-[2px] border border-sophia-border"
            style={{ backgroundColor: highlightColorValue(linkedHighlight.color) }}
            aria-hidden="true"
          />
          Attached to a {highlightColorLabel(linkedHighlight.color)} highlight
        </p>
      ) : null}

      {note.quote ? (
        <blockquote className="mb-0 mt-3 line-clamp-2 whitespace-pre-wrap border-l-2 border-sophia-border pl-3 text-xs italic leading-5 text-sophia-text-muted">
          “{note.quote}”
        </blockquote>
      ) : null}

      <p className="mb-0 mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-sophia-text">
        {note.content}
      </p>

      {confirmingDelete ? (
        <div className="mt-4 rounded-lg border border-rose-700/35 bg-rose-950/10 px-3 py-3">
          <p className="m-0 text-sm font-semibold">Delete this note?</p>
          <p className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
            Its source highlight will not be removed.
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
              aria-label={`Confirm delete ${noteTypeLabel(note).toLowerCase()}`}
            >
              {deleting ? 'Deleting' : 'Delete note'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => onView(note)}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View
          </button>
          {noteCanNavigate(note) ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={() => onNavigate(note)}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Go to source
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => onEdit(note)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${noteTypeLabel(note).toLowerCase()}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </article>
  )
}
