import type { ReaderSelection } from '../selection'

export const HIGHLIGHT_COLORS = ['gold', 'blue', 'green', 'rose'] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]
export type HighlightMode = 'pdf' | 'reading'

export type PdfHighlightRect = {
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

export type ReaderHighlight = {
  id: string
  userBookId: string
  bookId: string
  text: string
  mode: HighlightMode
  pageStart: number
  pageEnd: number
  chapterId: string | null
  sourceBlockId: string | null
  startOffset: number | null
  endOffset: number | null
  color: HighlightColor
  pdfRects: PdfHighlightRect[]
  createdAt: string
  updatedAt: string
}

export type CreateHighlightSelection = Pick<
  ReaderSelection,
  | 'text'
  | 'mode'
  | 'pageStart'
  | 'pageEnd'
  | 'chapterId'
  | 'sourceBlockId'
  | 'startOffset'
  | 'endOffset'
  | 'boundingRects'
>
