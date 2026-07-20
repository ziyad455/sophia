import { config } from '../../../config'
import type {
  CreateNoteInput,
  NewNoteSource,
  NoteContext,
  NoteType,
  ReaderNote,
} from './note.types'

export class NotesApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'NotesApiError'
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

function normalizeNote(value: unknown): ReaderNote | null {
  if (!isRecord(value)) {
    return null
  }

  const contexts: NoteContext[] = ['passage', 'highlight', 'page', 'chapter', 'book']
  const type: NoteType | null = value.type === 'margin_note' ? value.type : null
  const context = typeof value.context === 'string' &&
    contexts.includes(value.context as NoteContext)
    ? value.context as NoteContext
    : null

  if (
    typeof value.id !== 'string' ||
    !type ||
    !context ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    type,
    context,
    content: value.content,
    quote: readNullableString(value.quote),
    highlightId: readNullableString(value.highlightId),
    pageStart: Number.isInteger(value.pageStart) ? value.pageStart as number : null,
    pageEnd: Number.isInteger(value.pageEnd) ? value.pageEnd as number : null,
    chapterId: readNullableString(value.chapterId),
    chapterTitle: readNullableString(value.chapterTitle),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

async function requestNotes(
  path: string,
  options: {
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST'
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<unknown> {
  try {
    const response = await fetch(config.apiBaseUrl + path, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : undefined

    if (!response.ok) {
      throw new NotesApiError(
        response.status,
        readErrorMessage(data) ?? 'The note request could not be completed.',
      )
    }

    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (error instanceof NotesApiError) {
      throw error
    }

    throw new NotesApiError(
      0,
      'Unable to reach Sophia. Check your connection and try again.',
    )
  }
}

function sourcePayload(source: NewNoteSource): Record<string, unknown> {
  if (source.kind === 'highlight') {
    return { highlightId: source.highlightId }
  }

  if (source.kind === 'passage') {
    return {
      quote: source.quote,
      pageStart: source.pageStart,
      pageEnd: source.pageEnd,
      chapterId: source.chapterId,
      anchor: source.anchor,
    }
  }

  if (source.kind === 'page') {
    return {
      pageStart: source.pageNumber,
      pageEnd: source.pageNumber,
    }
  }

  if (source.kind === 'chapter') {
    return { chapterId: source.chapterId }
  }

  return {}
}

export async function getBookNotes(
  userBookId: string,
  options: { signal?: AbortSignal } = {},
): Promise<ReaderNote[]> {
  const response = await requestNotes(
    '/books/' + encodeURIComponent(userBookId) + '/notes',
    { signal: options.signal },
  )

  if (!isRecord(response) || !Array.isArray(response.notes)) {
    throw new NotesApiError(0, 'We could not read your notes.')
  }

  return response.notes.flatMap((value) => {
    const note = normalizeNote(value)

    return note ? [note] : []
  })
}

export async function getBookNote(
  userBookId: string,
  noteId: string,
): Promise<ReaderNote> {
  const response = await requestNotes(
    '/books/' + encodeURIComponent(userBookId) +
      '/notes/' + encodeURIComponent(noteId),
  )
  const note = isRecord(response) ? normalizeNote(response.note) : null

  if (!note) {
    throw new NotesApiError(0, 'We could not read this note.')
  }

  return note
}

export async function createNote(
  userBookId: string,
  input: CreateNoteInput,
): Promise<ReaderNote> {
  const response = await requestNotes(
    '/books/' + encodeURIComponent(userBookId) + '/notes',
    {
      method: 'POST',
      body: {
        type: 'margin_note',
        content: input.content,
        ...sourcePayload(input.source),
      },
    },
  )
  const note = isRecord(response) ? normalizeNote(response.note) : null

  if (!note) {
    throw new NotesApiError(0, 'We could not read the saved note.')
  }

  return note
}

export async function updateNote(
  userBookId: string,
  noteId: string,
  content: string,
): Promise<ReaderNote> {
  const response = await requestNotes(
    '/books/' + encodeURIComponent(userBookId) +
      '/notes/' + encodeURIComponent(noteId),
    {
      method: 'PATCH',
      body: { content },
    },
  )
  const note = isRecord(response) ? normalizeNote(response.note) : null

  if (!note) {
    throw new NotesApiError(0, 'We could not read the updated note.')
  }

  return note
}

export async function deleteNote(
  userBookId: string,
  noteId: string,
): Promise<void> {
  await requestNotes(
    '/books/' + encodeURIComponent(userBookId) +
      '/notes/' + encodeURIComponent(noteId),
    { method: 'DELETE' },
  )
}
