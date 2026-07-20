import type { ReaderMode } from '../preferences'

export type ReadingSession = {
  id: string
  userBookId: string
  startedAt: string
  endedAt: string | null
  activeDurationSeconds: number
  startPage: number | null
  endPage: number | null
  startChapterId: string | null
  endChapterId: string | null
  readerMode: ReaderMode | null
  updateSequence: number
}

export type StartReadingSessionInput = {
  startPage: number
  startChapterId: string | null
  readerMode: ReaderMode
}

export type UpdateReadingSessionInput = {
  activeDurationSeconds: number
  endPage: number
  endChapterId: string | null
  readerMode: ReaderMode
  sequence: number
}
