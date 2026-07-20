import type { ReaderChapter } from '../../../books'
import type { ReaderHighlight } from '../highlights'
import type { ReaderSelection } from '../selection'
import type { HighlightNoteSource, NewNoteSource, PassageNoteSource, ReaderNote } from './note.types'

export function sortReaderNotes(notes: ReaderNote[]): ReaderNote[] {
  return [...notes].sort((left, right) => {
    const leftPage = left.pageStart ?? Number.MAX_SAFE_INTEGER
    const rightPage = right.pageStart ?? Number.MAX_SAFE_INTEGER

    return leftPage - rightPage ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
  })
}

export function passageSourceFromSelection(selection: ReaderSelection): PassageNoteSource | null {
  if (selection.pageStart === null || selection.pageEnd === null) {
    return null
  }

  return {
    kind: 'passage',
    quote: selection.text,
    pageStart: selection.pageStart,
    pageEnd: selection.pageEnd,
    chapterId: selection.chapterId,
    chapterTitle: selection.chapterTitle,
    anchor: {
      mode: selection.mode,
      sourceBlockId: selection.sourceBlockId,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      pdfRects: selection.mode === 'pdf'
        ? selection.boundingRects.flatMap((rect) =>
            rect.coordinateSpace === 'pdf-page' && rect.pageNumber !== null
              ? [{
                  pageNumber: rect.pageNumber,
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                }]
              : [],
          )
        : [],
    },
  }
}

export function highlightSource(
  highlight: ReaderHighlight,
  chapters: ReaderChapter[],
): HighlightNoteSource {
  const chapter = highlight.chapterId
    ? chapters.find((candidate) => candidate.id === highlight.chapterId)
    : null

  return {
    kind: 'highlight',
    highlightId: highlight.id,
    quote: highlight.text,
    pageStart: highlight.pageStart,
    pageEnd: highlight.pageEnd,
    chapterId: highlight.chapterId,
    chapterTitle: chapter?.title ?? null,
  }
}

function pageRangeLabel(pageStart: number, pageEnd: number): string {
  return pageStart === pageEnd
    ? 'Page ' + pageStart
    : 'Pages ' + pageStart + '–' + pageEnd
}

export function newNoteSourceLabel(source: NewNoteSource): string {
  if (source.kind === 'book') return 'Book note'
  if (source.kind === 'chapter') {
    return source.chapterTitle ? 'Chapter · ' + source.chapterTitle : 'Chapter note'
  }
  if (source.kind === 'page') return 'Page ' + source.pageNumber

  const location = pageRangeLabel(source.pageStart, source.pageEnd)
  return source.kind === 'highlight'
    ? 'Highlight · ' + location
    : 'Passage · ' + location
}

export function noteSourceLabel(note: ReaderNote): string {
  if (note.context === 'book') return 'Book note'
  if (note.context === 'chapter') {
    return note.chapterTitle ? 'Chapter · ' + note.chapterTitle : 'Chapter note'
  }
  if (note.pageStart === null) {
    return note.context === 'highlight' ? 'Highlight' : 'Passage'
  }

  const location = pageRangeLabel(note.pageStart, note.pageEnd ?? note.pageStart)
  if (note.context === 'highlight') return 'Highlight · ' + location
  if (note.context === 'passage') return 'Passage · ' + location
  return location
}

export function noteCanNavigate(note: ReaderNote): boolean {
  return note.pageStart !== null
}

export function noteQuotePreview(source: NewNoteSource | ReaderNote): string | null {
  if ('kind' in source) {
    return source.kind === 'passage' || source.kind === 'highlight'
      ? source.quote
      : null
  }
  return source.quote
}
