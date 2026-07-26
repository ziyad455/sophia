import type {
  HighlightColor,
  HighlightPreview,
  ReaderHighlight,
} from './highlight.types'
import {
  getHighlightColorForeground,
  getHighlightColorLabel,
  getHighlightColorValue,
  getPdfHighlightColorValue,
} from '../../../theme'

export function highlightColorValue(color: HighlightColor): string {
  return getHighlightColorValue(color)
}

export function pdfHighlightColorValue(color: HighlightColor): string {
  return getPdfHighlightColorValue(color)
}

export function highlightColorForeground(color: HighlightColor): string {
  return getHighlightColorForeground(color)
}

export function highlightColorLabel(color: HighlightColor): string {
  return getHighlightColorLabel(color)
}

export type ResolvedHighlightRange = {
  highlight: ReaderHighlight
  start: number
  end: number
}

export type ResolvedHighlightPreviewRange = {
  preview: HighlightPreview
  start: number
  end: number
}

function resolveTextRange(
  text: string,
  selectedText: string,
  startOffset: number | null,
  endOffset: number | null,
): { start: number; end: number } | null {
  if (startOffset === null || endOffset === null) {
    return null
  }

  if (
    startOffset >= 0 &&
    endOffset <= text.length &&
    text.slice(startOffset, endOffset) === selectedText
  ) {
    return { start: startOffset, end: endOffset }
  }

  const firstMatch = text.indexOf(selectedText)

  if (firstMatch < 0 || text.indexOf(selectedText, firstMatch + 1) >= 0) {
    return null
  }

  return {
    start: firstMatch,
    end: firstMatch + selectedText.length,
  }
}

export function sortHighlights(highlights: ReaderHighlight[]): ReaderHighlight[] {
  return [...highlights].sort((left, right) =>
    left.pageStart - right.pageStart ||
    (left.startOffset ?? Number.MAX_SAFE_INTEGER) -
      (right.startOffset ?? Number.MAX_SAFE_INTEGER) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id),
  )
}

export function isStructurallyUnresolved(highlight: ReaderHighlight): boolean {
  if (highlight.mode === 'pdf') {
    return highlight.pdfRects.length === 0
  }

  return highlight.sourceBlockId === null ||
    highlight.startOffset === null ||
    highlight.endOffset === null
}

export function resolveReadingHighlight(
  text: string,
  highlight: ReaderHighlight,
): ResolvedHighlightRange | null {
  if (highlight.mode !== 'reading') {
    return null
  }

  const range = resolveTextRange(
    text,
    highlight.text,
    highlight.startOffset,
    highlight.endOffset,
  )

  if (!range) {
    return null
  }

  return {
    highlight,
    ...range,
  }
}

export function resolveReadingHighlightPreview(
  text: string,
  preview: HighlightPreview,
): ResolvedHighlightPreviewRange | null {
  const { selection } = preview

  if (selection.mode !== 'reading' || selection.sourceBlockId === null) {
    return null
  }

  const range = resolveTextRange(
    text,
    selection.text,
    selection.startOffset,
    selection.endOffset,
  )

  return range ? { preview, ...range } : null
}

export function resolveNonOverlappingRanges(
  text: string,
  highlights: ReaderHighlight[],
): ResolvedHighlightRange[] {
  const candidates = highlights
    .flatMap((highlight) => {
      const range = resolveReadingHighlight(text, highlight)

      return range ? [range] : []
    })
    .sort((left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.highlight.id.localeCompare(right.highlight.id),
    )
  const resolved: ResolvedHighlightRange[] = []
  let cursor = 0

  for (const candidate of candidates) {
    if (candidate.start < cursor || candidate.end <= candidate.start) {
      continue
    }

    resolved.push(candidate)
    cursor = candidate.end
  }

  return resolved
}
