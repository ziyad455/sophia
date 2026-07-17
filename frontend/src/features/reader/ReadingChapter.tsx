import type { HighlightPreview, ReaderHighlight } from './highlights'
import type { ReflowedReadingPage } from './reader-content.utils'
import { ReadingParagraph } from './ReadingParagraph'

type ReadingChapterProps = {
  page: ReflowedReadingPage
  highlights: ReaderHighlight[]
  preview: HighlightPreview | null
  activeHighlightId: string | null
  onHighlightActivate: (highlightId: string) => void
}

export function ReadingChapter({
  page,
  highlights,
  preview,
  activeHighlightId,
  onHighlightActivate,
}: ReadingChapterProps) {
  const chapterTitle = page.chapter
    ? page.chapter.title ?? `Chapter ${page.chapterNumber ?? ''}`.trim()
    : null
  const sectionId = page.isChapterStart && page.chapter
    ? `chapter-${page.chapter.id}`
    : `reading-page-${page.pageNumber}`

  return (
    <section
      id={sectionId}
      className="scroll-mt-8 border-t border-sophia-border/60 py-8 first:border-t-0 first:pt-0 sm:py-10"
      data-reading-page={page.pageNumber}
      data-reading-chapter={page.chapter?.id}
      data-page-number={page.pageNumber}
      data-chapter-id={page.chapter?.id}
    >
      {page.isChapterStart && chapterTitle ? (
        <header className="mb-8 select-none pt-2 sm:mb-10">
          <p className="m-0 text-xs font-semibold uppercase text-sophia-text-muted">
            Chapter {page.chapterNumber}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight text-sophia-text sm:text-4xl">
            {chapterTitle}
          </h2>
        </header>
      ) : null}

      <div
        className="mb-5 select-none text-xs font-semibold uppercase text-sophia-text-muted/80"
        aria-label={`Source page ${page.pageNumber}`}
      >
        Page {page.pageNumber}
      </div>

      {page.paragraphs.length > 0 ? (
        page.paragraphs.map((paragraph, index) => {
          const sourceBlockId = `${page.id}:paragraph:${index}`
          const blockHighlights = highlights.filter(
            (highlight) =>
              highlight.mode === 'reading' &&
              highlight.sourceBlockId === sourceBlockId,
          )
          const blockPreview = preview?.selection.mode === 'reading' &&
            preview.selection.sourceBlockId === sourceBlockId
            ? preview
            : null

          return (
            <ReadingParagraph
              key={sourceBlockId}
              text={paragraph}
              sourceBlockId={sourceBlockId}
              pageNumber={page.pageNumber}
              chapterId={page.chapter?.id ?? null}
              highlights={blockHighlights}
              preview={blockPreview}
              activeHighlightId={activeHighlightId}
              onHighlightActivate={onHighlightActivate}
            />
          )
        })
      ) : (
        <p className="m-0 text-sm italic text-sophia-text-muted">
          This source page contains no extractable text.
        </p>
      )}
    </section>
  )
}
