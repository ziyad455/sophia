import { config } from '../../../config'
import type {
  ReadingSession,
  StartReadingSessionInput,
  UpdateReadingSessionInput,
} from './reading-session.types'

const READING_SESSION_REQUEST_TIMEOUT_MS = 10_000

export class ReadingSessionApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ReadingSessionApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readErrorMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.message === 'string' && value.message.trim()
    ? value.message
    : null
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNullablePage(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 1 ? value as number : null
}

function normalizeReadingSession(value: unknown): ReadingSession | null {
  if (!isRecord(value)) {
    return null
  }

  const readerMode = value.readerMode === 'pdf' || value.readerMode === 'reading'
    ? value.readerMode
    : null

  if (
    typeof value.id !== 'string' ||
    typeof value.userBookId !== 'string' ||
    typeof value.startedAt !== 'string' ||
    (value.endedAt !== null && typeof value.endedAt !== 'string') ||
    !Number.isInteger(value.activeDurationSeconds) ||
    (value.activeDurationSeconds as number) < 0 ||
    !Number.isSafeInteger(value.updateSequence) ||
    (value.updateSequence as number) < 0
  ) {
    return null
  }

  return {
    id: value.id,
    userBookId: value.userBookId,
    startedAt: value.startedAt,
    endedAt: value.endedAt as string | null,
    activeDurationSeconds: value.activeDurationSeconds as number,
    startPage: readNullablePage(value.startPage),
    endPage: readNullablePage(value.endPage),
    startChapterId: readNullableString(value.startChapterId),
    endChapterId: readNullableString(value.endChapterId),
    readerMode,
    updateSequence: value.updateSequence as number,
  }
}

async function requestReadingSession(
  path: string,
  method: 'PATCH' | 'POST',
  body: unknown,
  keepalive = false,
): Promise<ReadingSession> {
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    READING_SESSION_REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(config.apiBaseUrl + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
      signal: controller.signal,
    })
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : undefined

    if (!response.ok) {
      throw new ReadingSessionApiError(
        response.status,
        readErrorMessage(data) ?? 'The reading session could not be recorded.',
      )
    }

    const session = isRecord(data) ? normalizeReadingSession(data.session) : null

    if (!session) {
      throw new ReadingSessionApiError(
        0,
        'Sophia returned an unreadable reading-session response.',
      )
    }

    return session
  } catch (error) {
    if (error instanceof ReadingSessionApiError) {
      throw error
    }

    throw new ReadingSessionApiError(
      0,
      'Unable to reach Sophia while recording this reading session.',
    )
  } finally {
    window.clearTimeout(timeout)
  }
}

function sessionPath(userBookId: string): string {
  return '/books/' + encodeURIComponent(userBookId) + '/reading-sessions'
}

export function startReadingSession(
  userBookId: string,
  input: StartReadingSessionInput,
): Promise<ReadingSession> {
  return requestReadingSession(sessionPath(userBookId), 'POST', input)
}

export function updateReadingSession(
  userBookId: string,
  sessionId: string,
  input: UpdateReadingSessionInput,
  options: { keepalive?: boolean } = {},
): Promise<ReadingSession> {
  return requestReadingSession(
    sessionPath(userBookId) + '/' + encodeURIComponent(sessionId),
    'PATCH',
    input,
    options.keepalive,
  )
}

export function endReadingSession(
  userBookId: string,
  sessionId: string,
  input: UpdateReadingSessionInput,
  options: { keepalive?: boolean } = {},
): Promise<ReadingSession> {
  return requestReadingSession(
    sessionPath(userBookId) + '/' + encodeURIComponent(sessionId) + '/end',
    'POST',
    input,
    options.keepalive,
  )
}
