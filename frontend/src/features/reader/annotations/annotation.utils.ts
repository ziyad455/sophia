import type { ReaderChapter } from '../../../books'
import type { ReaderHighlight } from '../highlights'
import type { ReaderNote } from '../notes'
import type {
  AnnotationListItem,
  AnnotationTab,
  HighlightAnnotationListItem,
  NoteAnnotationListItem,
} from './annotation.types'

function pageRangeLabel(pageStart: number, pageEnd: number): string {
  return pageStart === pageEnd
    ? `Page ${pageStart}`
    : `Pages ${pageStart}–${pageEnd}`
}

export function highlightLocationLabel(
  highlight: ReaderHighlight,
  chapterTitle: string | null,
): string {
  const pages = pageRangeLabel(highlight.pageStart, highlight.pageEnd)

  return chapterTitle ? `${chapterTitle} · ${pages}` : pages
}

export function noteTypeLabel(note: ReaderNote): string {
  if (note.context === 'highlight') return 'Highlight note'
  if (note.context === 'passage') return 'Passage note'
  if (note.context === 'page') return 'Page note'
  if (note.context === 'chapter') return 'Chapter note'
  return 'Book note'
}

export function noteLocationLabel(note: ReaderNote): string {
  if (note.context === 'book') {
    return 'This book'
  }

  if (note.pageStart === null) {
    return note.chapterTitle ?? 'Source unavailable'
  }

  const pages = pageRangeLabel(note.pageStart, note.pageEnd ?? note.pageStart)

  return note.chapterTitle ? `${note.chapterTitle} · ${pages}` : pages
}

export function noteWasEdited(note: ReaderNote): boolean {
  const createdAt = Date.parse(note.createdAt)
  const updatedAt = Date.parse(note.updatedAt)

  return Number.isFinite(createdAt) &&
    Number.isFinite(updatedAt) &&
    updatedAt - createdAt > 1_000
}

export function formatAnnotationDate(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

function compareAnnotationItems(
  left: AnnotationListItem,
  right: AnnotationListItem,
): number {
  const leftHasPage = left.pageStart !== null
  const rightHasPage = right.pageStart !== null

  if (leftHasPage !== rightHasPage) {
    return leftHasPage ? 1 : -1
  }

  return (left.pageStart ?? 0) - (right.pageStart ?? 0) ||
    (left.sourceOffset ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceOffset ?? Number.MAX_SAFE_INTEGER) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
}

export function createAnnotationItems(
  tab: AnnotationTab,
  highlights: ReaderHighlight[],
  notes: ReaderNote[],
  chapters: ReaderChapter[],
): AnnotationListItem[] {
  const chapterTitles = new Map(
    chapters.map((chapter) => [chapter.id, chapter.title] as const),
  )
  const highlightsById = new Map(
    highlights.map((highlight) => [highlight.id, highlight] as const),
  )
  const notesByHighlightId = new Map<string, ReaderNote[]>()

  for (const note of notes) {
    if (!note.highlightId || !highlightsById.has(note.highlightId)) {
      continue
    }

    const attached = notesByHighlightId.get(note.highlightId) ?? []

    attached.push(note)
    notesByHighlightId.set(note.highlightId, attached)
  }

  const highlightItems: HighlightAnnotationListItem[] = highlights.map((highlight) => ({
    kind: 'highlight',
    id: highlight.id,
    pageStart: highlight.pageStart,
    sourceOffset: highlight.startOffset,
    createdAt: highlight.createdAt,
    chapterTitle: highlight.chapterId
      ? chapterTitles.get(highlight.chapterId) ?? null
      : null,
    highlight,
    attachedNotes: notesByHighlightId.get(highlight.id) ?? [],
  }))
  const noteItems: NoteAnnotationListItem[] = notes.map((note) => {
    const linkedHighlight = note.highlightId
      ? highlightsById.get(note.highlightId) ?? null
      : null

    return {
      kind: 'note',
      id: note.id,
      pageStart: note.pageStart,
      sourceOffset: linkedHighlight?.startOffset ?? null,
      createdAt: note.createdAt,
      note,
      linkedHighlight,
    }
  })

  if (tab === 'highlights') {
    return highlightItems.sort(compareAnnotationItems)
  }

  if (tab === 'notes') {
    return noteItems.sort(compareAnnotationItems)
  }

  return [
    ...highlightItems,
    ...noteItems.filter((item) => item.linkedHighlight === null),
  ].sort(compareAnnotationItems)
}
