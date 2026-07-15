export type ReaderTheme = 'system' | 'light' | 'dark'
export type ReaderMode = 'pdf' | 'reading'
export type PdfFitMode = 'fit-width' | 'fit-page' | 'custom'
export type ReadingFontFamily = 'serif' | 'sans'

export type ReaderPreferences = {
  readerTheme: ReaderTheme
  readerMode: ReaderMode
  pdfFitMode: PdfFitMode
  pdfZoom: number
  readerSidebarOpen: boolean
  readingFontSize: number
  readingFontFamily: ReadingFontFamily
  readingLineHeight: number
  readingContentWidth: number
}

export type ReaderPreferencesUpdate = Partial<ReaderPreferences>

export type ReaderPreferencesResponse = {
  preferences: ReaderPreferences
}
