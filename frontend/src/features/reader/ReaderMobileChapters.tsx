import { useCallback, useEffect, useRef } from 'react'
import type { ReaderChapter } from './reader.types'
import { ReaderChapterList } from './ReaderChapterList'

type ReaderMobileChaptersProps = {
  chapters: ReaderChapter[]
  currentPage: number
  isOpen: boolean
  onClose: () => void
  onSelectChapter: (pageStart: number) => void
}

/**
 * A bottom-sheet style drawer for chapter navigation on mobile/tablet.
 * Uses a backdrop overlay, focus trapping, and Escape key to close.
 */
export function ReaderMobileChapters({
  chapters,
  currentPage,
  isOpen,
  onClose,
  onSelectChapter,
}: ReaderMobileChaptersProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Capture the previously focused element and restore it on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null

      // Focus the panel after it opens
      requestAnimationFrame(() => {
        panelRef.current?.focus()
      })
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  const handleSelectChapter = useCallback(
    (pageStart: number) => {
      onSelectChapter(pageStart)
      onClose()
    },
    [onSelectChapter, onClose],
  )

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides up from bottom */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Chapter navigation"
        aria-modal="true"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-sophia-border bg-sophia-surface shadow-2xl focus:outline-none"
      >
        {/* Handle + header */}
        <div className="sticky top-0 z-10 border-b border-sophia-border bg-sophia-surface px-4 pb-3 pt-4">
          {/* Visual drag handle */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sophia-border" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-sm font-bold text-sophia-text">Chapters</h2>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={onClose}
              aria-label="Close chapter navigation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chapter list */}
        <ReaderChapterList
          chapters={chapters}
          currentPage={currentPage}
          onSelectChapter={handleSelectChapter}
        />
      </div>
    </div>
  )
}
