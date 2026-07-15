import { config } from '../../../config'
import { DEFAULT_READER_PREFERENCES } from './reader-preferences.defaults'
import type {
  PdfFitMode,
  ReaderMode,
  ReaderPreferences,
  ReaderPreferencesResponse,
  ReaderPreferencesUpdate,
  ReaderTheme,
  ReadingFontFamily,
} from './reader-preferences.types'

const readerThemes = new Set<ReaderTheme>(['system', 'light', 'dark'])
const readerModes = new Set<ReaderMode>(['pdf', 'reading'])
const pdfFitModes = new Set<PdfFitMode>(['fit-width', 'fit-page', 'custom'])
const readingFontFamilies = new Set<ReadingFontFamily>(['serif', 'sans'])

export class ReaderPreferencesApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ReaderPreferencesApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readMessage(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return typeof value.message === 'string' && value.message.trim()
    ? value.message
    : undefined
}

function normalizePreferences(value: unknown): ReaderPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_READER_PREFERENCES }
  }

  const readerTheme = readerThemes.has(value.readerTheme as ReaderTheme)
    ? (value.readerTheme as ReaderTheme)
    : DEFAULT_READER_PREFERENCES.readerTheme
  const readerMode = readerModes.has(value.readerMode as ReaderMode)
    ? (value.readerMode as ReaderMode)
    : DEFAULT_READER_PREFERENCES.readerMode
  const pdfFitMode = pdfFitModes.has(value.pdfFitMode as PdfFitMode)
    ? (value.pdfFitMode as PdfFitMode)
    : DEFAULT_READER_PREFERENCES.pdfFitMode
  const pdfZoom =
    typeof value.pdfZoom === 'number' &&
    Number.isInteger(value.pdfZoom) &&
    value.pdfZoom >= 50 &&
    value.pdfZoom <= 200
      ? value.pdfZoom
      : DEFAULT_READER_PREFERENCES.pdfZoom

  return {
    readerTheme,
    readerMode,
    pdfFitMode,
    pdfZoom,
    readerSidebarOpen:
      typeof value.readerSidebarOpen === 'boolean'
        ? value.readerSidebarOpen
        : DEFAULT_READER_PREFERENCES.readerSidebarOpen,
    readingFontSize:
      typeof value.readingFontSize === 'number' &&
      Number.isInteger(value.readingFontSize) &&
      value.readingFontSize >= 16 &&
      value.readingFontSize <= 24
        ? value.readingFontSize
        : DEFAULT_READER_PREFERENCES.readingFontSize,
    readingFontFamily: readingFontFamilies.has(
      value.readingFontFamily as ReadingFontFamily,
    )
      ? (value.readingFontFamily as ReadingFontFamily)
      : DEFAULT_READER_PREFERENCES.readingFontFamily,
    readingLineHeight:
      typeof value.readingLineHeight === 'number' &&
      value.readingLineHeight >= 1.5 &&
      value.readingLineHeight <= 1.9
        ? value.readingLineHeight
        : DEFAULT_READER_PREFERENCES.readingLineHeight,
    readingContentWidth:
      typeof value.readingContentWidth === 'number' &&
      Number.isInteger(value.readingContentWidth) &&
      value.readingContentWidth >= 640 &&
      value.readingContentWidth <= 800
        ? value.readingContentWidth
        : DEFAULT_READER_PREFERENCES.readingContentWidth,
  }
}

async function requestReaderPreferences(
  method: 'GET' | 'PATCH',
  options: { body?: ReaderPreferencesUpdate; signal?: AbortSignal } = {},
): Promise<ReaderPreferencesResponse> {
  let response: Response

  try {
    response = await fetch(`${config.apiBaseUrl}/preferences/reader`, {
      method,
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new ReaderPreferencesApiError(
      0,
      'Unable to reach Sophia. Check your connection and try again.',
    )
  }

  const contentType = response.headers.get('content-type')
  const data: unknown = contentType?.includes('application/json')
    ? await response.json()
    : undefined

  if (!response.ok) {
    throw new ReaderPreferencesApiError(
      response.status,
      readMessage(data) ?? 'Reader preferences request failed.',
    )
  }

  const preferences = isRecord(data) ? data.preferences : undefined

  return { preferences: normalizePreferences(preferences) }
}

export function getReaderPreferences(options: { signal?: AbortSignal } = {}) {
  return requestReaderPreferences('GET', options)
}

export function patchReaderPreferences(update: ReaderPreferencesUpdate) {
  return requestReaderPreferences('PATCH', { body: update })
}
