import type { ReaderHighlight } from './highlights'
import { ReadingHighlightRenderer } from './highlights'

type ReadingParagraphProps = {
  text: string
  sourceBlockId: string
  pageNumber: number
  chapterId: string | null
  highlights: ReaderHighlight[]
  activeHighlightId: string | null
  onHighlightActivate: (highlightId: string) => void
}

export function ReadingParagraph({
  text,
  sourceBlockId,
  pageNumber,
  chapterId,
  highlights,
  activeHighlightId,
  onHighlightActivate,
}: ReadingParagraphProps) {
  return (
    <p
      className="m-0 select-text text-pretty [&+&]:mt-[0.9em]"
      data-reader-source-block="true"
      data-source-block-id={sourceBlockId}
      data-source-page={pageNumber}
      data-source-chapter={chapterId ?? undefined}
    >
      <ReadingHighlightRenderer
        text={text}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
        onActivate={onHighlightActivate}
      />
    </p>
  )
}
