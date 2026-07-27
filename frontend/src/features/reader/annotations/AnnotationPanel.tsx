import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FileText,
  List,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import type { ReaderChapter } from '../../../books'
import type { ReaderHighlight } from '../highlights'
import {
  highlightColorLabel,
  highlightColorValue,
} from '../highlights/highlight.utils'
import type { ReaderNote } from '../notes'
import { noteCanNavigate } from '../notes/note.utils'
import { AnnotationList } from './AnnotationList'
import { AnnotationTabs } from './AnnotationTabs'
import type { AnnotationTab } from './annotation.types'
import {
  createAnnotationItems,
  formatAnnotationDate,
  noteLocationLabel,
  noteTypeLabel,
  noteWasEdited,
} from './annotation.utils'

type AnnotationsTriggerProps = {
  count: number
  hasError: boolean
  className?: string
  onClick: () => void
}

export function AnnotationsTrigger({
  count,
  hasError,
  className = '',
  onClick,
}: AnnotationsTriggerProps) {
  return (
    <button
      type="button"
      className={
        'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary ' +
        className
      }
      onClick={onClick}
      aria-label={`Open annotations${count > 0 ? `, ${count} saved` : ''}`}
      title="Annotations"
    >
      <List className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">Annotations</span>
      {count > 0 ? (
        <span className="min-w-5 rounded-full bg-sophia-primary px-1.5 text-center text-[10px] font-bold leading-5 text-sophia-bg">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
      {hasError ? (
        <span
          className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500"
          aria-hidden="true"
        />
      ) : null}
    </button>
  )
}

type AnnotationPanelProps = {
  isOpen: boolean
  activeTab: AnnotationTab
  selectedNoteId: string | null
  highlights: ReaderHighlight[]
  notes: ReaderNote[]
  chapters: ReaderChapter[]
  currentPage: number
  currentChapter: ReaderChapter | null
  activeHighlightId: string | null
  highlightsLoading: boolean
  notesLoading: boolean
  highlightsError: string | null
  notesError: string | null
  deletingHighlightIds: Set<string>
  deletingNoteIds: Set<string>
  onClose: () => void
  onSelectTab: (tab: AnnotationTab) => void
  onSelectNote: (noteId: string | null) => void
  onRetryHighlights: () => void
  onRetryNotes: () => void
  onNavigateHighlight: (highlight: ReaderHighlight) => void
  onNavigateNote: (note: ReaderNote) => void
  onAddHighlightNote: (highlight: ReaderHighlight) => void
  onAddPageNote: () => void
  onAddChapterNote: () => void
  onAddBookNote: () => void
  onEditNote: (note: ReaderNote) => void
  onDeleteHighlight: (highlightId: string) => Promise<void>
  onDeleteNote: (noteId: string) => Promise<void>
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type SourceErrorProps = {
  message: string
  retryLabel: string
  onRetry: () => void
}

function SourceError({ message, retryLabel, onRetry }: SourceErrorProps) {
  return (
    <div
      className="flex items-center gap-3 border-b border-sophia-border px-4 py-3 text-sm"
      role="status"
    >
      <p className="m-0 min-w-0 flex-1 text-sophia-text-muted">{message}</p>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
        onClick={onRetry}
        aria-label={retryLabel}
        title="Retry"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function AnnotationPanel({
  isOpen,
  activeTab,
  selectedNoteId,
  highlights,
  notes,
  chapters,
  currentPage,
  currentChapter,
  activeHighlightId,
  highlightsLoading,
  notesLoading,
  highlightsError,
  notesError,
  deletingHighlightIds,
  deletingNoteIds,
  onClose,
  onSelectTab,
  onSelectNote,
  onRetryHighlights,
  onRetryNotes,
  onNavigateHighlight,
  onNavigateNote,
  onAddHighlightNote,
  onAddPageNote,
  onAddChapterNote,
  onAddBookNote,
  onEditNote,
  onDeleteHighlight,
  onDeleteNote,
}: AnnotationPanelProps) {
  const [addNoteMenuOpen, setAddNoteMenuOpen] = useState(false)
  const [confirmingDetailDelete, setConfirmingDetailDelete] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const items = useMemo(
    () => createAnnotationItems(activeTab, highlights, notes, chapters),
    [activeTab, chapters, highlights, notes],
  )
  const selectedNote = selectedNoteId
    ? notes.find((note) => note.id === selectedNoteId) ?? null
    : null
  const selectedLinkedHighlight = selectedNote?.highlightId
    ? highlights.find((highlight) => highlight.id === selectedNote.highlightId) ?? null
    : null
  const selectedUpdatedDate = selectedNote
    ? formatAnnotationDate(selectedNote.updatedAt)
    : ''

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null
    setAddNoteMenuOpen(false)
    setConfirmingDetailDelete(false)
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(frame)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedNoteId && !selectedNote && !notesLoading) {
      onSelectNote(null)
    }
  }, [notesLoading, onSelectNote, selectedNote, selectedNoteId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null

      if (target?.closest('[data-note-editor], [data-note-surface]')) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()

        if (addNoteMenuOpen) {
          setAddNoteMenuOpen(false)
        } else if (selectedNoteId) {
          onSelectNote(null)
          setConfirmingDetailDelete(false)
        } else {
          onClose()
        }
        return
      }

      if (
        event.key !== 'Tab' ||
        !panelRef.current ||
        !target ||
        !panelRef.current.contains(target)
      ) {
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
  }, [addNoteMenuOpen, isOpen, onClose, onSelectNote, selectedNoteId])

  if (!isOpen) {
    return null
  }

  function handleNavigateHighlight(highlight: ReaderHighlight) {
    onNavigateHighlight(highlight)
    onClose()
  }

  function handleNavigateNote(note: ReaderNote) {
    onNavigateNote(note)
    onClose()
  }

  function chooseContextNote(action: () => void) {
    setAddNoteMenuOpen(false)
    action()
  }

  async function handleDetailDelete(noteId: string) {
    try {
      await onDeleteNote(noteId)
      onSelectNote(null)
      setConfirmingDetailDelete(false)
    } catch {
      panelRef.current?.focus()
    }
  }

  const showHighlightsError = highlightsError
  const showNotesError = notesError

  return (
    <div className="fixed inset-0 z-[60]" data-annotations-surface>
      <div
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Annotations for this book"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-sophia-border bg-sophia-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-sophia-text shadow-2xl focus:outline-none sm:w-[min(94vw,400px)]"
      >
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-sophia-border px-3">
          {selectedNote ? (
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={() => {
                onSelectNote(null)
                setConfirmingDetailDelete(false)
              }}
              aria-label="Back to annotations"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <List className="ml-1 h-4 w-4 shrink-0 text-sophia-primary" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="m-0 truncate text-sm font-semibold">Annotations</h2>
            {selectedNote ? (
              <p className="m-0 truncate text-xs text-sophia-text-muted">
                {noteTypeLabel(selectedNote)}
              </p>
            ) : (
              <p className="m-0 text-xs text-sophia-text-muted">
                {highlights.length + notes.length} total
              </p>
            )}
          </div>
          {!selectedNote ? (
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={() => setAddNoteMenuOpen((open) => !open)}
              aria-expanded={addNoteMenuOpen}
              aria-controls="annotations-add-note-options"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add note
            </button>
          ) : null}
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={onClose}
            aria-label="Close annotations"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {!selectedNote ? (
          <>
            {addNoteMenuOpen ? (
              <div
                id="annotations-add-note-options"
                className="border-b border-sophia-border bg-sophia-bg/60 px-3 py-3"
                aria-label="Add note about"
              >
                <p className="m-0 px-2 text-xs font-semibold text-sophia-text-muted">
                  Add note about
                </p>
                <div className="mt-2 grid gap-1">
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-sophia-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={() => chooseContextNote(onAddPageNote)}
                  >
                    <FileText className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
                    Current page
                    <span className="ml-auto text-xs text-sophia-text-muted">
                      {currentPage}
                    </span>
                  </button>
                  {currentChapter ? (
                    <button
                      type="button"
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-sophia-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                      onClick={() => chooseContextNote(onAddChapterNote)}
                    >
                      <BookOpen className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">Current chapter</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-sophia-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={() => chooseContextNote(onAddBookNote)}
                  >
                    <NotebookPen className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
                    This book
                  </button>
                </div>
              </div>
            ) : null}

            <AnnotationTabs
              activeTab={activeTab}
              highlightCount={highlights.length}
              noteCount={notes.length}
              onChange={onSelectTab}
            />

            {showHighlightsError ? (
              <SourceError
                message={showHighlightsError}
                retryLabel="Retry loading highlights"
                onRetry={onRetryHighlights}
              />
            ) : null}
            {showNotesError ? (
              <SourceError
                message={showNotesError}
                retryLabel="Retry loading notes"
                onRetry={onRetryNotes}
              />
            ) : null}

            <AnnotationList
              tab={activeTab}
              items={items}
              highlightsLoading={highlightsLoading}
              notesLoading={notesLoading}
              highlightsError={highlightsError}
              notesError={notesError}
              activeHighlightId={activeHighlightId}
              deletingHighlightIds={deletingHighlightIds}
              deletingNoteIds={deletingNoteIds}
              onNavigateHighlight={handleNavigateHighlight}
              onAddHighlightNote={onAddHighlightNote}
              onNavigateNote={handleNavigateNote}
              onViewNote={(note) => onSelectNote(note.id)}
              onEditNote={onEditNote}
              onDeleteHighlight={onDeleteHighlight}
              onDeleteNote={onDeleteNote}
            />
          </>
        ) : (
          <article className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-xs font-semibold text-sophia-primary">
                  {noteTypeLabel(selectedNote)}
                </p>
                <p className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
                  {noteLocationLabel(selectedNote)}
                </p>
              </div>
              {noteWasEdited(selectedNote) ? (
                <span className="shrink-0 rounded-full bg-sophia-bg px-2 py-1 text-[11px] font-semibold text-sophia-text-muted">
                  Edited
                </span>
              ) : null}
            </div>

            {selectedLinkedHighlight ? (
              <p className="mb-0 mt-3 inline-flex items-center gap-2 text-xs capitalize text-sophia-text-muted">
                <span
                  className="h-3 w-3 rounded-[2px] border border-sophia-border"
                  style={{
                    backgroundColor: highlightColorValue(selectedLinkedHighlight.color),
                  }}
                  aria-hidden="true"
                />
                Attached to a {highlightColorLabel(selectedLinkedHighlight.color)} highlight
              </p>
            ) : null}

            {selectedNote.quote ? (
              <blockquote className="m-0 mt-4 rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 whitespace-pre-wrap text-sm leading-6 text-sophia-text-muted">
                “{selectedNote.quote}”
              </blockquote>
            ) : null}

            <p className="mb-0 mt-5 whitespace-pre-wrap text-base leading-7">
              {selectedNote.content}
            </p>

            {selectedUpdatedDate ? (
              <p className="mb-0 mt-5 text-xs text-sophia-text-muted">
                {noteWasEdited(selectedNote) ? 'Updated' : 'Saved'} {selectedUpdatedDate}
              </p>
            ) : null}

            <div className="mt-auto border-t border-sophia-border pt-5">
              {confirmingDetailDelete ? (
                <div className="rounded-lg border border-rose-700/35 bg-rose-950/10 px-3 py-3">
                  <p className="m-0 text-sm font-semibold">Delete this note?</p>
                  <p className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
                    Its source highlight will not be removed.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                      onClick={() => setConfirmingDetailDelete(false)}
                      disabled={deletingNoteIds.has(selectedNote.id)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-md bg-rose-700 px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-wait disabled:opacity-55"
                      onClick={() => void handleDetailDelete(selectedNote.id)}
                      disabled={deletingNoteIds.has(selectedNote.id)}
                      aria-label="Confirm delete note"
                    >
                      {deletingNoteIds.has(selectedNote.id) ? 'Deleting' : 'Delete note'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-1">
                  {noteCanNavigate(selectedNote) ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                      onClick={() => handleNavigateNote(selectedNote)}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Go to source
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={() => onEditNote(selectedNote)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={() => setConfirmingDetailDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </article>
        )}
      </aside>
    </div>
  )
}
