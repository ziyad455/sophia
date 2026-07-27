import type { ReaderSelection } from '../selection'
import {
  HIGHLIGHT_COLOR_IDS,
  type HighlightColorId,
} from '../../../theme'

export const HIGHLIGHT_COLORS = HIGHLIGHT_COLOR_IDS

export type HighlightColor = HighlightColorId
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

export type HighlightPreview = {
  selection: ReaderSelection
  color: HighlightColor
  temporary: true
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
