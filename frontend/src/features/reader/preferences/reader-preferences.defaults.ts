import type {
  PdfFitMode,
  ReaderPreferences,
  ReaderTheme,
} from './reader-preferences.types'

export const READER_THEMES: Array<{ value: ReaderTheme; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export const PDF_FIT_MODES: Array<{ value: PdfFitMode; label: string }> = [
  { value: 'fit-width', label: 'Fit width' },
  { value: 'fit-page', label: 'Fit page' },
  { value: 'custom', label: 'Custom zoom' },
]

export const PDF_ZOOM_OPTIONS = [50, 75, 100, 125, 150, 175, 200]

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  readerTheme: 'system',
  pdfFitMode: 'fit-width',
  pdfZoom: 100,
  readerSidebarOpen: false,
}

export function getReaderThemeClass(theme: ReaderTheme): string {
  return `reader-theme-${theme}`
}
