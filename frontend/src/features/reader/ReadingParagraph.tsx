import { useLayoutEffect, useRef } from 'react'
import type { HighlightPreview, ReaderHighlight } from './highlights'
import { ReadingHighlightRenderer } from './highlights'

type ReadingParagraphProps = {
  text: string
  sourceBlockId: string
  pageNumber: number
  chapterId: string | null
  highlights: ReaderHighlight[]
  preview: HighlightPreview | null
  activeHighlightId: string | null
  onHighlightActivate: (highlightId: string) => void
}

export function ReadingParagraph({
  text,
  sourceBlockId,
  pageNumber,
  chapterId,
  highlights,
  preview,
  activeHighlightId,
  onHighlightActivate,
}: ReadingParagraphProps) {
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const paragraph = paragraphRef.current
    const selectedRange = preview?.selection

    if (
      !paragraph ||
      !selectedRange ||
      selectedRange.mode !== 'reading' ||
      selectedRange.sourceBlockId !== sourceBlockId ||
      selectedRange.startOffset === null ||
      selectedRange.endOffset === null
    ) {
      return
    }

    const nativeSelection = window.getSelection()
    const selectionInsideParagraph = Boolean(
      nativeSelection &&
      !nativeSelection.isCollapsed &&
      nativeSelection.anchorNode &&
      nativeSelection.focusNode &&
      paragraph.contains(nativeSelection.anchorNode) &&
      paragraph.contains(nativeSelection.focusNode),
    )
    const normalizedNativeText = nativeSelection?.toString().replace(/\s+/g, ' ').trim()

    if (selectionInsideParagraph && normalizedNativeText === selectedRange.text) {
      return
    }

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node = walker.nextNode()

    while (node) {
      textNodes.push(node as Text)
      node = walker.nextNode()
    }

    function findPoint(offset: number): { node: Text; offset: number } | null {
      let traversed = 0

      for (const textNode of textNodes) {
        const nextOffset = traversed + textNode.data.length

        if (offset <= nextOffset) {
          return { node: textNode, offset: offset - traversed }
        }

        traversed = nextOffset
      }

      return null
    }

    const start = findPoint(selectedRange.startOffset)
    const end = findPoint(selectedRange.endOffset)

    if (!start || !end || !nativeSelection) {
      return
    }

    const range = document.createRange()

    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    nativeSelection.removeAllRanges()
    nativeSelection.addRange(range)
  }, [preview, sourceBlockId])

  return (
    <p
      ref={paragraphRef}
      className="m-0 select-text text-pretty [&+&]:mt-[0.9em]"
      data-reader-source-block="true"
      data-source-block-id={sourceBlockId}
      data-source-page={pageNumber}
      data-source-chapter={chapterId ?? undefined}
    >
      <ReadingHighlightRenderer
        text={text}
        highlights={highlights}
        preview={preview}
        activeHighlightId={activeHighlightId}
        onActivate={onHighlightActivate}
      />
    </p>
  )
}
