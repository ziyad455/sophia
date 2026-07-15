import { BookOpenText, FileText } from 'lucide-react'
import type { ReaderMode } from './preferences'

type ReaderModeToggleProps = {
  mode: ReaderMode
  disabled?: boolean
  onChange: (mode: ReaderMode) => void
}

const modes = [
  { value: 'pdf' as const, label: 'Original PDF', icon: FileText },
  { value: 'reading' as const, label: 'Reading Mode', icon: BookOpenText },
]

export function ReaderModeToggle({
  mode,
  disabled = false,
  onChange,
}: ReaderModeToggleProps) {
  return (
    <div
      className="inline-grid grid-cols-2 rounded-md border border-sophia-border bg-sophia-bg p-1"
      role="group"
      aria-label="Reading view"
    >
      {modes.map((option) => {
        const Icon = option.icon
        const selected = option.value === mode

        return (
          <button
            key={option.value}
            type="button"
            className={[
              'inline-flex min-h-8 items-center justify-center gap-2 rounded px-3 text-xs font-semibold transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary',
              selected
                ? 'bg-sophia-surface text-sophia-text shadow-sm'
                : 'text-sophia-text-muted hover:text-sophia-text',
            ].join(' ')}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
