export const READING_SESSION_MODES = ["pdf", "reading"] as const;

export type ReadingSessionMode = (typeof READING_SESSION_MODES)[number];

export type ReadingSessionMetadata = {
  version: 1;
  readerMode: ReadingSessionMode | null;
  startChapterId: string | null;
  endChapterId: string | null;
  lastUpdatedAt: string;
  updateSequence: number;
};

export type PublicReadingSession = {
  id: string;
  userBookId: string;
  startedAt: string;
  endedAt: string | null;
  activeDurationSeconds: number;
  startPage: number | null;
  endPage: number | null;
  startChapterId: string | null;
  endChapterId: string | null;
  readerMode: ReadingSessionMode | null;
  updateSequence: number;
};
