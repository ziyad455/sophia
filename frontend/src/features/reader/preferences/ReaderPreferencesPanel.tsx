import { Check, Settings2 } from 'lucide-react'
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
  READING_MOODS,
  READING_CONTENT_WIDTHS,
  READING_FONT_FAMILIES,
  READING_FONT_SIZES,
  READING_LINE_HEIGHTS,
} from './reader-preferences.defaults'
import type {
  PdfFitMode,
  ReaderPreferences,
  ReaderPreferencesUpdate,
  ReadingFontFamily,
} from './reader-preferences.types'

type ReaderPreferencesPanelProps = {
  preferences: ReaderPreferences
  loading: boolean
  saving: boolean
  error: string | null
  moodClassName: string
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
  moodClassName,
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
        className={`${moodClassName} w-[min(20rem,calc(100vw-1.5rem))] gap-4 border border-sophia-border bg-sophia-surface p-4 text-sophia-text`}
      >
        <PopoverHeader>
          <PopoverTitle className="text-base font-semibold text-sophia-text">
            Reader settings
          </PopoverTitle>
          <PopoverDescription className="text-sm text-sophia-text-muted">
            {preferences.readerMode === 'pdf'
              ? 'Settings for the original document.'
              : 'Typography for Sophia Reading Mode.'}
          </PopoverDescription>
        </PopoverHeader>

        <div className="grid gap-4">
          <fieldset className="grid gap-2" disabled={loading}>
            <legend className="mb-1 text-sm font-medium text-sophia-text">
              Reading Mood
            </legend>
            {READING_MOODS.map((mood) => {
              const selected = preferences.readingMood === mood.value

              return (
                <label
                  key={mood.value}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-sophia-primary ${selected ? 'border-sophia-primary bg-sophia-bg text-sophia-text' : 'border-sophia-border text-sophia-text-muted hover:bg-sophia-bg'} ${loading ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="reading-mood"
                    value={mood.value}
                    className="sr-only"
                    checked={selected}
                    onChange={() => onChange({ readingMood: mood.value })}
                  />
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[3px] border border-black/15"
                    style={{ backgroundColor: mood.pageColor }}
                    aria-hidden="true"
                  >
                    <span
                      className="h-3.5 w-[2px] rounded-full"
                      style={{ backgroundColor: mood.inkColor }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">{mood.label}</span>
                  {selected ? (
                    <Check className="h-4 w-4 text-sophia-primary" aria-hidden="true" />
                  ) : null}
                </label>
              )
            })}
          </fieldset>

          {preferences.readerMode === 'pdf' ? (
            <>
              <p className="m-0 text-xs font-bold uppercase text-sophia-text-muted">
                Original PDF
              </p>
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
            </>
          ) : (
            <>
              <p className="m-0 text-xs font-bold uppercase text-sophia-text-muted">
                Reading Mode
              </p>
              <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
                Reading type
                <select
                  className={fieldClassName}
                  value={preferences.readingFontFamily}
                  disabled={loading}
                  onChange={(event) =>
                    onChange({
                      readingFontFamily: event.target.value as ReadingFontFamily,
                    })
                  }
                >
                  {READING_FONT_FAMILIES.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
                Text size
                <select
                  className={fieldClassName}
                  value={preferences.readingFontSize}
                  disabled={loading}
                  onChange={(event) =>
                    onChange({ readingFontSize: Number(event.target.value) })
                  }
                >
                  {READING_FONT_SIZES.map((fontSize) => (
                    <option key={fontSize} value={fontSize}>
                      {fontSize}px
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
                Line spacing
                <select
                  className={fieldClassName}
                  value={preferences.readingLineHeight}
                  disabled={loading}
                  onChange={(event) =>
                    onChange({ readingLineHeight: Number(event.target.value) })
                  }
                >
                  {READING_LINE_HEIGHTS.map((lineHeight) => (
                    <option key={lineHeight} value={lineHeight}>
                      {lineHeight}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-sophia-text">
                Text width
                <select
                  className={fieldClassName}
                  value={preferences.readingContentWidth}
                  disabled={loading}
                  onChange={(event) =>
                    onChange({ readingContentWidth: Number(event.target.value) })
                  }
                >
                  {READING_CONTENT_WIDTHS.map((width) => (
                    <option key={width.value} value={width.value}>
                      {width.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
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
