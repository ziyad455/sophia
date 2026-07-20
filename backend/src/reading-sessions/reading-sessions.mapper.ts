import type { Prisma, ReadingSession } from "@prisma/client";
import type {
  PublicReadingSession,
  ReadingSessionMetadata,
  ReadingSessionMode,
} from "./reading-sessions.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableUuid(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readerMode(value: unknown): ReadingSessionMode | null {
  return value === "pdf" || value === "reading" ? value : null;
}

export function parseReadingSessionMetadata(
  value: Prisma.JsonValue | null,
): ReadingSessionMetadata | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const lastUpdatedAt = typeof value.lastUpdatedAt === "string"
    ? value.lastUpdatedAt
    : null;
  const updateSequence = Number.isSafeInteger(value.updateSequence) &&
    (value.updateSequence as number) >= 0
    ? value.updateSequence as number
    : null;

  if (!lastUpdatedAt || updateSequence === null) {
    return null;
  }

  return {
    version: 1,
    readerMode: readerMode(value.readerMode),
    startChapterId: nullableUuid(value.startChapterId),
    endChapterId: nullableUuid(value.endChapterId),
    lastUpdatedAt,
    updateSequence,
  };
}

export function toReadingSessionMetadataJson(
  metadata: ReadingSessionMetadata,
): Prisma.InputJsonValue {
  return metadata as unknown as Prisma.InputJsonValue;
}

export function mapReadingSession(session: ReadingSession): PublicReadingSession {
  const metadata = parseReadingSessionMetadata(session.metadata);

  return {
    id: session.id,
    userBookId: session.userBookId,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    activeDurationSeconds: Math.max(0, session.durationSeconds ?? 0),
    startPage: session.startPage,
    endPage: session.endPage,
    startChapterId: metadata?.startChapterId ?? null,
    endChapterId: metadata?.endChapterId ?? session.chapterId,
    readerMode: metadata?.readerMode ?? null,
    updateSequence: metadata?.updateSequence ?? 0,
  };
}
