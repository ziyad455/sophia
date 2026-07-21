import type { ReaderHighlight } from '../highlights'
import type { ReaderNote } from '../notes'
import { HighlightListItem } from './HighlightListItem'
import { NoteListItem } from './NoteListItem'
import type { AnnotationListItem, AnnotationTab } from './annotation.types'

type AnnotationListProps = {
  tab: AnnotationTab
  items: AnnotationListItem[]
  highlightsLoading: boolean
  notesLoading: boolean
  highlightsError: string | null
  notesError: string | null
  activeHighlightId: string | null
  deletingHighlightIds: Set<string>
  deletingNoteIds: Set<string>
  onNavigateHighlight: (highlight: ReaderHighlight) => void
  onAddHighlightNote: (highlight: ReaderHighlight) => void
  onNavigateNote: (note: ReaderNote) => void
  onViewNote: (note: ReaderNote) => void
  onEditNote: (note: ReaderNote) => void
  onDeleteHighlight: (highlightId: string) => Promise<void>
  onDeleteNote: (noteId: string) => Promise<void>
}

function emptyMessage(tab: AnnotationTab) {
  if (tab === 'highlights') {
    return (
      <p className="m-0 text-sm font-semibold">No highlights yet.</p>
    )
  }

  if (tab === 'notes') {
    return <p className="m-0 text-sm font-semibold">No notes yet.</p>
  }

  return (
    <>
      <p className="m-0 text-sm font-semibold">No annotations yet.</p>
      <p className="mb-0 mt-2 text-sm leading-6 text-sophia-text-muted">
        Select a passage to highlight it or add a note.
      </p>
    </>
  )
}

export function AnnotationList({
  tab,
  items,
  highlightsLoading,
  notesLoading,
  highlightsError,
  notesError,
  activeHighlightId,
  deletingHighlightIds,
  deletingNoteIds,
  onNavigateHighlight,
  onAddHighlightNote,
  onNavigateNote,
  onViewNote,
  onEditNote,
  onDeleteHighlight,
  onDeleteNote,
}: AnnotationListProps) {
  const loading = tab === 'all'
    ? highlightsLoading || notesLoading
    : tab === 'highlights'
      ? highlightsLoading
      : notesLoading
  const hasError = tab === 'all'
    ? Boolean(highlightsError || notesError)
    : tab === 'highlights'
      ? Boolean(highlightsError)
      : Boolean(notesError)

  return (
    <div
      id={`annotations-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`annotations-tab-${tab}`}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
    >
      {items.length === 0 && loading ? (
        <p
          className="m-0 px-5 py-8 text-center text-sm text-sophia-text-muted"
          role="status"
        >
          Opening your annotations...
        </p>
      ) : null}

      {items.length === 0 && !loading && !hasError ? (
        <div className="px-7 py-14 text-center">
          {emptyMessage(tab)}
        </div>
      ) : null}

      {items.map((item) => item.kind === 'highlight' ? (
        <HighlightListItem
          key={`highlight-${item.id}`}
          item={item}
          active={item.id === activeHighlightId}
          deleting={deletingHighlightIds.has(item.id)}
          onNavigate={onNavigateHighlight}
          onAddNote={onAddHighlightNote}
          onViewNote={onViewNote}
          onDelete={onDeleteHighlight}
        />
      ) : (
        <NoteListItem
          key={`note-${item.id}`}
          item={item}
          deleting={deletingNoteIds.has(item.id)}
          onNavigate={onNavigateNote}
          onView={onViewNote}
          onEdit={onEditNote}
          onDelete={onDeleteNote}
        />
      ))}
    </div>
  )
}
