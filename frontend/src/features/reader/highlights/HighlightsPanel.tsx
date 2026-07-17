import { useEffect, useRef } from 'react'
import { Highlighter, RotateCcw, Trash2, X } from 'lucide-react'
import type { ReaderChapter } from '../../../books'
import type { ReaderHighlight } from './highlight.types'
import { highlightMarkClass, isStructurallyUnresolved } from './highlight.utils'

type HighlightsTriggerProps = {
  count: number
  hasError: boolean
  onClick: () => void
}

export function HighlightsTrigger({ count, hasError, onClick }: HighlightsTriggerProps) {
  return (
    <button
      type="button"
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
      onClick={onClick}
      aria-label={`Open highlights${count > 0 ? `, ${count} saved` : ''}`}
      title="Highlights"
    >
      <Highlighter className="h-4 w-4" aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-sophia-primary px-1 text-center text-[10px] font-bold leading-4 text-sophia-bg">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
      {hasError ? (
        <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
      ) : null}
    </button>
  )
}

type HighlightsPanelProps = {
  isOpen: boolean
  highlights: ReaderHighlight[]
  chapters: ReaderChapter[]
  activeHighlightId: string | null
  loading: boolean
  error: string | null
  deletingIds: Set<string>
  onClose: () => void
  onRetry: () => void
  onNavigate: (highlight: ReaderHighlight) => void
  onDelete: (highlightId: string) => Promise<void>
}

function locationLabel(highlight: ReaderHighlight, chapters: ReaderChapter[]): string {
  const chapter = highlight.chapterId
    ? chapters.find((candidate) => candidate.id === highlight.chapterId)
    : null
  const page = highlight.pageStart === highlight.pageEnd
    ? `Page ${highlight.pageStart}`
    : `Pages ${highlight.pageStart}-${highlight.pageEnd}`

  return chapter?.title ? `${chapter.title} · ${page}` : page
}

export function HighlightsPanel({
  isOpen,
  highlights,
  chapters,
  activeHighlightId,
  loading,
  error,
  deletingIds,
  onClose,
  onRetry,
  onNavigate,
  onDelete,
}: HighlightsPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  async function handleDelete(highlightId: string) {
    try {
      await onDelete(highlightId)
    } catch {
      // The hook keeps the failed mutation visible without dismissing the panel.
    } finally {
      panelRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Saved highlights"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[min(92vw,380px)] flex-col border-l border-sophia-border bg-sophia-surface text-sophia-text shadow-2xl focus:outline-none"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-sophia-border px-4">
          <div className="flex items-center gap-2">
            <Highlighter className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
            <h2 className="m-0 text-sm font-semibold">Highlights</h2>
            <span className="text-xs text-sophia-text-muted">{highlights.length}</span>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={onClose}
            aria-label="Close highlights"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {error ? (
          <div className="flex items-center gap-3 border-b border-sophia-border px-4 py-3 text-sm" role="status">
            <p className="m-0 min-w-0 flex-1 text-sophia-text-muted">{error}</p>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={onRetry}
              aria-label="Retry loading highlights"
              title="Retry"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="m-0 px-5 py-8 text-center text-sm text-sophia-text-muted" role="status">
              Opening your highlights...
            </p>
          ) : null}

          {!loading && highlights.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="m-0 text-sm font-semibold">No passages highlighted yet.</p>
              <p className="mt-2 text-sm leading-6 text-sophia-text-muted">
                Select a passage while reading to keep it close.
              </p>
            </div>
          ) : null}

          {highlights.map((highlight) => {
            const deleting = deletingIds.has(highlight.id)
            const unresolved = isStructurallyUnresolved(highlight)

            return (
              <article
                key={highlight.id}
                className={`border-b border-sophia-border px-4 py-4 ${activeHighlightId === highlight.id ? 'bg-sophia-bg' : ''}`}
                aria-current={activeHighlightId === highlight.id ? 'location' : undefined}
              >
                <button
                  type="button"
                  className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                  onClick={() => onNavigate(highlight)}
                >
                  <blockquote className="m-0 line-clamp-4 text-sm leading-6 text-sophia-text">
                    “{highlight.text}”
                  </blockquote>
                  <p className="mb-0 mt-2 text-xs text-sophia-text-muted">
                    {locationLabel(highlight, chapters)}
                  </p>
                  {unresolved ? (
                    <p className="mb-0 mt-1 text-xs text-sophia-text-muted">
                      Saved by page; inline location unavailable.
                    </p>
                  ) : null}
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs capitalize text-sophia-text-muted">
                    <span
                      className={`h-3 w-3 rounded-[2px] border border-sophia-border ${highlightMarkClass[highlight.color]}`}
                      aria-hidden="true"
                    />
                    {highlight.color}
                  </span>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-wait disabled:opacity-50"
                    onClick={() => void handleDelete(highlight.id)}
                    disabled={deleting}
                    aria-label={`Delete highlight: ${highlight.text}`}
                    title="Delete highlight"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
