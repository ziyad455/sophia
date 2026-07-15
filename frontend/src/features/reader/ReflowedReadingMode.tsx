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
import type { ReaderPreferences } from './preferences'
import { buildReflowedReadingPages } from './reader-content.utils'
import { ReadingChapter } from './ReadingChapter'

export type ReflowedReadingModeHandle = {
  scrollToPage: (pageNumber: number, behavior?: ScrollBehavior) => void
}

type ReflowedReadingModeProps = {
  content: ReadingContentResponse
  initialPage: number
  preferences: ReaderPreferences
  onActivePageChange: (pageNumber: number) => void
}

const serifStack = "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif"
const sansStack = "Geist Variable, system-ui, sans-serif"

export const ReflowedReadingMode = forwardRef<
  ReflowedReadingModeHandle,
  ReflowedReadingModeProps
>(function ReflowedReadingMode(
  { content, initialPage, preferences, onActivePageChange },
  ref,
) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const didSetInitialPageRef = useRef(false)
  const pages = useMemo(() => buildReflowedReadingPages(content), [content])

  const scrollToPage = useCallback((pageNumber: number, behavior?: ScrollBehavior) => {
    const container = scrollContainerRef.current
    const page = container?.querySelector<HTMLElement>(
      `[data-reading-page="${pageNumber}"]`,
    )

    if (!container || !page) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    page.scrollIntoView({
      block: 'start',
      behavior: behavior ?? (reducedMotion ? 'auto' : 'smooth'),
    })
  }, [])

  useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage])

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

    const activeContainer = container

    function updateActivePage() {
      frameRef.current = null
      const pageElements = activeContainer.querySelectorAll<HTMLElement>('[data-reading-page]')
      const readingLine = activeContainer.getBoundingClientRect().top + 96
      let activePage = pages[0].pageNumber

      for (const element of pageElements) {
        const pageNumber = Number(element.dataset.readingPage)

        if (element.getBoundingClientRect().top <= readingLine) {
          activePage = pageNumber
        } else {
          break
        }
      }

      onActivePageChange(activePage)
    }

    function scheduleActivePageUpdate() {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(updateActivePage)
      }
    }

    scheduleActivePageUpdate()
    activeContainer.addEventListener('scroll', scheduleActivePageUpdate, { passive: true })
    window.addEventListener('resize', scheduleActivePageUpdate)

    return () => {
      activeContainer.removeEventListener('scroll', scheduleActivePageUpdate)
      window.removeEventListener('resize', scheduleActivePageUpdate)

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [onActivePageChange, pages])

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
        className="mx-auto w-full pb-20 selection:bg-sophia-primary/25"
        style={articleStyle}
        aria-label={`${content.book.title} in Reading Mode`}
      >
        <h1 className="sr-only">{content.book.title}</h1>
        {pages.map((page) => (
          <ReadingChapter key={page.pageNumber} page={page} />
        ))}
      </article>
    </div>
  )
})
