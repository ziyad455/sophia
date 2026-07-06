import { config } from '../config'
import type { UploadBookPayload, UploadBookResponse } from './types'

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

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    return undefined
  }

  return response.json()
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
