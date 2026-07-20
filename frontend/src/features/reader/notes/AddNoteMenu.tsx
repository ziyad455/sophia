import { useState } from 'react'
import { BookOpen, FileText, List, NotebookPen } from 'lucide-react'
import type { ReaderChapter } from '../../../books'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../../../components/ui/popover'

type AddNoteMenuProps = {
  count: number
  hasError: boolean
  currentPage: number
  currentChapter: ReaderChapter | null
  triggerClassName?: string
  onAddPage: () => void
  onAddChapter: () => void
  onAddBook: () => void
  onOpenNotes: () => void
}

export function AddNoteMenu({
  count,
  hasError,
  currentPage,
  currentChapter,
  triggerClassName = '',
  onAddPage,
  onAddChapter,
  onAddBook,
  onOpenNotes,
}: AddNoteMenuProps) {
  const [open, setOpen] = useState(false)

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={
              'relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary ' +
              triggerClassName
            }
            aria-label={'Open notes' + (count > 0 ? ', ' + count + ' saved' : '')}
            title="Notes"
          />
        }
      >
        <NotebookPen className="h-4 w-4" aria-hidden="true" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-sophia-primary px-1 text-center text-[10px] font-bold leading-4 text-sophia-bg">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
        {hasError ? (
          <span
            className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500"
            aria-hidden="true"
          />
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(19rem,calc(100vw-1.5rem))] gap-3 border border-sophia-border bg-sophia-surface p-3 text-sophia-text"
      >
        <PopoverHeader>
          <PopoverTitle className="text-sm font-semibold text-sophia-text">
            Add a private note
          </PopoverTitle>
          <PopoverDescription className="text-xs leading-5 text-sophia-text-muted">
            Keep a thought connected to where you are reading.
          </PopoverDescription>
        </PopoverHeader>

        <div className="grid gap-1">
          <button
            type="button"
            className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => choose(onAddPage)}
          >
            <FileText className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
            Current page
            <span className="ml-auto text-xs text-sophia-text-muted">
              {currentPage}
            </span>
          </button>

          {currentChapter ? (
            <button
              type="button"
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={() => choose(onAddChapter)}
            >
              <BookOpen className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                Current chapter
              </span>
            </button>
          ) : null}

          <button
            type="button"
            className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={() => choose(onAddBook)}
          >
            <NotebookPen className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
            This book
          </button>
        </div>

        <button
          type="button"
          className="flex min-h-11 items-center gap-3 border-t border-sophia-border px-3 pt-3 text-left text-sm font-semibold text-sophia-text hover:text-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
          onClick={() => choose(onOpenNotes)}
        >
          <List className="h-4 w-4" aria-hidden="true" />
          View saved notes
          {count > 0 ? (
            <span className="ml-auto text-xs font-normal text-sophia-text-muted">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverContent>
    </Popover>
  )
}
