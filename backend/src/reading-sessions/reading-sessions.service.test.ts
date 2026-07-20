import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";
import {
  BookProcessingStatus,
  Prisma,
  type ReadingSession,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { HttpError } from "../http/errors";
import {
  endUserReadingSession,
  READING_SESSION_STALE_MS,
  startUserReadingSession,
} from "./reading-sessions.service";

const userId = "11111111-1111-4111-8111-111111111111";
const userBookId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const nextSessionId = "55555555-5555-4555-8555-555555555555";

type Replacement = (...args: unknown[]) => unknown;

function replaceMethod(
  target: object,
  key: string,
  replacement: Replacement,
): () => void {
  const record = target as Record<string, Replacement>;
  const original = record[key];

  record[key] = replacement;

  return () => {
    record[key] = original;
  };
}

function restoreAll(restorers: Array<() => void>): void {
  for (const restore of restorers.reverse()) {
    restore();
  }
}

function transactionRestorer(): () => void {
  return replaceMethod(prisma, "$transaction", async (...args) => {
    const operation = args[0] as (
      transaction: Prisma.TransactionClient,
    ) => Promise<unknown>;

    return operation(prisma as unknown as Prisma.TransactionClient);
  });
}

function ownedBook() {
  return {
    id: userBookId,
    bookId,
    book: {
      pageCount: 120,
      processingStatus: BookProcessingStatus.READY,
    },
  };
}

function readingSession(
  overrides: Partial<ReadingSession> = {},
): ReadingSession {
  const now = new Date();

  return {
    id: sessionId,
    userId,
    userBookId,
    bookId,
    chapterId: null,
    startedAt: new Date(now.getTime() - 60_000),
    endedAt: null,
    startPage: 4,
    endPage: 4,
    durationSeconds: 20,
    pagesRead: null,
    metadata: {
      version: 1,
      readerMode: "pdf",
      startChapterId: null,
      endChapterId: null,
      lastUpdatedAt: now.toISOString(),
      updateSequence: 2,
    },
    ...overrides,
  };
}

test("start verifies ownership before querying or creating sessions", async () => {
  let sessionsQueried = false;
  let createCalled = false;
  const restorers = [
    transactionRestorer(),
    replaceMethod(prisma.userBook, "findFirst", async () => null),
    replaceMethod(prisma.readingSession, "findMany", async () => {
      sessionsQueried = true;
      return [];
    }),
    replaceMethod(prisma.readingSession, "create", async () => {
      createCalled = true;
      return readingSession();
    }),
  ];

  try {
    await assert.rejects(
      startUserReadingSession(userId, userBookId, {
        startPage: 4,
        startChapterId: null,
        readerMode: "pdf",
      }),
      (error: unknown) =>
        error instanceof HttpError && error.statusCode === 404,
    );
    assert.equal(sessionsQueried, false);
    assert.equal(createCalled, false);
  } finally {
    restoreAll(restorers);
  }
});

test("start reuses a fresh session but closes a stale session at its last update", async () => {
  const fresh = readingSession();
  let createCalled = false;
  const freshRestorers = [
    transactionRestorer(),
    replaceMethod(prisma.userBook, "findFirst", async () => ownedBook()),
    replaceMethod(prisma.readingSession, "findMany", async () => [fresh]),
    replaceMethod(prisma.readingSession, "create", async () => {
      createCalled = true;
      return readingSession();
    }),
  ];

  try {
    const result = await startUserReadingSession(userId, userBookId, {
      startPage: 4,
      startChapterId: null,
      readerMode: "pdf",
    });

    assert.equal(result.id, fresh.id);
    assert.equal(createCalled, false);
  } finally {
    restoreAll(freshRestorers);
  }

  const lastUpdatedAt = new Date(
    Date.now() - READING_SESSION_STALE_MS - 60_000,
  );
  const stale = readingSession({
    startedAt: new Date(lastUpdatedAt.getTime() - 30_000),
    metadata: {
      version: 1,
      readerMode: "pdf",
      startChapterId: null,
      endChapterId: null,
      lastUpdatedAt: lastUpdatedAt.toISOString(),
      updateSequence: 8,
    },
  });
  let closedAt: Date | null = null;
  let createdData: Record<string, unknown> = {};
  const created = readingSession({
    id: nextSessionId,
    startedAt: new Date(),
    durationSeconds: 0,
  });
  const staleRestorers = [
    transactionRestorer(),
    replaceMethod(prisma.userBook, "findFirst", async () => ownedBook()),
    replaceMethod(prisma.readingSession, "findMany", async () => [stale]),
    replaceMethod(prisma.readingSession, "update", async (...args) => {
      const input = args[0] as { data: { endedAt: Date } };

      closedAt = input.data.endedAt;

      return { ...stale, endedAt: input.data.endedAt };
    }),
    replaceMethod(prisma.readingSession, "create", async (...args) => {
      const input = args[0] as { data: Record<string, unknown> };

      createdData = input.data;

      return created;
    }),
  ];

  try {
    const result = await startUserReadingSession(userId, userBookId, {
      startPage: 9,
      startChapterId: null,
      readerMode: "reading",
    });

    assert.equal(result.id, created.id);
    assert.deepEqual(closedAt, lastUpdatedAt);
    assert.equal(createdData.userId, userId);
    assert.equal(createdData.userBookId, userBookId);
    assert.equal(createdData.bookId, bookId);
    assert.equal(createdData.startPage, 9);
    assert.equal(createdData.endPage, 9);
    assert.equal(createdData.durationSeconds, 0);
  } finally {
    restoreAll(staleRestorers);
  }
});

test("repeated end preserves final position and endedAt without reducing duration", async () => {
  const endedAt = new Date(Date.now() - 30_000);
  const stored = readingSession({
    endedAt,
    endPage: 18,
    durationSeconds: 120,
    metadata: {
      version: 1,
      readerMode: "pdf",
      startChapterId: null,
      endChapterId: null,
      lastUpdatedAt: endedAt.toISOString(),
      updateSequence: 5,
    },
  });
  let updateData: Record<string, unknown> = {};
  const restorers = [
    transactionRestorer(),
    replaceMethod(prisma.userBook, "findFirst", async () => ownedBook()),
    replaceMethod(prisma.readingSession, "findFirst", async () => stored),
    replaceMethod(prisma.readingSession, "update", async (...args) => {
      const input = args[0] as { data: Record<string, unknown> };

      updateData = input.data;

      return {
        ...stored,
        durationSeconds: input.data.durationSeconds as number,
        metadata: input.data.metadata as Prisma.JsonValue,
      };
    }),
  ];

  try {
    const result = await endUserReadingSession(
      userId,
      userBookId,
      sessionId,
      {
        activeDurationSeconds: 150,
        endPage: 3,
        endChapterId: null,
        readerMode: "reading",
        sequence: 6,
      },
    );

    assert.equal(result.endedAt, endedAt.toISOString());
    assert.equal(result.endPage, 18);
    assert.equal(result.activeDurationSeconds, 150);
    assert.equal(Object.hasOwn(updateData, "endedAt"), false);
    assert.equal(Object.hasOwn(updateData, "endPage"), false);
    assert.equal(Object.hasOwn(updateData, "chapterId"), false);
  } finally {
    restoreAll(restorers);
  }
});
