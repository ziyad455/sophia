import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ReaderChapter } from '../../../books'
import type { ReaderSelectionCaptureResult } from './reader-selection.types'
import { createReadingSelection } from './reader-selection.utils'

type ReadingModeSelectionControllerProps = {
  bookId: string
  userBookId: string
  chapters: ReaderChapter[]
  contentRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null>
  onCapture: (result: ReaderSelectionCaptureResult) => void
}

const KEYBOARD_SELECTION_DELAY_MS = 120
const TOUCH_SELECTION_DELAY_MS = 220

export function ReadingModeSelectionController({
  bookId,
  userBookId,
  chapters,
  contentRef,
  scrollContainerRef,
  onCapture,
}: ReadingModeSelectionControllerProps) {
  const onCaptureRef = useRef(onCapture)
  const chaptersRef = useRef(chapters)

  useEffect(() => {
    onCaptureRef.current = onCapture
    chaptersRef.current = chapters
  }, [chapters, onCapture])

  useEffect(() => {
    const content = contentRef.current
    const scrollContainer = scrollContainerRef.current

    if (!content || !scrollContainer) {
      return
    }

    let captureTimeout = 0
    let scrollFrame = 0

    const capture = () => {
      onCaptureRef.current(
        createReadingSelection({
          container: content,
          nativeSelection: window.getSelection(),
          chapters: chaptersRef.current,
          userBookId,
          bookId,
        }),
      )
    }

    const scheduleCapture = (delay = 0) => {
      window.clearTimeout(captureTimeout)
      captureTimeout = window.setTimeout(capture, delay)
    }

    const handleSelectionChange = () => {
      const nativeSelection = window.getSelection()

      if (!nativeSelection || nativeSelection.isCollapsed) {
        scheduleCapture(KEYBOARD_SELECTION_DELAY_MS)
        return
      }

      const anchorInContent = nativeSelection.anchorNode
        ? content.contains(nativeSelection.anchorNode)
        : false
      const focusInContent = nativeSelection.focusNode
        ? content.contains(nativeSelection.focusNode)
        : false

      if (anchorInContent || focusInContent) {
        scheduleCapture(KEYBOARD_SELECTION_DELAY_MS)
      } else {
        onCaptureRef.current({ status: 'empty' })
      }
    }

    const handleScrollOrResize = () => {
      window.cancelAnimationFrame(scrollFrame)
      scrollFrame = window.requestAnimationFrame(() => {
        const nativeSelection = window.getSelection()

        if (nativeSelection && !nativeSelection.isCollapsed) {
          capture()
        }
      })
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        return
      }

      scheduleCapture(KEYBOARD_SELECTION_DELAY_MS)
    }

    const handlePointerUp = (event: PointerEvent) => {
      scheduleCapture(
        event.pointerType === 'touch' ? TOUCH_SELECTION_DELAY_MS : 0,
      )
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    content.addEventListener('keyup', handleKeyUp)
    content.addEventListener('pointerup', handlePointerUp)
    scrollContainer.addEventListener('scroll', handleScrollOrResize, { passive: true })
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      window.clearTimeout(captureTimeout)
      window.cancelAnimationFrame(scrollFrame)
      document.removeEventListener('selectionchange', handleSelectionChange)
      content.removeEventListener('keyup', handleKeyUp)
      content.removeEventListener('pointerup', handlePointerUp)
      scrollContainer.removeEventListener('scroll', handleScrollOrResize)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [bookId, contentRef, scrollContainerRef, userBookId])

  return null
}
