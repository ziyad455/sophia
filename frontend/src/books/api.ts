import { config } from '../config'
import type {
  LibraryBook,
  ListBooksResponse,
  ProcessingStatusBook,
  ProcessingStatusResponse,
  UpdateBookMetadataPayload,
  UpdateBookMetadataResponse,
  UploadBookPayload,
  UploadBookResponse,
} from './types'

type RequestOptions = {
  body?: unknown
  method?: 'GET' | 'PATCH' | 'POST'
  signal?: AbortSignal
}

export class BooksApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'BooksApiError'
    this.status = status
  }
}

function booksUrl(path: string): string {
  return `${config.apiBaseUrl}${path}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const message = value.message

  return typeof message === 'string' && message.trim() ? message : undefined
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeBook(value: unknown, index: number): LibraryBook | null {
  if (!isRecord(value)) {
    return null
  }

  const legacyId = readString(value.id)
  const userBookId = readString(value.userBookId, legacyId || `book-${index}`)
  const bookId = readString(value.bookId)
  const title = readString(value.title, 'Untitled book')
  const coverUrl = readNullableString(value.coverUrl) ?? (userBookId ? `/books/${userBookId}/cover` : null)

  return {
    id: legacyId || undefined,
    userBookId,
    bookId,
    title,
    author: readNullableString(value.author),
    language: readString(value.language, 'en'),
    status: readString(value.status, 'active'),
    processingStatus: readString(value.processingStatus, 'uploaded'),
    processingError: readNullableString(value.processingError),
    pageCount: readNullableNumber(value.pageCount),
    addedAt: readString(value.addedAt, new Date().toISOString()),
    lastOpenedAt: readNullableString(value.lastOpenedAt),
    coverUrl,
  }
}

function normalizeProcessingBook(value: unknown): ProcessingStatusBook | null {
  if (!isRecord(value)) {
    return null
  }

  const userBookId = readString(value.userBookId)
  const bookId = readString(value.bookId)

  if (!userBookId || !bookId) {
    return null
  }

  const chapterCount = readNullableNumber(value.chapterCount)
  const chunkCount = readNullableNumber(value.chunkCount)

  return {
    userBookId,
    bookId,
    processingStatus: readString(value.processingStatus, 'uploaded'),
    processingError: readNullableString(value.processingError),
    pageCount: readNullableNumber(value.pageCount),
    ...(chapterCount === null ? {} : { chapterCount }),
    ...(chunkCount === null ? {} : { chunkCount }),
  }
}

function normalizeProcessingStatusResponse(value: unknown): ProcessingStatusResponse {
  if (!isRecord(value)) {
    throw new BooksApiError(0, 'We could not read this book status right now.')
  }

  const book = normalizeProcessingBook(value.book)

  if (!book) {
    throw new BooksApiError(0, 'We could not read this book status right now.')
  }

  const message = readErrorMessage(value)

  return {
    book,
    ...(message ? { message } : {}),
  }
}

function normalizeListBooksResponse(value: unknown): ListBooksResponse {
  if (!isRecord(value) || !Array.isArray(value.books)) {
    return { books: [] }
  }

  return {
    books: value.books
      .map((book, index) => normalizeBook(book, index))
      .filter((book): book is LibraryBook => Boolean(book)),
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    return undefined
  }

  return response.json()
}

async function requestJson<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  let response: Response

  try {
    response = await fetch(booksUrl(path), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new BooksApiError(0, 'Unable to reach Sophia. Check your connection and try again.')
  }

  const data = await readJson(response)

  if (!response.ok) {
    throw new BooksApiError(
      response.status,
      readErrorMessage(data) ?? 'The request could not be completed.',
    )
  }

  return data as TResponse
}

function toFriendlyMetadataError(status: number): string {
  if (status === 400) {
    return 'Please check the book details.'
  }

  if (status === 404) {
    return 'We could not find this book in your library.'
  }

  if (status >= 500) {
    return 'We could not update this book right now.'
  }

  return 'We could not update this book right now.'
}

function toFriendlyUploadError(status: number, fallback?: string): string {
  if (status === 400) {
    return fallback ?? 'Choose a valid PDF before adding it to your library.'
  }

  if (status === 401) {
    return 'Please sign in again before adding this book.'
  }

  if (status === 409) {
    return fallback ?? 'This book is already in your library.'
  }

  if (status >= 500) {
    return 'Sophia could not add this book right now. Please try again.'
  }

  return fallback ?? 'The book could not be added to your library.'
}

function toFriendlyProcessingError(status: number, fallback?: string): string {
  if (status === 400) {
    return fallback ?? 'Sophia could not read enough selectable text from this PDF.'
  }

  if (status === 401) {
    return 'Please sign in again before preparing this book.'
  }

  if (status === 404) {
    return 'We could not find this book in your library.'
  }

  if (status === 409) {
    return fallback ?? 'This book is already being prepared.'
  }

  if (status >= 500) {
    return 'Sophia could not prepare this book right now. Please try again.'
  }

  return fallback ?? 'Sophia could not prepare this book right now.'
}

export async function listBooks(options: RequestOptions = {}): Promise<ListBooksResponse> {
  const response = await requestJson<unknown>('/books', options)

  return normalizeListBooksResponse(response)
}

export async function updateBookMetadata(
  userBookId: string,
  payload: UpdateBookMetadataPayload,
): Promise<UpdateBookMetadataResponse> {
  let response: unknown

  try {
    response = await requestJson<unknown>(`/books/${userBookId}/metadata`, {
      method: 'PATCH',
      body: payload,
    })
  } catch (error) {
    if (error instanceof BooksApiError) {
      throw new BooksApiError(error.status, toFriendlyMetadataError(error.status))
    }

    throw error
  }

  if (!isRecord(response)) {
    throw new BooksApiError(0, 'We could not update this book right now.')
  }

  const book = normalizeBook(response.book, 0)

  if (!book) {
    throw new BooksApiError(0, 'We could not update this book right now.')
  }

  return { book }
}

export async function getBookProcessingStatus(
  userBookId: string,
  options: RequestOptions = {},
): Promise<ProcessingStatusResponse> {
  const response = await requestJson<unknown>(`/books/${userBookId}/processing-status`, options)

  return normalizeProcessingStatusResponse(response)
}

async function requestProcessingStep(path: string): Promise<ProcessingStatusResponse> {
  let response: unknown

  try {
    response = await requestJson<unknown>(path, {
      method: 'POST',
    })
  } catch (error) {
    if (error instanceof BooksApiError) {
      throw new BooksApiError(
        error.status,
        toFriendlyProcessingError(error.status, error.message),
      )
    }

    throw error
  }

  return normalizeProcessingStatusResponse(response)
}

export function processBook(userBookId: string): Promise<ProcessingStatusResponse> {
  return requestProcessingStep(`/books/${userBookId}/process`)
}

export function detectBookChapters(userBookId: string): Promise<ProcessingStatusResponse> {
  return requestProcessingStep(`/books/${userBookId}/chapters/detect`)
}

export function generateBookChunks(userBookId: string): Promise<ProcessingStatusResponse> {
  return requestProcessingStep(`/books/${userBookId}/chunks/generate`)
}

export async function uploadBook(payload: UploadBookPayload): Promise<UploadBookResponse> {
  const formData = new FormData()
  const title = payload.title?.trim()
  const author = payload.author?.trim()
  const language = payload.language?.trim()

  formData.append('file', payload.file)

  if (title) {
    formData.append('title', title)
  }

  if (author) {
    formData.append('author', author)
  }

  if (language) {
    formData.append('language', language)
  }

  let response: Response

  try {
    response = await fetch(booksUrl('/books/upload'), {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
  } catch {
    throw new BooksApiError(0, 'Unable to reach Sophia. Check your connection and try again.')
  }

  const data = await readJson(response)

  if (!response.ok) {
    throw new BooksApiError(
      response.status,
      toFriendlyUploadError(response.status, readErrorMessage(data)),
    )
  }

  return data as UploadBookResponse
}
