import type { ReaderChapter } from './reader.types'
import { findChapterForPage, formatPageRange } from './reader.utils'

type ReaderChapterListProps = {
  chapters: ReaderChapter[]
  currentPage: number
  onSelectChapter: (pageStart: number) => void
}

export function ReaderChapterList({
  chapters,
  currentPage,
  onSelectChapter,
}: ReaderChapterListProps) {
  const activeChapter = findChapterForPage(chapters, currentPage)

  if (chapters.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-sophia-text-muted">
        No chapter structure was detected for this book.
      </div>
    )
  }

  return (
    <nav aria-label="Book chapters">
      <ul className="m-0 list-none p-0">
        {chapters.map((chapter) => {
          const isActive = activeChapter?.id === chapter.id
          const pageRange = formatPageRange(chapter)
          const chapterTitle = chapter.title ?? `Chapter ${chapter.chapterIndex}`
          const hasValidPageStart = chapter.pageStart !== null && chapter.pageStart > 0

          return (
            <li key={chapter.id} className="m-0 p-0">
              <button
                type="button"
                className={[
                  'w-full px-4 py-3 text-left transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sophia-primary',
                  isActive
                    ? 'border-l-2 border-sophia-primary bg-sophia-bg text-sophia-text'
                    : 'border-l-2 border-transparent text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text',
                ].join(' ')}
                onClick={() => {
                  if (hasValidPageStart) {
                    onSelectChapter(chapter.pageStart!)
                  }
                }}
                disabled={!hasValidPageStart}
                aria-current={isActive ? 'location' : undefined}
              >
                <span className="block truncate text-sm font-medium leading-tight">
                  {chapterTitle}
                </span>
                {pageRange ? (
                  <span className="mt-0.5 block text-xs text-sophia-text-muted">
                    {pageRange}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
