import { useEffect } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { Highlighter, LoaderCircle, NotebookPen, X } from 'lucide-react'
import type { HighlightColor } from '../highlights'
import type { HighlightColorOption } from '../../../theme'
import type { ReaderSelection } from './reader-selection.types'

type ReaderSelectionToolbarProps = {
  selection: ReaderSelection | null
  error: string | null
  saving: boolean
  color: HighlightColor
  colors: readonly HighlightColorOption[]
  onColorChange: (color: HighlightColor) => void
  onHighlight: () => void | Promise<void>
  onAddNote: () => void
  onClear: () => void
  onDismissError: () => void
}

type ToolbarStyle = CSSProperties & {
  '--selection-toolbar-left'?: string
  '--selection-toolbar-top'?: string
}

const TOOLBAR_WIDTH = 420
const TOOLBAR_HEIGHT = 48
const VIEWPORT_PADDING = 12
const HEADER_CLEARANCE = 112

function getToolbarPlacement(selection: ReaderSelection): {
  position: 'bottom' | 'floating'
  style: ToolbarStyle
} {
  const viewportRects = selection.boundingRects.filter(
    (rect) => rect.coordinateSpace === 'viewport',
  )
  const anchor = viewportRects.at(-1)

  if (
    !anchor ||
    anchor.y + anchor.height < HEADER_CLEARANCE ||
    anchor.y > window.innerHeight
  ) {
    return { position: 'bottom', style: {} }
  }

  const centeredLeft = anchor.x + anchor.width / 2 - TOOLBAR_WIDTH / 2
  const left = Math.min(
    window.innerWidth - TOOLBAR_WIDTH - VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, centeredLeft),
  )
  const top = anchor.y >= HEADER_CLEARANCE + TOOLBAR_HEIGHT + 10
    ? anchor.y - TOOLBAR_HEIGHT - 10
    : anchor.y + anchor.height + 10

  return {
    position: 'floating',
    style: {
      '--selection-toolbar-left': `${left}px`,
      '--selection-toolbar-top': `${Math.max(VIEWPORT_PADDING, top)}px`,
    },
  }
}

function preserveMouseSelection(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType === 'mouse') {
    event.preventDefault()
  }
}

function getSelectionLabel(selection: ReaderSelection): string {
  if (selection.pageStart === null || selection.pageEnd === null) {
    return 'Passage selected'
  }

  return selection.pageStart === selection.pageEnd
    ? `Selected, page ${selection.pageStart}`
    : `Selected, pages ${selection.pageStart}-${selection.pageEnd}`
}

export function ReaderSelectionToolbar({
  selection,
  error,
  saving,
  color,
  colors,
  onColorChange,
  onHighlight,
  onAddNote,
  onClear,
  onDismissError,
}: ReaderSelectionToolbarProps) {
  useEffect(() => {
    if (!selection && !error) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (error) {
        onDismissError()
      } else {
        onClear()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => document.removeEventListener('keydown', handleEscape)
  }, [error, onClear, onDismissError, selection])

  if (error) {
    return (
      <div
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-sophia-border bg-sophia-surface px-4 py-3 text-sm text-sophia-text shadow-lg"
        data-reader-selection-toolbar
        role="alert"
      >
        <span className="min-w-0 flex-1">{error}</span>
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
          onClick={onDismissError}
          aria-label="Dismiss selection message"
          title="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  if (!selection) {
    return null
  }

  const placement = getToolbarPlacement(selection)

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-50 flex h-12 w-[min(94vw,420px)] -translate-x-1/2 items-center gap-1.5 rounded-lg border border-sophia-border bg-sophia-surface px-2 text-sm text-sophia-text shadow-lg sm:data-[position=floating]:bottom-auto sm:data-[position=floating]:left-[var(--selection-toolbar-left)] sm:data-[position=floating]:top-[var(--selection-toolbar-top)] sm:data-[position=floating]:w-[420px] sm:data-[position=floating]:translate-x-0"
      data-position={placement.position}
      data-reader-selection-toolbar
      onPointerDown={preserveMouseSelection}
      style={placement.style}
    >
      <span className="sr-only">{getSelectionLabel(selection)}</span>
      <div className="flex items-center gap-1" aria-label="Highlight color">
        {colors.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`grid h-9 w-9 place-items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary ${color === option.id ? 'bg-sophia-bg ring-1 ring-sophia-border' : 'hover:bg-sophia-bg'}`}
            onClick={() => onColorChange(option.id)}
            disabled={saving}
            aria-label={`Use ${option.label}`}
            aria-pressed={color === option.id}
            title={option.label}
          >
            <span
              className="h-4 w-4 rounded-[2px] border border-black/10"
              style={{ backgroundColor: option.value }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <span className="h-6 w-px bg-sophia-border" aria-hidden="true" />
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-sophia-text hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-wait disabled:opacity-60 min-[400px]:w-auto min-[400px]:min-w-20 min-[400px]:px-2"
        onClick={() => void onHighlight()}
        disabled={saving}
        aria-label={saving ? 'Saving highlight' : 'Save highlight'}
      >
        {saving ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Highlighter className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden min-[400px]:inline">
          {saving ? 'Saving' : 'Highlight'}
        </span>
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-sophia-text hover:bg-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:opacity-60 min-[400px]:w-auto min-[400px]:min-w-20 min-[400px]:px-2"
        onClick={onAddNote}
        disabled={saving}
        aria-label="Add note about selected passage"
      >
        <NotebookPen className="h-4 w-4" aria-hidden="true" />
        <span className="hidden min-[400px]:inline">Add note</span>
      </button>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
        onClick={onClear}
        aria-label="Clear selected passage"
        title="Clear selection"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
