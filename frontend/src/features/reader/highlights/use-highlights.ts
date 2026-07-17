import { useCallback, useEffect, useState } from 'react'
import type { ReaderSelection } from '../selection'
import {
  createHighlight as createHighlightRequest,
  deleteHighlight as deleteHighlightRequest,
  getBookHighlights,
  HighlightsApiError,
} from './highlight.api'
import type { HighlightColor, ReaderHighlight } from './highlight.types'
import { isStructurallyUnresolved, sortHighlights } from './highlight.utils'

type HighlightsState =
  | { status: 'idle'; userBookId: null; highlights: ReaderHighlight[] }
  | { status: 'loading'; userBookId: string; highlights: ReaderHighlight[] }
  | { status: 'ready'; userBookId: string; highlights: ReaderHighlight[] }
  | { status: 'error'; userBookId: string; highlights: ReaderHighlight[]; message: string }

type UseHighlightsOptions = {
  enabled: boolean
  userBookId: string
}

function mutationMessage(error: unknown, action: 'create' | 'delete'): string {
  if (error instanceof HighlightsApiError && error.status === 409) {
    return error.message || 'This passage overlaps an existing highlight.'
  }

  if (error instanceof HighlightsApiError && error.status === 401) {
    return 'Please sign in again to save your highlights.'
  }

  return action === 'create'
    ? 'We could not save this highlight.'
    : 'We could not delete this highlight.'
}

export function useHighlights({ enabled, userBookId }: UseHighlightsOptions) {
  const [state, setState] = useState<HighlightsState>({
    status: 'idle',
    userBookId: null,
    highlights: [],
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const [mutationError, setMutationError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !userBookId) {
      setState({ status: 'idle', userBookId: null, highlights: [] })
      return
    }

    const controller = new AbortController()
    let active = true

    setState({ status: 'loading', userBookId, highlights: [] })
    setMutationError(null)

    void getBookHighlights(userBookId, { signal: controller.signal })
      .then((highlights) => {
        if (active) {
          setState({
            status: 'ready',
            userBookId,
            highlights: sortHighlights(highlights),
          })
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return
        }

        setState({
          status: 'error',
          userBookId,
          highlights: [],
          message: 'We could not load your highlights.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [enabled, loadAttempt, userBookId])

  const createHighlight = useCallback(async (
    selection: ReaderSelection,
    color: HighlightColor,
  ) => {
    setSaving(true)
    setMutationError(null)

    try {
      const highlight = await createHighlightRequest(userBookId, selection, color)

      setState((current) => current.userBookId === userBookId
        ? {
            status: 'ready',
            userBookId,
            highlights: sortHighlights([
              ...current.highlights.filter((item) => item.id !== highlight.id),
              highlight,
            ]),
          }
        : current)

      return highlight
    } catch (error) {
      setMutationError(mutationMessage(error, 'create'))
      throw error
    } finally {
      setSaving(false)
    }
  }, [userBookId])

  const deleteHighlight = useCallback(async (highlightId: string) => {
    setDeletingIds((current) => new Set(current).add(highlightId))
    setMutationError(null)

    try {
      await deleteHighlightRequest(userBookId, highlightId)
      setState((current) => current.userBookId === userBookId
        ? {
            status: 'ready',
            userBookId,
            highlights: current.highlights.filter(
              (highlight) => highlight.id !== highlightId,
            ),
          }
        : current)
    } catch (error) {
      setMutationError(mutationMessage(error, 'delete'))
      throw error
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current)

        next.delete(highlightId)
        return next
      })
    }
  }, [userBookId])

  const refreshHighlights = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1)
  }, [])
  const clearMutationError = useCallback(() => setMutationError(null), [])
  const currentHighlights = state.userBookId === userBookId ? state.highlights : []
  const unresolvedHighlights = currentHighlights.filter(isStructurallyUnresolved)

  return {
    highlights: currentHighlights,
    loading: state.status === 'loading' && state.userBookId === userBookId,
    loadError:
      state.status === 'error' && state.userBookId === userBookId
        ? state.message
        : null,
    mutationError,
    saving,
    deletingIds,
    unresolvedHighlights,
    createHighlight,
    deleteHighlight,
    refreshHighlights,
    clearMutationError,
  }
}
