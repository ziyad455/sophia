import { Fragment } from 'react'
import type { KeyboardEvent } from 'react'
import type { ReaderHighlight } from './highlight.types'
import { highlightMarkClass, resolveNonOverlappingRanges } from './highlight.utils'

type ReadingHighlightRendererProps = {
  text: string
  highlights: ReaderHighlight[]
  activeHighlightId: string | null
  onActivate: (highlightId: string) => void
}

export function ReadingHighlightRenderer({
  text,
  highlights,
  activeHighlightId,
  onActivate,
}: ReadingHighlightRendererProps) {
  const ranges = resolveNonOverlappingRanges(text, highlights)

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
