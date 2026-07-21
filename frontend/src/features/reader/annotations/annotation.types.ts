import type { ReaderHighlight } from '../highlights'
import type { ReaderNote } from '../notes'

export type AnnotationTab = 'all' | 'highlights' | 'notes'

export type HighlightAnnotationListItem = {
  kind: 'highlight'
  id: string
  pageStart: number
  sourceOffset: number | null
  createdAt: string
  chapterTitle: string | null
  highlight: ReaderHighlight
  attachedNotes: ReaderNote[]
}

export type NoteAnnotationListItem = {
  kind: 'note'
  id: string
  pageStart: number | null
  sourceOffset: number | null
  createdAt: string
  note: ReaderNote
  linkedHighlight: ReaderHighlight | null
}

export type AnnotationListItem =
  | HighlightAnnotationListItem
  | NoteAnnotationListItem
