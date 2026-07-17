import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import type { CSSProperties } from 'react'
import type { ReadingContentResponse } from '../../books'
import type { ReaderHighlight } from './highlights'
import type { ReaderPreferences } from './preferences'
import { buildReflowedReadingPages } from './reader-content.utils'
import { ReadingChapter } from './ReadingChapter'
import { ReadingModeSelectionController } from './selection'
import type { ReaderSelectionCaptureResult } from './selection'

export type ReflowedReadingModeHandle = {
  scrollToPage: (pageNumber: number, behavior?: ScrollBehavior) => void
  scrollToHighlight: (
    highlightId: string,
    sourceBlockId: string | null,
    pageNumber: number,
  ) => boolean
}

type ReflowedReadingModeProps = {
  content: ReadingContentResponse
  initialPage: number
  preferences: ReaderPreferences
  onActivePageChange: (pageNumber: number) => void
  onSelectionCapture: (result: ReaderSelectionCaptureResult) => void
  highlights: ReaderHighlight[]
  activeHighlightId: string | null
  onHighlightActivate: (highlightId: string) => void
}

const serifStack = "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif"
const sansStack = "Geist Variable, system-ui, sans-serif"

export const ReflowedReadingMode = forwardRef<
  ReflowedReadingModeHandle,
  ReflowedReadingModeProps
>(function ReflowedReadingMode(
  {
    content,
    initialPage,
    preferences,
    onActivePageChange,
    onSelectionCapture,
    highlights,
    activeHighlightId,
    onHighlightActivate,
  },
  ref,
) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const didSetInitialPageRef = useRef(false)
  const onActivePageChangeRef = useRef(onActivePageChange)
  const pages = useMemo(() => buildReflowedReadingPages(content), [content])

  useEffect(() => {
    onActivePageChangeRef.current = onActivePageChange
  }, [onActivePageChange])

  const scrollToPage = useCallback((pageNumber: number, behavior?: ScrollBehavior) => {
    const container = scrollContainerRef.current
    const exactPage = container?.querySelector<HTMLElement>(
      `[data-page-number="${pageNumber}"]`,
    )

    if (!container) {
      return
    }

    const page = exactPage ?? [...container.querySelectorAll<HTMLElement>('[data-page-number]')]
      .reduce<HTMLElement | null>((nearest, candidate) => {
        if (!nearest) {
          return candidate
        }

        const nearestDistance = Math.abs(Number(nearest.dataset.pageNumber) - pageNumber)
        const candidateDistance = Math.abs(Number(candidate.dataset.pageNumber) - pageNumber)

        return candidateDistance < nearestDistance ? candidate : nearest
      }, null)

    if (!page) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    page.scrollIntoView({
      block: 'start',
      behavior: behavior ?? (reducedMotion ? 'auto' : 'smooth'),
    })
  }, [])

  const scrollToHighlight = useCallback((
    highlightId: string,
    sourceBlockId: string | null,
    pageNumber: number,
  ): boolean => {
    const container = scrollContainerRef.current

    if (!container) {
      return false
    }

    const mark = [...container.querySelectorAll<HTMLElement>('[data-highlight-id]')]
      .find((candidate) => candidate.dataset.highlightId === highlightId)
    const sourceBlock = sourceBlockId
      ? [...container.querySelectorAll<HTMLElement>('[data-source-block-id]')]
          .find((candidate) => candidate.dataset.sourceBlockId === sourceBlockId)
      : null
    const target = mark ?? sourceBlock

    if (!target) {
      scrollToPage(pageNumber)
      return false
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    target.scrollIntoView({
      block: 'center',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })

    if (mark) {
      window.requestAnimationFrame(() => mark.focus({ preventScroll: true }))
    }

    return Boolean(mark)
  }, [scrollToPage])

  useImperativeHandle(
    ref,
    () => ({ scrollToPage, scrollToHighlight }),
    [scrollToHighlight, scrollToPage],
  )

  useEffect(() => {
    didSetInitialPageRef.current = false
  }, [content.book.userBookId])

  useEffect(() => {
    if (didSetInitialPageRef.current || pages.length === 0) {
      return
    }

    didSetInitialPageRef.current = true
    const frame = window.requestAnimationFrame(() => scrollToPage(initialPage, 'auto'))

    return () => window.cancelAnimationFrame(frame)
  }, [initialPage, pages.length, scrollToPage])

  useEffect(() => {
    const container = scrollContainerRef.current

    if (!container || pages.length === 0) {
      return
    }

    const pageElements = container.querySelectorAll<HTMLElement>('[data-page-number]')
    const visiblePages = new Map<Element, IntersectionObserverEntry>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visiblePages.set(entry.target, entry)
          } else {
            visiblePages.delete(entry.target)
          }
        }

        const visibleEntries = [...visiblePages.values()]

        if (visibleEntries.length === 0) {
          return
        }

        const readingLine = (visibleEntries[0].rootBounds?.top ?? 0) + 96
        const nearestEntry = visibleEntries.reduce((mostVisible, entry) => {
          const visibleHeightDifference =
            entry.intersectionRect.height - mostVisible.intersectionRect.height

          if (Math.abs(visibleHeightDifference) > 1) {
            return visibleHeightDifference > 0 ? entry : mostVisible
          }

          const mostVisibleDistance = Math.abs(mostVisible.boundingClientRect.top - readingLine)
          const entryDistance = Math.abs(entry.boundingClientRect.top - readingLine)

          return entryDistance < mostVisibleDistance ? entry : mostVisible
        })
        const pageNumber = Number((nearestEntry.target as HTMLElement).dataset.pageNumber)

        if (Number.isInteger(pageNumber) && pageNumber > 0) {
          onActivePageChangeRef.current(pageNumber)
        }
      },
      {
        root: container,
        threshold: [0, 0.01, 0.25, 0.5, 0.75, 1],
      },
    )

    pageElements.forEach((element) => observer.observe(element))

    return () => {
      observer.disconnect()
      visiblePages.clear()
    }
  }, [pages])

  const articleStyle: CSSProperties = {
    fontFamily:
      preferences.readingFontFamily === 'sans' ? sansStack : serifStack,
    fontSize: `${preferences.readingFontSize}px`,
    lineHeight: preferences.readingLineHeight,
    maxWidth: `${preferences.readingContentWidth}px`,
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto overscroll-contain bg-sophia-bg px-5 py-10 text-sophia-text sm:px-8 sm:py-14"
    >
      <article
        ref={articleRef}
        className="mx-auto w-full pb-20 selection:bg-sophia-primary/25"
        data-reader-selection-content
        style={articleStyle}
        aria-label={`${content.book.title} in Reading Mode`}
      >
        <h1 className="sr-only">{content.book.title}</h1>
        {pages.map((page) => (
          <ReadingChapter
            key={page.id}
            page={page}
            highlights={highlights}
            activeHighlightId={activeHighlightId}
            onHighlightActivate={onHighlightActivate}
          />
        ))}
      </article>
      <ReadingModeSelectionController
        bookId={content.book.bookId}
        userBookId={content.book.userBookId}
        chapters={content.chapters}
        contentRef={articleRef}
        scrollContainerRef={scrollContainerRef}
        onCapture={onSelectionCapture}
      />
    </div>
  )
})
