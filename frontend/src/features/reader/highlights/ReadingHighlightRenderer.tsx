import { Fragment } from 'react'
import type { KeyboardEvent } from 'react'
import type { HighlightPreview, ReaderHighlight } from './highlight.types'
import {
  highlightMarkClass,
  resolveNonOverlappingRanges,
  resolveReadingHighlightPreview,
} from './highlight.utils'

type ReadingHighlightRendererProps = {
  text: string
  highlights: ReaderHighlight[]
  preview: HighlightPreview | null
  activeHighlightId: string | null
  onActivate: (highlightId: string) => void
}

export function ReadingHighlightRenderer({
  text,
  highlights,
  preview,
  activeHighlightId,
  onActivate,
}: ReadingHighlightRendererProps) {
  const savedRanges = resolveNonOverlappingRanges(text, highlights)
  const previewRange = preview ? resolveReadingHighlightPreview(text, preview) : null
  const previewOverlapsSaved = previewRange
    ? savedRanges.some(
        (range) => previewRange.start < range.end && previewRange.end > range.start,
      )
    : false
  const ranges = [
    ...savedRanges.map((range) => ({ ...range, kind: 'saved' as const })),
    ...(previewRange && !previewOverlapsSaved
      ? [{ ...previewRange, kind: 'preview' as const }]
      : []),
  ].sort((left, right) => left.start - right.start || left.end - right.end)

  if (ranges.length === 0) {
    return text
  }

  const nodes = []
  let cursor = 0

  function handleKeyDown(event: KeyboardEvent<HTMLElement>, highlightId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onActivate(highlightId)
  }

  for (const range of ranges) {
    if (range.start > cursor) {
      nodes.push(
        <Fragment key={`text-${cursor}-${range.start}`}>
          {text.slice(cursor, range.start)}
        </Fragment>,
      )
    }

    if (range.kind === 'preview') {
      nodes.push(
        <mark
          key={`preview-${range.preview.selection.createdAt}`}
          className={`rounded-[2px] px-[0.04em] text-inherit ${highlightMarkClass[range.preview.color]}`}
          data-highlight-preview="true"
        >
          {text.slice(range.start, range.end)}
        </mark>,
      )
      cursor = range.end
      continue
    }

    const isActive = activeHighlightId === range.highlight.id

    nodes.push(
      <mark
        key={range.highlight.id}
        className={`rounded-[2px] px-[0.04em] text-inherit outline-offset-2 transition-shadow ${highlightMarkClass[range.highlight.color]} ${isActive ? 'ring-2 ring-sophia-primary' : ''}`}
        data-highlight-id={range.highlight.id}
        role="button"
        tabIndex={0}
        aria-label={`Highlighted passage: ${range.highlight.text}`}
        aria-pressed={isActive}
        onClick={() => onActivate(range.highlight.id)}
        onKeyDown={(event) => handleKeyDown(event, range.highlight.id)}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    )
    cursor = range.end
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`text-${cursor}-end`}>{text.slice(cursor)}</Fragment>)
  }

  return nodes
}
