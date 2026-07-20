import { READING_SESSION_INACTIVITY_MS } from './reading-session.constants'

export type ActiveTimeState = {
  accumulatedMs: number
  activeSliceStartedAt: number | null
  lastActivityAt: number
}

export type SettledActiveTime = ActiveTimeState & {
  elapsedMs: number
}

export function settleActiveTime(
  state: ActiveTimeState,
  now: number,
): SettledActiveTime {
  if (state.activeSliceStartedAt === null) {
    return { ...state, elapsedMs: 0 }
  }

  const activeUntil = Math.min(
    now,
    state.lastActivityAt + READING_SESSION_INACTIVITY_MS,
  )
  const elapsedMs = Math.max(0, activeUntil - state.activeSliceStartedAt)
  const remainsActive = now < state.lastActivityAt + READING_SESSION_INACTIVITY_MS

  return {
    accumulatedMs: state.accumulatedMs + elapsedMs,
    activeSliceStartedAt: remainsActive ? now : null,
    lastActivityAt: state.lastActivityAt,
    elapsedMs,
  }
}

export function activeDurationSeconds(accumulatedMs: number): number {
  return Math.min(2_147_483_647, Math.max(0, Math.floor(accumulatedMs / 1_000)))
}
