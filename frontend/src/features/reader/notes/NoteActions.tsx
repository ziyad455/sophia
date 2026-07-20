import { useEffect } from 'react'
import { NotebookPen, X } from 'lucide-react'
import type { ReaderHighlight } from '../highlights'

type HighlightNoteActionsProps = {
  highlight: ReaderHighlight
  noteCount: number
  onAddNote: () => void
  onOpenNotes: () => void
  onClose: () => void
}

export function HighlightNoteActions({
  highlight,
  noteCount,
  onAddNote,
  onOpenNotes,
  onClose,
}: HighlightNoteActionsProps) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }

    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [onClose])

  return (
    <section
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(94vw,440px)] -translate-x-1/2 rounded-xl border border-sophia-border bg-sophia-surface p-3 text-sophia-text shadow-2xl"
      aria-label="Highlight actions"
      data-note-surface
    >
      <div className="flex items-start gap-3">
        <blockquote className="m-0 min-w-0 flex-1 line-clamp-2 text-sm leading-5">
          “{highlight.text}”
        </blockquote>
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
          onClick={onClose}
          aria-label="Close highlight actions"
          title="Close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-sophia-border pt-3">
        {noteCount > 0 ? (
          <button
            type="button"
            className="min-h-11 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={onOpenNotes}
          >
            View {noteCount === 1 ? 'note' : noteCount + ' notes'}
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-sophia-primary px-4 text-sm font-bold text-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
          onClick={onAddNote}
        >
          <NotebookPen className="h-4 w-4" aria-hidden="true" />
          Add note
        </button>
      </div>
    </section>
  )
}
