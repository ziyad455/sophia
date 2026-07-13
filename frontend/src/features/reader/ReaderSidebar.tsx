import type { ReaderChapter } from './reader.types'
import { ReaderChapterList } from './ReaderChapterList'

type ReaderSidebarProps = {
  chapters: ReaderChapter[]
  currentPage: number
  onSelectChapter: (pageStart: number) => void
}

export function ReaderSidebar({
  chapters,
  currentPage,
  onSelectChapter,
}: ReaderSidebarProps) {
  // Don't render a sidebar if there are no chapters
  if (chapters.length === 0) {
    return null
  }

  return (
    <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-sophia-border bg-sophia-surface lg:block">
      <div className="px-4 pb-2 pt-4">
        <h2 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-sophia-text-muted">
          Chapters
        </h2>
      </div>
      <ReaderChapterList
        chapters={chapters}
        currentPage={currentPage}
        onSelectChapter={onSelectChapter}
      />
    </aside>
  )
}
