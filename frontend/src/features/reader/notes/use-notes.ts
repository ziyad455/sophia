import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createNote as createNoteRequest,
  deleteNote as deleteNoteRequest,
  getBookNotes,
  NotesApiError,
  updateNote as updateNoteRequest,
} from './note.api'
import type { CreateNoteInput, ReaderNote } from './note.types'
import { sortReaderNotes } from './note.utils'

type NotesState =
  | { status: 'idle'; userBookId: null; notes: ReaderNote[] }
  | { status: 'loading'; userBookId: string; notes: ReaderNote[] }
  | { status: 'ready'; userBookId: string; notes: ReaderNote[] }
  | { status: 'error'; userBookId: string; notes: ReaderNote[]; message: string }

type UseNotesOptions = {
  enabled: boolean
  userBookId: string
}

function mutationMessage(
  error: unknown,
  action: 'create' | 'update' | 'delete',
): string {
  if (error instanceof NotesApiError && error.status === 401) {
    return 'Please sign in again to manage your notes.'
  }

  if (action === 'delete') {
    return 'We could not delete this note.'
  }

  return 'We could not save this note.'
}

export function useNotes({ enabled, userBookId }: UseNotesOptions) {
  const [state, setState] = useState<NotesState>({
    status: 'idle',
    userBookId: null,
    notes: [],
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const [mutationError, setMutationError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !userBookId) {
      setState({ status: 'idle', userBookId: null, notes: [] })
      return
    }

    const controller = new AbortController()
    let active = true

    setState((current) => ({
      status: 'loading',
      userBookId,
      notes: current.userBookId === userBookId ? current.notes : [],
    }))
    setMutationError(null)

    void getBookNotes(userBookId, { signal: controller.signal })
      .then((notes) => {
        if (active) {
          setState({
            status: 'ready',
            userBookId,
            notes: sortReaderNotes(notes),
          })
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return
        }

        setState((current) => ({
          status: 'error',
          userBookId,
          notes: current.userBookId === userBookId ? current.notes : [],
          message: 'We could not load your notes.',
        }))
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [enabled, loadAttempt, userBookId])

  const createNote = useCallback(async (input: CreateNoteInput) => {
    setSaving(true)
    setMutationError(null)

    try {
      const note = await createNoteRequest(userBookId, input)

      setState((current) => current.userBookId === userBookId
        ? {
            status: 'ready',
            userBookId,
            notes: sortReaderNotes([
              ...current.notes.filter((candidate) => candidate.id !== note.id),
              note,
            ]),
          }
        : current)

      return note
    } catch (error) {
      setMutationError(mutationMessage(error, 'create'))
      throw error
    } finally {
      setSaving(false)
    }
  }, [userBookId])

  const updateNote = useCallback(async (noteId: string, content: string) => {
    setUpdatingIds((current) => new Set(current).add(noteId))
    setMutationError(null)

    try {
      const note = await updateNoteRequest(userBookId, noteId, content)

      setState((current) => current.userBookId === userBookId
        ? {
            status: 'ready',
            userBookId,
            notes: sortReaderNotes(
              current.notes.map((candidate) =>
                candidate.id === note.id ? note : candidate,
              ),
            ),
          }
        : current)

      return note
    } catch (error) {
      setMutationError(mutationMessage(error, 'update'))
      throw error
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current)

        next.delete(noteId)
        return next
      })
    }
  }, [userBookId])

  const deleteNote = useCallback(async (noteId: string) => {
    setDeletingIds((current) => new Set(current).add(noteId))
    setMutationError(null)

    try {
      await deleteNoteRequest(userBookId, noteId)
      setState((current) => current.userBookId === userBookId
        ? {
            status: 'ready',
            userBookId,
            notes: current.notes.filter((note) => note.id !== noteId),
          }
        : current)
    } catch (error) {
      setMutationError(mutationMessage(error, 'delete'))
      throw error
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current)

        next.delete(noteId)
        return next
      })
    }
  }, [userBookId])

  const refreshNotes = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1)
  }, [])
  const clearMutationError = useCallback(() => setMutationError(null), [])
  const currentNotes = useMemo(
    () => state.userBookId === userBookId ? state.notes : [],
    [state.notes, state.userBookId, userBookId],
  )

  const notesForHighlight = useCallback(
    (highlightId: string) =>
      currentNotes.filter((note) => note.highlightId === highlightId),
    [currentNotes],
  )
  const notesForPage = useCallback(
    (pageNumber: number) =>
      currentNotes.filter(
        (note) =>
          note.pageStart !== null &&
          note.pageStart <= pageNumber &&
          (note.pageEnd ?? note.pageStart) >= pageNumber,
      ),
    [currentNotes],
  )
  const notesForChapter = useCallback(
    (chapterId: string) =>
      currentNotes.filter((note) => note.chapterId === chapterId),
    [currentNotes],
  )

  return {
    notes: currentNotes,
    loading: state.status === 'loading' && state.userBookId === userBookId,
    loadError:
      state.status === 'error' && state.userBookId === userBookId
        ? state.message
        : null,
    mutationError,
    saving,
    updatingIds,
    deletingIds,
    createNote,
    updateNote,
    deleteNote,
    refreshNotes,
    clearMutationError,
    notesForHighlight,
    notesForPage,
    notesForChapter,
  }
}
