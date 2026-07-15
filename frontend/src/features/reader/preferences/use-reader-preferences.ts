import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getReaderPreferences,
  patchReaderPreferences,
} from './reader-preferences.api'
import { DEFAULT_READER_PREFERENCES } from './reader-preferences.defaults'
import type {
  ReaderPreferences,
  ReaderPreferencesUpdate,
} from './reader-preferences.types'

function applyUpdate(
  preferences: ReaderPreferences,
  update: ReaderPreferencesUpdate,
): ReaderPreferences {
  return { ...preferences, ...update }
}

function hasPreferenceChanges(
  preferences: ReaderPreferences,
  update: ReaderPreferencesUpdate,
): boolean {
  return Object.entries(update).some(
    ([key, value]) => preferences[key as keyof ReaderPreferences] !== value,
  )
}

export function useReaderPreferences() {
  const [preferences, setPreferences] = useState<ReaderPreferences>({
    ...DEFAULT_READER_PREFERENCES,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preferencesRef = useRef(preferences)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const latestSaveIdRef = useRef(0)
  const pendingSaveCountRef = useRef(0)
  const hasLocalChangesRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    getReaderPreferences({ signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted || hasLocalChangesRef.current) {
          return
        }

        preferencesRef.current = response.preferences
        setPreferences(response.preferences)
        setError(null)
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load your reader settings. Using defaults for now.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  const updatePreferences = useCallback((update: ReaderPreferencesUpdate) => {
    const currentPreferences = preferencesRef.current

    if (!hasPreferenceChanges(currentPreferences, update)) {
      return
    }

    const nextPreferences = applyUpdate(currentPreferences, update)
    const saveId = latestSaveIdRef.current + 1

    latestSaveIdRef.current = saveId
    pendingSaveCountRef.current += 1
    hasLocalChangesRef.current = true
    preferencesRef.current = nextPreferences
    setPreferences(nextPreferences)
    setSaving(true)
    setError(null)

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const response = await patchReaderPreferences(update)

          if (!mountedRef.current || saveId !== latestSaveIdRef.current) {
            return
          }

          preferencesRef.current = response.preferences
          setPreferences(response.preferences)
          setError(null)
        } catch {
          if (mountedRef.current && saveId === latestSaveIdRef.current) {
            setError('We could not save your reader settings.')
          }
        } finally {
          pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1)

          if (mountedRef.current && pendingSaveCountRef.current === 0) {
            setSaving(false)
          }
        }
      })
  }, [])

  const resetPreferences = useCallback(() => {
    updatePreferences({
      ...DEFAULT_READER_PREFERENCES,
      readerMode: preferencesRef.current.readerMode,
    })
  }, [updatePreferences])

  return {
    preferences,
    loading,
    saving,
    error,
    updatePreferences,
    resetPreferences,
  }
}
