import type { ReaderHighlight } from '../highlights'
import type { ReaderSelection } from '../selection'

export const MAX_NOTE_CONTENT_LENGTH = 10_000

export type NoteType = 'margin_note'
export type NoteContext = 'passage' | 'highlight' | 'page' | 'chapter' | 'book'

export type NotePdfRect = {
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

export type NoteAnchorInput = {
  mode: 'pdf' | 'reading'
  sourceBlockId: string | null
  startOffset: number | null
  endOffset: number | null
  pdfRects: NotePdfRect[]
}

export type ReaderNote = {
  id: string
  type: NoteType
  context: NoteContext
  content: string
  quote: string | null
  highlightId: string | null
  pageStart: number | null
  pageEnd: number | null
  chapterId: string | null
  chapterTitle: string | null
  createdAt: string
  updatedAt: string
}

export type PassageNoteSource = {
  kind: 'passage'
  quote: string
  pageStart: number
  pageEnd: number
  chapterId: string | null
  chapterTitle: string | null
  anchor: NoteAnchorInput
}

export type HighlightNoteSource = {
  kind: 'highlight'
  highlightId: string
  quote: string
  pageStart: number
  pageEnd: number
  chapterId: string | null
  chapterTitle: string | null
}

export type PageNoteSource = { kind: 'page'; pageNumber: number }
export type ChapterNoteSource = {
  kind: 'chapter'
  chapterId: string
  chapterTitle: string | null
  pageStart: number | null
}
export type BookNoteSource = { kind: 'book' }

export type NewNoteSource =
  | PassageNoteSource
  | HighlightNoteSource
  | PageNoteSource
  | ChapterNoteSource
  | BookNoteSource

export type CreateNoteInput = { content: string; source: NewNoteSource }
export type NoteEditorState =
  | { mode: 'create'; source: NewNoteSource }
  | { mode: 'edit'; note: ReaderNote }

export type PassageSourceSelection = Pick<
  ReaderSelection,
  | 'text'
  | 'mode'
  | 'pageStart'
  | 'pageEnd'
  | 'chapterId'
  | 'chapterTitle'
  | 'sourceBlockId'
  | 'startOffset'
  | 'endOffset'
  | 'boundingRects'
>

export type HighlightSource = Pick<
  ReaderHighlight,
  'id' | 'text' | 'pageStart' | 'pageEnd' | 'chapterId'
>
