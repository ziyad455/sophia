import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  NotebookPen,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import type { ReaderNote } from './note.types'
import {
  noteCanNavigate,
  noteSourceLabel,
} from './note.utils'

type NotesPanelProps = {
  isOpen: boolean
  notes: ReaderNote[]
  initialNoteId: string | null
  loading: boolean
  error: string | null
  deletingIds: Set<string>
  onClose: () => void
  onRetry: () => void
  onNavigate: (note: ReaderNote) => void
  onEdit: (note: ReaderNote) => void
  onDelete: (noteId: string) => Promise<void>
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function formatUpdatedAt(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export function NotesPanel({
  isOpen,
  notes,
  initialNoteId,
  loading,
  error,
  deletingIds,
  onClose,
  onRetry,
  onNavigate,
  onEdit,
  onDelete,
}: NotesPanelProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const selectedNoteIdRef = useRef<string | null>(null)
  const selectedNote =
    notes.find((note) => note.id === selectedNoteId) ?? null

  selectedNoteIdRef.current = selectedNoteId

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null
    setSelectedNoteId(initialNoteId)
    setConfirmDeleteId(null)
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(frame)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [initialNoteId, isOpen])

  useEffect(() => {
    if (selectedNoteId && !selectedNote) {
      setSelectedNoteId(null)
      setConfirmDeleteId(null)
    }
  }, [selectedNote, selectedNoteId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()

        if (selectedNoteIdRef.current) {
          setSelectedNoteId(null)
          setConfirmDeleteId(null)
        } else {
          onClose()
        }
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return
      }

      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ]

      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  async function handleDelete(noteId: string) {
    try {
      await onDelete(noteId)
      setSelectedNoteId(null)
      setConfirmDeleteId(null)
    } catch {
      panelRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" data-note-surface>
      <div
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Private notes"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-sophia-border bg-sophia-surface text-sophia-text shadow-2xl focus:outline-none sm:w-[min(92vw,420px)]"
      >
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-sophia-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            {selectedNote ? (
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                onClick={() => {
                  setSelectedNoteId(null)
                  setConfirmDeleteId(null)
                }}
                aria-label="Back to notes"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <NotebookPen className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
            )}
            <h2 className="m-0 truncate text-sm font-semibold">
              {selectedNote ? noteSourceLabel(selectedNote) : 'Your notes'}
            </h2>
            {!selectedNote ? (
              <span className="text-xs text-sophia-text-muted">{notes.length}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={onClose}
            aria-label="Close notes"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {error ? (
          <div
            className="flex items-center gap-3 border-b border-sophia-border px-4 py-3 text-sm"
            role="status"
          >
            <p className="m-0 min-w-0 flex-1 text-sophia-text-muted">{error}</p>
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={onRetry}
              aria-label="Retry loading notes"
              title="Retry"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {selectedNote ? (
          <article className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
            {selectedNote.quote ? (
              <blockquote className="m-0 rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 text-sm leading-6 text-sophia-text-muted">
                “{selectedNote.quote}”
              </blockquote>
            ) : null}

            <p className="mb-0 mt-5 whitespace-pre-wrap text-base leading-7">
              {selectedNote.content}
            </p>

            <p className="mb-0 mt-5 text-xs text-sophia-text-muted">
              Updated {formatUpdatedAt(selectedNote.updatedAt)}
            </p>

            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-sophia-border pt-5">
              {noteCanNavigate(selectedNote) ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                  onClick={() => onNavigate(selectedNote)}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Go to source
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                onClick={() => onEdit(selectedNote)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
              {confirmDeleteId === selectedNote.id ? (
                <>
                  <button
                    type="button"
                    className="min-h-11 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-rose-700 px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:opacity-55"
                    onClick={() => void handleDelete(selectedNote.id)}
                    disabled={deletingIds.has(selectedNote.id)}
                    aria-label="Confirm delete note"
                  >
                    {deletingIds.has(selectedNote.id) ? 'Deleting' : 'Delete note'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                  onClick={() => setConfirmDeleteId(selectedNote.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </button>
              )}
            </div>
          </article>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && notes.length === 0 ? (
              <p className="m-0 px-5 py-8 text-center text-sm text-sophia-text-muted" role="status">
                Opening your notes...
              </p>
            ) : null}

            {!loading && notes.length === 0 ? (
              <div className="px-7 py-14 text-center">
                <p className="m-0 text-sm font-semibold">
                  Your reflections will appear here.
                </p>
                <p className="mt-2 text-sm leading-6 text-sophia-text-muted">
                  Select a passage and save a thought when something matters.
                </p>
              </div>
            ) : null}

            {notes.map((note) => (
              <article key={note.id} className="border-b border-sophia-border">
                <button
                  type="button"
                  className="block min-h-24 w-full px-5 py-4 text-left hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sophia-primary"
                  onClick={() => {
                    setSelectedNoteId(note.id)
                    setConfirmDeleteId(null)
                  }}
                >
                  <p className="m-0 text-xs font-semibold text-sophia-primary">
                    {noteSourceLabel(note)}
                  </p>
                  <p className="mb-0 mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-sophia-text">
                    {note.content}
                  </p>
                </button>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
