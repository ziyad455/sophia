import { useRef, type KeyboardEvent } from 'react'
import type { AnnotationTab } from './annotation.types'

type AnnotationTabsProps = {
  activeTab: AnnotationTab
  highlightCount: number
  noteCount: number
  onChange: (tab: AnnotationTab) => void
}

const tabs: { id: AnnotationTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'notes', label: 'Notes' },
]

export function AnnotationTabs({
  activeTab,
  highlightCount,
  noteCount,
  onChange,
}: AnnotationTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const counts: Record<AnnotationTab, number> = {
    all: highlightCount + noteCount,
    highlights: highlightCount,
    notes: noteCount,
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = tabs[nextIndex]

    onChange(nextTab.id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      className="grid grid-cols-3 gap-1 border-b border-sophia-border px-3 py-2"
      role="tablist"
      aria-label="Annotation views"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab

        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            id={`annotations-tab-${tab.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls={`annotations-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={
              'min-h-10 rounded-md px-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary ' +
              (selected
                ? 'bg-sophia-bg text-sophia-text'
                : 'text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text')
            }
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
            <span className="ml-1 text-xs font-normal text-sophia-text-muted">
              {counts[tab.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
