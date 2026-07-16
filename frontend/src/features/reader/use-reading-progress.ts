import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getReadingProgress,
  updateReadingProgress,
  type ReadingProgress,
  type UpdateReadingProgressPayload,
} from '../../books'

const SAVE_DEBOUNCE_MS = 1_500

type ProgressLoadState =
  | { status: 'loading' }
  | { status: 'ready'; progress: ReadingProgress }
  | { status: 'error' }

type UseReadingProgressOptions = {
  enabled: boolean
  userBookId: string
}

export function useReadingProgress({ enabled, userBookId }: UseReadingProgressOptions) {
  const [loadState, setLoadState] = useState<ProgressLoadState>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pendingSaveRef = useRef<UpdateReadingProgressPayload | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const inFlightSaveRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()

    setLoadState({ status: 'loading' })

    getReadingProgress(userBookId, { signal: controller.signal })
      .then(({ progress }) => {
        if (!controller.signal.aborted) {
          setLoadState({ status: 'ready', progress })
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (!controller.signal.aborted) {
          setLoadState({ status: 'error' })
        }
      })

    return () => controller.abort()
  }, [enabled, userBookId])

  const drainPendingSave = useCallback((): Promise<void> => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    if (inFlightSaveRef.current) {
      return inFlightSaveRef.current
    }

    const savePromise = (async () => {
      if (mountedRef.current) {
        setSaving(true)
      }

      while (pendingSaveRef.current) {
        const payload = pendingSaveRef.current

        pendingSaveRef.current = null

        try {
          await updateReadingProgress(userBookId, payload)

          if (mountedRef.current) {
            setSaveError(null)
          }
        } catch {
          pendingSaveRef.current ??= payload

          if (mountedRef.current) {
            setSaveError('We could not save your reading position.')
          }

          break
        }
      }
    })().finally(() => {
      inFlightSaveRef.current = null

      if (mountedRef.current) {
        setSaving(false)
      }
    })

    inFlightSaveRef.current = savePromise

    return savePromise
  }, [userBookId])

  const queueSave = useCallback(
    (payload: UpdateReadingProgressPayload) => {
      if (!enabled) {
        return
      }

      pendingSaveRef.current = payload

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        void drainPendingSave()
      }, SAVE_DEBOUNCE_MS)
    },
    [drainPendingSave, enabled],
  )

  const flush = useCallback(async () => {
    await drainPendingSave()
  }, [drainPendingSave])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void drainPendingSave()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [drainPendingSave])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      void drainPendingSave()
    }
  }, [drainPendingSave])

  return {
    loadState,
    queueSave,
    flush,
    saving,
    saveError,
  }
}
