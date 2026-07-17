import type { ReactNode } from 'react'
import { navigate } from '../../routing/navigation'

type ReaderHeaderProps = {
  title: string
  author: string | null
  currentPage: number
  pageCount: number | null
  currentChapterTitle: string | null
  hasChapters: boolean
  onToggleChapters: () => void
  actions?: ReactNode
  settings?: ReactNode
}

export function ReaderHeader({
  title,
  author,
  currentPage,
  pageCount,
  currentChapterTitle,
  hasChapters,
  onToggleChapters,
  actions,
  settings,
}: ReaderHeaderProps) {
  function goToLibrary() {
    navigate('/library')
  }

  const pageDisplay = pageCount
    ? `Page ${currentPage} of ${pageCount}`
    : `Page ${currentPage}`

  const statusParts: string[] = []

  if (currentChapterTitle) {
    statusParts.push(currentChapterTitle)
  }

  statusParts.push(pageDisplay)
  const statusText = statusParts.join(' · ')

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sophia-border bg-sophia-surface px-4">
      {/* Back to library */}
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
        onClick={goToLibrary}
        aria-label="Back to library"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="hidden sm:inline">Library</span>
      </button>

      {/* Separator */}
      <div className="h-5 w-px shrink-0 bg-sophia-border" aria-hidden="true" />

      {/* Title and author — truncates on overflow */}
      <div className="min-w-0 flex-1">
        <p
          className="m-0 truncate text-sm font-semibold leading-tight text-sophia-text"
          title={title}
        >
          {title}
          {author ? (
            <span className="font-normal text-sophia-text-muted"> — {author}</span>
          ) : null}
        </p>
      </div>

      {/* Page and chapter status — hidden on very small screens */}
      <p className="m-0 hidden shrink-0 text-xs text-sophia-text-muted lg:block">
        {statusText}
      </p>

      {actions}
      {settings}

      {/* Chapter toggle for mobile/tablet — only when chapters exist */}
      {hasChapters ? (
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary lg:hidden"
          onClick={onToggleChapters}
          aria-label="Open chapter navigation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden sm:inline">Chapters</span>
        </button>
      ) : null}
    </header>
  )
}
