import type {
  PdfFitMode,
  ReaderMode,
  ReaderPreferences,
  ReaderTheme,
  ReadingMood,
  ReadingFontFamily,
} from './reader-preferences.types'

export const READER_THEMES: Array<{ value: ReaderTheme; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export const READING_MOODS: Array<{
  value: ReadingMood
  label: string
  pageColor: string
  inkColor: string
}> = [
  {
    value: 'printed-ink',
    label: 'Printed Ink',
    pageColor: '#efe1c7',
    inkColor: '#071019',
  },
  {
    value: 'warm-paper',
    label: 'Warm Paper',
    pageColor: '#fff8ed',
    inkColor: '#2b2118',
  },
  {
    value: 'night-study',
    label: 'Night Study',
    pageColor: '#202020',
    inkColor: '#ede7dd',
  },
]

export const PDF_FIT_MODES: Array<{ value: PdfFitMode; label: string }> = [
  { value: 'fit-width', label: 'Fit width' },
  { value: 'fit-page', label: 'Fit page' },
  { value: 'custom', label: 'Custom zoom' },
]

export const PDF_ZOOM_OPTIONS = [50, 75, 100, 125, 150, 175, 200]

export const READER_MODES: Array<{ value: ReaderMode; label: string }> = [
  { value: 'pdf', label: 'Original PDF' },
  { value: 'reading', label: 'Reading Mode' },
]

export const READING_FONT_FAMILIES: Array<{
  value: ReadingFontFamily
  label: string
}> = [
  { value: 'serif', label: 'Literary serif' },
  { value: 'sans', label: 'Clean sans' },
]

export const READING_FONT_SIZES = [16, 18, 20, 22, 24]
export const READING_LINE_HEIGHTS = [1.5, 1.6, 1.7, 1.8, 1.9]
export const READING_CONTENT_WIDTHS = [
  { value: 640, label: 'Narrow' },
  { value: 720, label: 'Comfortable' },
  { value: 800, label: 'Wide' },
]

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  readerTheme: 'system',
  readingMood: 'warm-paper',
  readerMode: 'pdf',
  pdfFitMode: 'fit-width',
  pdfZoom: 100,
  readerSidebarOpen: false,
  readingFontSize: 18,
  readingFontFamily: 'serif',
  readingLineHeight: 1.6,
  readingContentWidth: 720,
}

export function getReaderThemeClass(theme: ReaderTheme): string {
  return `reader-theme-${theme}`
}

export function getReadingMoodClass(mood: ReadingMood): string {
  return `reader-mood-${mood}`
}
