import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReaderMode } from '../preferences'
import {
  endReadingSession,
  startReadingSession,
  updateReadingSession,
} from './reading-session.api'
import {
  READING_SESSION_END_GRACE_MS,
  READING_SESSION_HEARTBEAT_MS,
  READING_SESSION_POSITION_SAVE_MS,
} from './reading-session.constants'
import type {
  ReadingSession,
  StartReadingSessionInput,
  UpdateReadingSessionInput,
} from './reading-session.types'
import {
  activeDurationSeconds,
  settleActiveTime,
} from './reading-session.utils'

const START_ERROR_MESSAGE = 'We could not record this reading session.'
const pendingStartRequests = new Map<string, Promise<ReadingSession>>()
const scheduledSessionEnds = new Map<string, number>()

type UseReadingSessionOptions = {
  canStart: boolean
  userBookId: string
  currentPage: number
  currentChapterId: string | null
  readerMode: ReaderMode
  readerElement: HTMLElement | null
}

type PendingUpdate = {
  input: UpdateReadingSessionInput
  keepalive: boolean
  localVersion: number
}

function sharedStartRequest(
  userBookId: string,
  input: StartReadingSessionInput,
): Promise<ReadingSession> {
  const existing = pendingStartRequests.get(userBookId)

  if (existing) {
    return existing
  }

  const request = startReadingSession(userBookId, input).finally(() => {
    if (pendingStartRequests.get(userBookId) === request) {
      pendingStartRequests.delete(userBookId)
    }
  })

  pendingStartRequests.set(userBookId, request)

  return request
}

export function useReadingSession({
  canStart,
  userBookId,
  currentPage,
  currentChapterId,
  readerMode,
  readerElement,
}: UseReadingSessionOptions) {
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const canStartRef = useRef(canStart)
  const currentPageRef = useRef(currentPage)
  const currentChapterIdRef = useRef(currentChapterId)
  const readerModeRef = useRef(readerMode)
  const sessionRef = useRef<ReadingSession | null>(null)
  const startPromiseRef = useRef<Promise<ReadingSession | null> | null>(null)
  const serverBaseAppliedRef = useRef(false)
  const trackingStartedRef = useRef(false)
  const endedRef = useRef(false)
  const visibleRef = useRef(document.visibilityState !== 'hidden')
  const focusedRef = useRef(document.hasFocus())
  const accumulatedMsRef = useRef(0)
  const activeSliceStartedAtRef = useRef<number | null>(null)
  const lastActivityAtRef = useRef(performance.now())
  const updateSequenceRef = useRef(0)
  const localVersionRef = useRef(0)
  const lastSavedVersionRef = useRef(0)
  const pendingUpdateRef = useRef<PendingUpdate | null>(null)
  const inFlightUpdateRef = useRef<Promise<void> | null>(null)
  const positionSaveTimerRef = useRef<number | null>(null)
  const previousPositionKeyRef = useRef(
    JSON.stringify([currentPage, currentChapterId, readerMode]),
  )
  const drainPendingUpdateRef = useRef<() => Promise<void>>(async () => undefined)
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(
    async () => undefined,
  )
  const endNowRef = useRef<(keepalive?: boolean) => Promise<void>>(
    async () => undefined,
  )

  canStartRef.current = canStart
  currentPageRef.current = currentPage
  currentChapterIdRef.current = currentChapterId
  readerModeRef.current = readerMode

  const setCalmError = useCallback((message: string | null) => {
    if (mountedRef.current) {
      setError(message)
    }
  }, [])

  const settleDuration = useCallback((now = performance.now()) => {
    if (!trackingStartedRef.current) {
      return
    }

    const settled = settleActiveTime(
      {
        accumulatedMs: accumulatedMsRef.current,
        activeSliceStartedAt: activeSliceStartedAtRef.current,
        lastActivityAt: lastActivityAtRef.current,
      },
      now,
    )

    accumulatedMsRef.current = settled.accumulatedMs
    activeSliceStartedAtRef.current = settled.activeSliceStartedAt

    if (settled.elapsedMs > 0) {
      localVersionRef.current += 1
    }
  }, [])

  const beginTracking = useCallback(() => {
    if (trackingStartedRef.current) {
      return
    }

    const now = performance.now()

    trackingStartedRef.current = true
    visibleRef.current = document.visibilityState !== 'hidden'
    focusedRef.current = document.hasFocus()
    lastActivityAtRef.current = now
    activeSliceStartedAtRef.current =
      visibleRef.current && focusedRef.current ? now : null
  }, [])

  const recordActivity = useCallback(() => {
    if (!trackingStartedRef.current || endedRef.current) {
      return
    }

    const now = performance.now()

    settleDuration(now)
    visibleRef.current = document.visibilityState !== 'hidden'
    focusedRef.current = document.hasFocus()
    lastActivityAtRef.current = now

    if (visibleRef.current && focusedRef.current) {
      activeSliceStartedAtRef.current = now
    }
  }, [settleDuration])

  const createPendingUpdate = useCallback(
    (keepalive: boolean, force: boolean): PendingUpdate | null => {
      settleDuration()

      if (!force && localVersionRef.current <= lastSavedVersionRef.current) {
        return null
      }

      updateSequenceRef.current = Math.min(
        Number.MAX_SAFE_INTEGER,
        updateSequenceRef.current + 1,
      )

      return {
        input: {
          activeDurationSeconds: activeDurationSeconds(accumulatedMsRef.current),
          endPage: currentPageRef.current,
          endChapterId: currentChapterIdRef.current,
          readerMode: readerModeRef.current,
          sequence: updateSequenceRef.current,
        },
        keepalive,
        localVersion: localVersionRef.current,
      }
    },
    [settleDuration],
  )

  const ensureSessionStarted = useCallback(async (): Promise<ReadingSession | null> => {
    if (sessionRef.current) {
      return sessionRef.current
    }

    if (!canStartRef.current || endedRef.current) {
      return null
    }

    if (startPromiseRef.current) {
      return startPromiseRef.current
    }

    beginTracking()

    const request = sharedStartRequest(userBookId, {
      startPage: currentPageRef.current,
      startChapterId: currentChapterIdRef.current,
      readerMode: readerModeRef.current,
    })
      .then((session) => {
        settleDuration()

        if (!serverBaseAppliedRef.current) {
          accumulatedMsRef.current += session.activeDurationSeconds * 1_000
          serverBaseAppliedRef.current = true
        }

        sessionRef.current = session
        updateSequenceRef.current = Math.max(
          updateSequenceRef.current,
          session.updateSequence,
        )
        setCalmError(null)

        return session
      })
      .catch(() => {
        setCalmError(START_ERROR_MESSAGE)

        return null
      })
      .finally(() => {
        if (startPromiseRef.current === request) {
          startPromiseRef.current = null
        }
      })

    startPromiseRef.current = request

    return request
  }, [beginTracking, setCalmError, settleDuration, userBookId])

  const drainPendingUpdate = useCallback(async (): Promise<void> => {
    if (inFlightUpdateRef.current) {
      return inFlightUpdateRef.current
    }

    const session = sessionRef.current

    if (!session || endedRef.current) {
      return
    }

    const drain = (async () => {
      let failed = false

      while (pendingUpdateRef.current && !endedRef.current) {
        const pending = pendingUpdateRef.current

        pendingUpdateRef.current = null

        try {
          const updated = await updateReadingSession(
            userBookId,
            session.id,
            pending.input,
            { keepalive: pending.keepalive },
          )

          sessionRef.current = updated
          updateSequenceRef.current = Math.max(
            updateSequenceRef.current,
            updated.updateSequence,
          )
          lastSavedVersionRef.current = Math.max(
            lastSavedVersionRef.current,
            pending.localVersion,
          )
          setCalmError(null)
        } catch {
          pendingUpdateRef.current ??= pending
          failed = true
          setCalmError(START_ERROR_MESSAGE)
          break
        }
      }
      return failed
    })().then((failed) => {
      inFlightUpdateRef.current = null

      if (!failed && pendingUpdateRef.current && !endedRef.current) {
        void drainPendingUpdateRef.current()
      }
    })

    inFlightUpdateRef.current = drain

    return drain
  }, [setCalmError, userBookId])

  drainPendingUpdateRef.current = drainPendingUpdate

  const flush = useCallback(async (keepalive = false): Promise<void> => {
    if (!trackingStartedRef.current || endedRef.current) {
      return
    }

    let session = sessionRef.current

    if (!session && startPromiseRef.current) {
      session = await startPromiseRef.current
    }

    if (!session) {
      return
    }

    const pending = createPendingUpdate(keepalive, false)

    if (!pending) {
      return
    }

    pendingUpdateRef.current = pending
    await drainPendingUpdate()
  }, [createPendingUpdate, drainPendingUpdate])

  flushRef.current = flush

  const endNow = useCallback(async (keepalive = false): Promise<void> => {
    if (endedRef.current || !trackingStartedRef.current) {
      return
    }

    let session = sessionRef.current

    if (!session && startPromiseRef.current) {
      session = await startPromiseRef.current
    }

    if (!session) {
      return
    }

    const pending = createPendingUpdate(keepalive, true)

    if (!pending) {
      return
    }

    endedRef.current = true
    activeSliceStartedAtRef.current = null
    pendingUpdateRef.current = null

    try {
      const endedSession = await endReadingSession(
        userBookId,
        session.id,
        pending.input,
        { keepalive },
      )

      sessionRef.current = endedSession
      updateSequenceRef.current = Math.max(
        updateSequenceRef.current,
        endedSession.updateSequence,
      )
      lastSavedVersionRef.current = Math.max(
        lastSavedVersionRef.current,
        pending.localVersion,
      )
      setCalmError(null)
    } catch {
      setCalmError(START_ERROR_MESSAGE)
    }
  }, [createPendingUpdate, setCalmError, userBookId])

  endNowRef.current = endNow

  useEffect(() => {
    mountedRef.current = true
    const scheduledEnd = scheduledSessionEnds.get(userBookId)

    if (scheduledEnd !== undefined) {
      window.clearTimeout(scheduledEnd)
      scheduledSessionEnds.delete(userBookId)
    }

    return () => {
      mountedRef.current = false

      if (positionSaveTimerRef.current !== null) {
        window.clearTimeout(positionSaveTimerRef.current)
        positionSaveTimerRef.current = null
      }

      const timer = window.setTimeout(() => {
        if (scheduledSessionEnds.get(userBookId) === timer) {
          scheduledSessionEnds.delete(userBookId)
          void endNowRef.current(true)
        }
      }, READING_SESSION_END_GRACE_MS)

      scheduledSessionEnds.set(userBookId, timer)
    }
  }, [userBookId])

  useEffect(() => {
    if (canStart) {
      void ensureSessionStarted()
    }
  }, [canStart, ensureSessionStarted])

  useEffect(() => {
    const nextPositionKey = JSON.stringify([
      currentPage,
      currentChapterId,
      readerMode,
    ])

    if (previousPositionKeyRef.current === nextPositionKey) {
      return
    }

    previousPositionKeyRef.current = nextPositionKey

    if (!trackingStartedRef.current || endedRef.current) {
      return
    }

    recordActivity()
    localVersionRef.current += 1

    if (!sessionRef.current && canStartRef.current) {
      void ensureSessionStarted()
    }

    if (positionSaveTimerRef.current !== null) {
      window.clearTimeout(positionSaveTimerRef.current)
    }

    positionSaveTimerRef.current = window.setTimeout(() => {
      positionSaveTimerRef.current = null
      void flushRef.current()
    }, READING_SESSION_POSITION_SAVE_MS)
  }, [
    currentChapterId,
    currentPage,
    ensureSessionStarted,
    readerMode,
    recordActivity,
  ])

  useEffect(() => {
    if (!readerElement) {
      return
    }

    const handleReaderActivity = () => {
      recordActivity()

      if (!sessionRef.current && canStartRef.current) {
        void ensureSessionStarted()
      }
    }

    readerElement.addEventListener('pointerdown', handleReaderActivity)
    readerElement.addEventListener('keydown', handleReaderActivity)
    readerElement.addEventListener('touchstart', handleReaderActivity, { passive: true })
    readerElement.addEventListener('wheel', handleReaderActivity, { passive: true })
    readerElement.addEventListener('scroll', handleReaderActivity, {
      capture: true,
      passive: true,
    })

    return () => {
      readerElement.removeEventListener('pointerdown', handleReaderActivity)
      readerElement.removeEventListener('keydown', handleReaderActivity)
      readerElement.removeEventListener('touchstart', handleReaderActivity)
      readerElement.removeEventListener('wheel', handleReaderActivity)
      readerElement.removeEventListener('scroll', handleReaderActivity, true)
    }
  }, [ensureSessionStarted, readerElement, recordActivity])

  useEffect(() => {
    const pauseAndFlush = () => {
      settleDuration()
      activeSliceStartedAtRef.current = null
      void flushRef.current(true)
    }

    const handleVisibilityChange = () => {
      visibleRef.current = document.visibilityState !== 'hidden'

      if (!visibleRef.current) {
        pauseAndFlush()
      }
    }
    const handleBlur = () => {
      focusedRef.current = false
      pauseAndFlush()
    }
    const handleFocus = () => {
      focusedRef.current = true
    }
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        pauseAndFlush()
        return
      }

      void endNowRef.current(true)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [settleDuration])

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (endedRef.current) {
        return
      }

      if (sessionRef.current) {
        void flushRef.current()
        return
      }

      if (
        canStartRef.current &&
        document.visibilityState !== 'hidden' &&
        document.hasFocus()
      ) {
        void ensureSessionStarted()
      }
    }, READING_SESSION_HEARTBEAT_MS)

    return () => window.clearInterval(heartbeat)
  }, [ensureSessionStarted])

  return {
    error,
  }
}
