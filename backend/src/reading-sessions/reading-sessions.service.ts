import {
  BookProcessingStatus,
  Prisma,
  type ReadingSession,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, conflict, notFound } from "../http/errors";
import {
  isReadingSessionUuid,
  type StartReadingSessionDto,
  type UpdateReadingSessionDto,
} from "./reading-sessions.dto";
import {
  mapReadingSession,
  parseReadingSessionMetadata,
  toReadingSessionMetadataJson,
} from "./reading-sessions.mapper";
import type {
  PublicReadingSession,
  ReadingSessionMetadata,
} from "./reading-sessions.types";

export const READING_SESSION_STALE_MS = 30 * 60 * 1_000;

const TRANSACTION_RETRY_LIMIT = 3;

type DatabaseClient = Prisma.TransactionClient;

type OwnedBook = {
  id: string;
  bookId: string;
  book: {
    pageCount: number | null;
    processingStatus: BookProcessingStatus;
  };
};

function isRetryableTransactionError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034",
  );
}

async function runSerializable<T>(
  operation: (transaction: DatabaseClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableTransactionError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function requireOwnedBook(
  transaction: DatabaseClient,
  userId: string,
  userBookId: string,
  requireReady: boolean,
): Promise<OwnedBook> {
  if (!isReadingSessionUuid(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await transaction.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      id: true,
      bookId: true,
      book: {
        select: {
          pageCount: true,
          processingStatus: true,
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  if (requireReady && userBook.book.processingStatus !== BookProcessingStatus.READY) {
    throw conflict("This book is not ready to read yet.");
  }

  return userBook;
}

function validatePage(book: OwnedBook, page: number): void {
  if (book.book.pageCount !== null && page > book.book.pageCount) {
    throw badRequest(
      "Page must not exceed this book's " + book.book.pageCount + " pages.",
    );
  }
}

async function validateChapter(
  transaction: DatabaseClient,
  bookId: string,
  chapterId: string | null,
): Promise<void> {
  if (!chapterId) {
    return;
  }

  const chapter = await transaction.chapter.findFirst({
    where: {
      id: chapterId,
      bookId,
    },
    select: { id: true },
  });

  if (!chapter) {
    throw badRequest("Chapter does not belong to this book.");
  }
}

function lastRecordedAt(session: ReadingSession): Date {
  const metadata = parseReadingSessionMetadata(session.metadata);
  const parsed = metadata ? new Date(metadata.lastUpdatedAt) : session.startedAt;
  const recordedAt = Number.isNaN(parsed.getTime()) ? session.startedAt : parsed;

  return recordedAt < session.startedAt ? session.startedAt : recordedAt;
}

function staleEndTime(session: ReadingSession, now: Date): Date {
  const recordedAt = lastRecordedAt(session);

  return recordedAt > now ? now : recordedAt;
}

function isFreshOpenSession(session: ReadingSession, now: Date): boolean {
  return now.getTime() - lastRecordedAt(session).getTime() <= READING_SESSION_STALE_MS;
}

async function requireOwnedSession(
  transaction: DatabaseClient,
  userId: string,
  userBookId: string,
  bookId: string,
  sessionId: string,
): Promise<ReadingSession> {
  if (!isReadingSessionUuid(sessionId)) {
    throw notFound("Reading session not found.");
  }

  const session = await transaction.readingSession.findFirst({
    where: {
      id: sessionId,
      userId,
      userBookId,
      bookId,
    },
  });

  if (!session) {
    throw notFound("Reading session not found.");
  }

  return session;
}

function createMetadata(
  dto: StartReadingSessionDto,
  now: Date,
): ReadingSessionMetadata {
  return {
    version: 1,
    readerMode: dto.readerMode,
    startChapterId: dto.startChapterId,
    endChapterId: dto.startChapterId,
    lastUpdatedAt: now.toISOString(),
    updateSequence: 0,
  };
}

function updatedMetadata(
  session: ReadingSession,
  dto: UpdateReadingSessionDto,
  now: Date,
): { metadata: ReadingSessionMetadata; appliesPosition: boolean } {
  const stored = parseReadingSessionMetadata(session.metadata);
  const storedSequence = stored?.updateSequence ?? 0;
  const appliesPosition =
    session.endedAt === null && dto.sequence > storedSequence;

  return {
    metadata: {
      version: 1,
      readerMode: appliesPosition ? dto.readerMode : stored?.readerMode ?? null,
      startChapterId: stored?.startChapterId ?? null,
      endChapterId: appliesPosition
        ? dto.endChapterId
        : stored?.endChapterId ?? session.chapterId,
      lastUpdatedAt: now.toISOString(),
      updateSequence: Math.max(storedSequence, dto.sequence),
    },
    appliesPosition,
  };
}

export async function startUserReadingSession(
  userId: string,
  userBookId: string,
  dto: StartReadingSessionDto,
): Promise<PublicReadingSession> {
  return runSerializable(async (transaction) => {
    const userBook = await requireOwnedBook(transaction, userId, userBookId, true);

    validatePage(userBook, dto.startPage);
    await validateChapter(transaction, userBook.bookId, dto.startChapterId);

    const now = new Date();
    const openSessions = await transaction.readingSession.findMany({
      where: {
        userId,
        userBookId,
        endedAt: null,
      },
      orderBy: [
        { startedAt: "desc" },
        { id: "desc" },
      ],
    });
    const reusableSession = openSessions[0] && isFreshOpenSession(openSessions[0], now)
      ? openSessions[0]
      : null;

    for (const openSession of openSessions) {
      if (reusableSession?.id === openSession.id) {
        continue;
      }

      await transaction.readingSession.update({
        where: { id: openSession.id },
        data: { endedAt: staleEndTime(openSession, now) },
      });
    }

    if (reusableSession) {
      return mapReadingSession(reusableSession);
    }

    const session = await transaction.readingSession.create({
      data: {
        userId,
        userBookId,
        bookId: userBook.bookId,
        chapterId: dto.startChapterId,
        startPage: dto.startPage,
        endPage: dto.startPage,
        durationSeconds: 0,
        pagesRead: null,
        metadata: toReadingSessionMetadataJson(createMetadata(dto, now)),
      },
    });

    return mapReadingSession(session);
  });
}

async function writeSessionUpdate(
  userId: string,
  userBookId: string,
  sessionId: string,
  dto: UpdateReadingSessionDto,
  endSession: boolean,
): Promise<PublicReadingSession> {
  return runSerializable(async (transaction) => {
    const userBook = await requireOwnedBook(transaction, userId, userBookId, false);

    validatePage(userBook, dto.endPage);
    await validateChapter(transaction, userBook.bookId, dto.endChapterId);

    const session = await requireOwnedSession(
      transaction,
      userId,
      userBookId,
      userBook.bookId,
      sessionId,
    );
    const now = new Date();
    const { metadata, appliesPosition } = updatedMetadata(session, dto, now);
    const updated = await transaction.readingSession.update({
      where: { id: session.id },
      data: {
        durationSeconds: Math.max(
          session.durationSeconds ?? 0,
          dto.activeDurationSeconds,
        ),
        ...(appliesPosition
          ? {
              endPage: dto.endPage,
              chapterId: dto.endChapterId,
            }
          : {}),
        ...(endSession && session.endedAt === null ? { endedAt: now } : {}),
        metadata: toReadingSessionMetadataJson(metadata),
      },
    });

    return mapReadingSession(updated);
  });
}

export async function updateUserReadingSession(
  userId: string,
  userBookId: string,
  sessionId: string,
  dto: UpdateReadingSessionDto,
): Promise<PublicReadingSession> {
  return writeSessionUpdate(userId, userBookId, sessionId, dto, false);
}

export async function endUserReadingSession(
  userId: string,
  userBookId: string,
  sessionId: string,
  dto: UpdateReadingSessionDto,
): Promise<PublicReadingSession> {
  return writeSessionUpdate(userId, userBookId, sessionId, dto, true);
}
