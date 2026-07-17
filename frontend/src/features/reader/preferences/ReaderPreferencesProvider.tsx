import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../../../auth'
import { applyTheme, readStoredTheme } from '../../../theme'
import { ReaderPreferencesContext } from './reader-preferences-context'
import {
  getReaderPreferences,
  patchReaderPreferences,
} from './reader-preferences.api'
import { DEFAULT_READER_PREFERENCES } from './reader-preferences.defaults'
import type {
  ReaderPreferences,
  ReaderPreferencesUpdate,
} from './reader-preferences.types'

type ReaderPreferencesProviderProps = {
  children: ReactNode
}

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

export function ReaderPreferencesProvider({
  children,
}: ReaderPreferencesProviderProps) {
  const { user, loading: authLoading } = useAuth()
  const [preferences, setPreferences] = useState<ReaderPreferences>({
    ...DEFAULT_READER_PREFERENCES,
    readingMood: readStoredTheme(),
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preferencesRef = useRef(preferences)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const latestSaveIdRef = useRef(0)
  const pendingSaveCountRef = useRef(0)
  const localChangeVersionRef = useRef(0)
  const mountedRef = useRef(true)
  const activeUserIdRef = useRef<string | null>(user?.id ?? null)

  activeUserIdRef.current = user?.id ?? null

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!user) {
      setLoading(false)
      setSaving(false)
      setError(null)
      pendingSaveCountRef.current = 0
      return
    }

    const controller = new AbortController()
    const loadingUserId = user.id
    const changeVersionAtLoadStart = localChangeVersionRef.current

    setLoading(true)
    getReaderPreferences({ signal: controller.signal })
      .then((response) => {
        if (
          controller.signal.aborted ||
          activeUserIdRef.current !== loadingUserId ||
          localChangeVersionRef.current !== changeVersionAtLoadStart
        ) {
          return
        }

        applyTheme(response.preferences.readingMood)
        preferencesRef.current = response.preferences
        setPreferences(response.preferences)
        setError(null)
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return
        }

        if (activeUserIdRef.current === loadingUserId) {
          setError('We could not load your reader settings. Using defaults for now.')
        }
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          activeUserIdRef.current === loadingUserId
        ) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [authLoading, user])

  const updatePreferences = useCallback((update: ReaderPreferencesUpdate) => {
    const currentPreferences = preferencesRef.current

    if (!hasPreferenceChanges(currentPreferences, update)) {
      return
    }

    const nextPreferences = applyUpdate(currentPreferences, update)
    const savingUserId = activeUserIdRef.current

    localChangeVersionRef.current += 1
    if (update.readingMood) {
      applyTheme(update.readingMood)
    }
    preferencesRef.current = nextPreferences
    setPreferences(nextPreferences)
    setError(null)

    if (!savingUserId) {
      return
    }

    const saveId = latestSaveIdRef.current + 1

    latestSaveIdRef.current = saveId
    pendingSaveCountRef.current += 1
    setSaving(true)

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const response = await patchReaderPreferences(update)

          if (
            !mountedRef.current ||
            activeUserIdRef.current !== savingUserId ||
            saveId !== latestSaveIdRef.current
          ) {
            return
          }

          applyTheme(response.preferences.readingMood)
          preferencesRef.current = response.preferences
          setPreferences(response.preferences)
          setError(null)
        } catch {
          if (
            mountedRef.current &&
            activeUserIdRef.current === savingUserId &&
            saveId === latestSaveIdRef.current
          ) {
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

  const value = useMemo(
    () => ({
      preferences,
      loading,
      saving,
      error,
      updatePreferences,
      resetPreferences,
    }),
    [error, loading, preferences, resetPreferences, saving, updatePreferences],
  )

  return (
    <ReaderPreferencesContext value={value}>
      {children}
    </ReaderPreferencesContext>
  )
}
