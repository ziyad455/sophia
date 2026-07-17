import { config } from '../../../config'
import type {
  CreateHighlightSelection,
  HighlightColor,
  HighlightMode,
  PdfHighlightRect,
  ReaderHighlight,
} from './highlight.types'
import { HIGHLIGHT_COLORS } from './highlight.types'

export class HighlightsApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HighlightsApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readErrorMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.message === 'string' && value.message.trim()
    ? value.message
    : null
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizePdfRects(value: unknown): PdfHighlightRect[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((rect) => {
    if (!isRecord(rect)) {
      return []
    }

    const { pageNumber, x, y, width, height } = rect

    if (
      !Number.isInteger(pageNumber) ||
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      ![x, y, width, height].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0
    ) {
      return []
    }

    return [{ pageNumber: pageNumber as number, x, y, width, height }]
  })
}

function normalizeHighlight(value: unknown): ReaderHighlight | null {
  if (!isRecord(value)) {
    return null
  }

  const mode: HighlightMode | null = value.mode === 'pdf' || value.mode === 'reading'
    ? value.mode
    : null
  const color = typeof value.color === 'string' && HIGHLIGHT_COLORS.includes(
    value.color as HighlightColor,
  )
    ? value.color as HighlightColor
    : null

  if (
    typeof value.id !== 'string' ||
    typeof value.userBookId !== 'string' ||
    typeof value.bookId !== 'string' ||
    typeof value.text !== 'string' ||
    !mode ||
    !color ||
    !Number.isInteger(value.pageStart) ||
    !Number.isInteger(value.pageEnd) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    userBookId: value.userBookId,
    bookId: value.bookId,
    text: value.text,
    mode,
    pageStart: value.pageStart as number,
    pageEnd: value.pageEnd as number,
    chapterId: readNullableString(value.chapterId),
    sourceBlockId: readNullableString(value.sourceBlockId),
    startOffset: Number.isInteger(value.startOffset) ? value.startOffset as number : null,
    endOffset: Number.isInteger(value.endOffset) ? value.endOffset as number : null,
    color,
    pdfRects: normalizePdfRects(value.pdfRects),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

async function requestHighlights(
  path: string,
  options: {
    method?: 'DELETE' | 'GET' | 'POST'
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<unknown> {
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : undefined

    if (!response.ok) {
      throw new HighlightsApiError(
        response.status,
        readErrorMessage(data) ?? 'The highlight request could not be completed.',
      )
    }

    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (error instanceof HighlightsApiError) {
      throw error
    }

    throw new HighlightsApiError(0, 'Unable to reach Sophia. Check your connection and try again.')
  }
}

export async function getBookHighlights(
  userBookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<ReaderHighlight[]> {
  const response = await requestHighlights(
    `/books/${encodeURIComponent(userBookId)}/highlights`,
    { signal: options.signal },
  )

  if (!isRecord(response) || !Array.isArray(response.highlights)) {
    throw new HighlightsApiError(0, 'We could not read your highlights.')
  }

  return response.highlights.flatMap((value) => {
    const highlight = normalizeHighlight(value)

    return highlight ? [highlight] : []
  })
}

export async function createHighlight(
  userBookId: string,
  selection: CreateHighlightSelection,
  color: HighlightColor,
): Promise<ReaderHighlight> {
  if (selection.pageStart === null || selection.pageEnd === null) {
    throw new HighlightsApiError(400, 'This selection does not have a reliable source page.')
  }

  const pdfRects = selection.mode === 'pdf'
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
    : []
  const response = await requestHighlights(
    `/books/${encodeURIComponent(userBookId)}/highlights`,
    {
      method: 'POST',
      body: {
        text: selection.text,
        mode: selection.mode,
        pageStart: selection.pageStart,
        pageEnd: selection.pageEnd,
        chapterId: selection.chapterId,
        sourceBlockId: selection.sourceBlockId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        color,
        pdfRects,
      },
    },
  )
  const highlight = isRecord(response) ? normalizeHighlight(response.highlight) : null

  if (!highlight) {
    throw new HighlightsApiError(0, 'We could not read the saved highlight.')
  }

  return highlight
}

export async function deleteHighlight(
  userBookId: string,
  highlightId: string,
): Promise<void> {
  await requestHighlights(
    `/books/${encodeURIComponent(userBookId)}/highlights/${encodeURIComponent(highlightId)}`,
    { method: 'DELETE' },
  )
}
