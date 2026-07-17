export type ReaderSelectionMode = 'pdf' | 'reading'

export type SelectionCoordinateSpace = 'pdf-page' | 'viewport'

export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
  pageNumber: number | null
  coordinateSpace: SelectionCoordinateSpace
}

export type ReaderSelection = {
  text: string
  mode: ReaderSelectionMode
  userBookId: string
  bookId: string
  pageStart: number | null
  pageEnd: number | null
  chapterId: string | null
  chapterTitle: string | null
  startOffset: number | null
  endOffset: number | null
  sourceBlockId: string | null
  boundingRects: SelectionRect[]
  createdAt: string
}

export type ReaderSelectionCaptureResult =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; selection: ReaderSelection }

export type PdfSelectionData = {
  text: string
  pageStart: number
  pageEnd: number
  startOffset: number | null
  endOffset: number | null
  boundingRects: Array<{
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
}
