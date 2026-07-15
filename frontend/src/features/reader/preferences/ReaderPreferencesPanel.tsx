import { Settings2 } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  PDF_FIT_MODES,
  PDF_ZOOM_OPTIONS,
  READER_THEMES,
} from './reader-preferences.defaults'
import type {
  PdfFitMode,
  ReaderPreferences,
  ReaderPreferencesUpdate,
  ReaderTheme,
} from './reader-preferences.types'

type ReaderPreferencesPanelProps = {
  preferences: ReaderPreferences
  loading: boolean
  saving: boolean
  error: string | null
  themeClassName: string
  onChange: (update: ReaderPreferencesUpdate) => void
  onReset: () => void
}

const fieldClassName =
  'min-h-10 w-full rounded-md border border-sophia-border bg-sophia-bg px-3 text-sm text-sophia-text outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-not-allowed disabled:opacity-60'

export function ReaderPreferencesPanel({
  preferences,
  loading,
  saving,
  error,
  themeClassName,
  onChange,
  onReset,
}: ReaderPreferencesPanelProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            aria-label="Reader settings"
          />
        }
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Settings</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={`${themeClassName} w-[min(20rem,calc(100vw-1.5rem))] gap-4 border border-sophia-border bg-sophia-surface p-4 text-sophia-text`}
      >
        <PopoverHeader>
          <PopoverTitle className="text-base font-semibold text-sophia-text">
            Reader settings
          </PopoverTitle>
          <PopoverDescription className="text-sm text-sophia-text-muted">
            Applied to every book in your library.
          </PopoverDescription>
        </PopoverHeader>

        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
            Theme
            <select
              className={fieldClassName}
              value={preferences.readerTheme}
              disabled={loading}
              onChange={(event) =>
                onChange({ readerTheme: event.target.value as ReaderTheme })
              }
            >
              {READER_THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
            Page sizing
            <select
              className={fieldClassName}
              value={preferences.pdfFitMode}
              disabled={loading}
              onChange={(event) =>
                onChange({ pdfFitMode: event.target.value as PdfFitMode })
              }
            >
              {PDF_FIT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          {preferences.pdfFitMode === 'custom' ? (
            <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
              Zoom
              <select
                className={fieldClassName}
                value={preferences.pdfZoom}
                disabled={loading}
                onChange={(event) => onChange({ pdfZoom: Number(event.target.value) })}
              >
                {PDF_ZOOM_OPTIONS.map((zoom) => (
                  <option key={zoom} value={zoom}>
                    {zoom}%
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-sophia-border bg-sophia-bg px-3 text-sm font-medium text-sophia-text">
            Open thumbnails by default
            <input
              type="checkbox"
              className="h-5 w-5 accent-sophia-primary"
              checked={preferences.readerSidebarOpen}
              disabled={loading}
              onChange={(event) =>
                onChange({ readerSidebarOpen: event.target.checked })
              }
            />
          </label>
        </div>

        <div className="flex min-h-8 items-center justify-between gap-3 border-t border-sophia-border pt-3">
          <p className="m-0 text-xs text-sophia-text-muted" aria-live="polite">
            {loading ? 'Loading settings...' : saving ? 'Saving...' : error}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            disabled={loading}
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
