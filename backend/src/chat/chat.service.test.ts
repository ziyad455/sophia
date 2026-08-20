import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatMessageRole,
  ChatSessionMode,
  type ChatMessage,
  type ChatSession,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { HttpError } from "../http/errors";
import {
  createUserChatMessage,
  createUserChatSession,
  deleteUserChatSession,
  getUserChatSession,
  listUserChatSessions,
} from "./chat.service";

const userAId = "11111111-1111-4111-8111-111111111111";
const userBId = "22222222-2222-4222-8222-222222222222";
const sharedBookId = "33333333-3333-4333-8333-333333333333";
const userBookAId = "44444444-4444-4444-8444-444444444444";
const userBookBId = "55555555-5555-4555-8555-555555555555";
const sessionAId = "66666666-6666-4666-8666-666666666666";
const sessionBId = "77777777-7777-4777-8777-777777777777";
const messageAId = "88888888-8888-4888-8888-888888888888";
const messageBId = "99999999-9999-4999-8999-999999999999";

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

function hasStatus(statusCode: number) {
  return (error: unknown) =>
    error instanceof HttpError && error.statusCode === statusCode;
}

function chatSession(
  overrides: Partial<ChatSession> = {},
): ChatSession {
  return {
    id: sessionAId,
    userId: userAId,
    userBookId: userBookAId,
    bookId: sharedBookId,
    chapterId: null,
    title: null,
    mode: ChatSessionMode.GENERAL_READING_HELP,
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  };
}

function chatMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: messageAId,
    sessionId: sessionAId,
    userId: userAId,
    role: ChatMessageRole.USER,
    content: "What does this passage mean?",
    selectedText: null,
    pageNumber: null,
    chapterId: null,
    contextSnapshotId: null,
    modelProvider: null,
    modelName: null,
    metadata: null,
    createdAt: new Date("2026-08-20T10:05:00.000Z"),
    ...overrides,
  };
}

test("creates a controlled chat session for the authenticated user's UserBook", async () => {
  let ownershipQuery: unknown;
  let createQuery: unknown;
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async (...args) => {
      ownershipQuery = args[0];
      return { id: userBookAId, bookId: sharedBookId };
    }),
    replaceMethod(prisma.chatSession, "create", async (...args) => {
      createQuery = args[0];
      return chatSession();
    }),
  ];

  try {
    const session = await createUserChatSession(userAId, userBookAId);

    assert.deepEqual(ownershipQuery, {
      where: { id: userBookAId, userId: userAId },
      select: { id: true, bookId: true },
    });
    assert.deepEqual(createQuery, {
      data: {
        userId: userAId,
        userBookId: userBookAId,
        bookId: sharedBookId,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    assert.deepEqual(session, {
      id: sessionAId,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:00:00.000Z",
    });
  } finally {
    restoreAll(restorers);
  }
});

test("rejects chat session creation for an unowned UserBook before persistence", async () => {
  let createCalled = false;
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async () => null),
    replaceMethod(prisma.chatSession, "create", async () => {
      createCalled = true;
      return chatSession();
    }),
  ];

  try {
    await assert.rejects(
      createUserChatSession(userAId, userBookBId),
      hasStatus(404),
    );
    assert.equal(createCalled, false);
  } finally {
    restoreAll(restorers);
  }
});

test("lists only sessions scoped to the authenticated user's UserBook in stable order", async () => {
  let listQuery: unknown;
  const laterSession = chatSession({
    id: sessionBId,
    createdAt: new Date("2026-08-20T11:00:00.000Z"),
    updatedAt: new Date("2026-08-20T11:00:00.000Z"),
  });
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async () => ({
      id: userBookAId,
      bookId: sharedBookId,
    })),
    replaceMethod(prisma.chatSession, "findMany", async (...args) => {
      listQuery = args[0];
      return [laterSession, chatSession()];
    }),
  ];

  try {
    const sessions = await listUserChatSessions(userAId, userBookAId);

    assert.deepEqual(
      (listQuery as { where: Record<string, unknown> }).where,
      {
        userId: userAId,
        userBookId: userBookAId,
        userBook: { userId: userAId },
      },
    );
    assert.deepEqual(
      (listQuery as { orderBy: unknown }).orderBy,
      [{ createdAt: "desc" }, { id: "desc" }],
    );
    assert.deepEqual(
      (listQuery as { select: unknown }).select,
      { id: true, createdAt: true, updatedAt: true },
    );
    assert.deepEqual(sessions.map((session) => session.id), [
      sessionBId,
      sessionAId,
    ]);
  } finally {
    restoreAll(restorers);
  }
});

test("retrieves one owned session with messages in stable chronological order", async () => {
  let getQuery: unknown;
  const messages = [
    chatMessage(),
    chatMessage({
      id: messageBId,
      role: ChatMessageRole.ASSISTANT,
      content: "It distinguishes appearance from reality.",
    }),
  ];
  const restorers = [
    replaceMethod(prisma.chatSession, "findFirst", async (...args) => {
      getQuery = args[0];
      return { ...chatSession(), messages };
    }),
  ];

  try {
    const session = await getUserChatSession(
      userAId,
      userBookAId,
      sessionAId,
    );
    const query = getQuery as {
      where: Record<string, unknown>;
      select: { messages: { orderBy: unknown; where: unknown; select: unknown } };
    };

    assert.deepEqual(query.where, {
      id: sessionAId,
      userId: userAId,
      userBookId: userBookAId,
      userBook: { userId: userAId },
    });
    assert.deepEqual(query.select.messages.where, {
      role: { in: [ChatMessageRole.USER, ChatMessageRole.ASSISTANT] },
    });
    assert.deepEqual(query.select.messages.orderBy, [
      { createdAt: "asc" },
      { id: "asc" },
    ]);
    assert.deepEqual(query.select.messages.select, {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    });
    assert.deepEqual(session.messages, [
      {
        id: messageAId,
        role: "user",
        content: "What does this passage mean?",
        createdAt: "2026-08-20T10:05:00.000Z",
      },
      {
        id: messageBId,
        role: "assistant",
        content: "It distinguishes appearance from reality.",
        createdAt: "2026-08-20T10:05:00.000Z",
      },
    ]);
  } finally {
    restoreAll(restorers);
  }
});

test("returns 404 for cross-user or mismatched UserBook session access", async () => {
  let getQuery: unknown;
  const restorers = [
    replaceMethod(prisma.chatSession, "findFirst", async (...args) => {
      getQuery = args[0];
      return null;
    }),
  ];

  try {
    await assert.rejects(
      getUserChatSession(userAId, userBookAId, sessionBId),
      hasStatus(404),
    );
    assert.deepEqual(
      (getQuery as { where: Record<string, unknown> }).where,
      {
        id: sessionBId,
        userId: userAId,
        userBookId: userBookAId,
        userBook: { userId: userAId },
      },
    );
  } finally {
    restoreAll(restorers);
  }
});

test("persists a user-authored message with a server-controlled role", async () => {
  let sessionQuery: unknown;
  let createQuery: unknown;
  const stored = chatMessage();
  const restorers = [
    replaceMethod(prisma.chatSession, "findFirst", async (...args) => {
      sessionQuery = args[0];
      return { id: sessionAId };
    }),
    replaceMethod(prisma.chatMessage, "create", async (...args) => {
      createQuery = args[0];
      return stored;
    }),
  ];

  try {
    const message = await createUserChatMessage(
      userAId,
      userBookAId,
      sessionAId,
      { content: "What does this passage mean?" },
    );

    assert.deepEqual(
      (sessionQuery as { where: Record<string, unknown> }).where,
      {
        id: sessionAId,
        userId: userAId,
        userBookId: userBookAId,
        userBook: { userId: userAId },
      },
    );
    assert.deepEqual(createQuery, {
      data: {
        sessionId: sessionAId,
        userId: userAId,
        role: ChatMessageRole.USER,
        content: "What does this passage mean?",
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
    assert.deepEqual(message, {
      id: messageAId,
      role: "user",
      content: "What does this passage mean?",
      createdAt: "2026-08-20T10:05:00.000Z",
    });
  } finally {
    restoreAll(restorers);
  }
});

test("rejects cross-user message creation even when both UserBooks share one Book", async () => {
  let createCalled = false;
  const restorers = [
    replaceMethod(prisma.chatSession, "findFirst", async () => null),
    replaceMethod(prisma.chatMessage, "create", async () => {
      createCalled = true;
      return chatMessage();
    }),
  ];

  try {
    await assert.rejects(
      createUserChatMessage(userAId, userBookAId, sessionBId, {
        content: "Attempted cross-user write",
      }),
      hasStatus(404),
    );
    assert.equal(createCalled, false);
  } finally {
    restoreAll(restorers);
  }
});

test("deletes only an owned session and relies on the database message cascade", async () => {
  let deleteQuery: unknown;
  const restorers = [
    replaceMethod(prisma.chatSession, "deleteMany", async (...args) => {
      deleteQuery = args[0];
      return { count: 1 };
    }),
  ];

  try {
    await deleteUserChatSession(userAId, userBookAId, sessionAId);

    assert.deepEqual(deleteQuery, {
      where: {
        id: sessionAId,
        userId: userAId,
        userBookId: userBookAId,
        userBook: { userId: userAId },
      },
    });
  } finally {
    restoreAll(restorers);
  }
});

test("returns 404 when deleting another user's session", async () => {
  const restorers = [
    replaceMethod(prisma.chatSession, "deleteMany", async () => ({ count: 0 })),
  ];

  try {
    await assert.rejects(
      deleteUserChatSession(userAId, userBookAId, sessionBId),
      hasStatus(404),
    );
  } finally {
    restoreAll(restorers);
  }
});

test("User A and User B cannot read or post across same-Book conversation boundaries", async () => {
  const queries: unknown[] = [];
  const restore = replaceMethod(
    prisma.chatSession,
    "findFirst",
    async (...args) => {
      queries.push(args[0]);
      return null;
    },
  );
  const attempts = [
    {
      attackerId: userAId,
      attackerUserBookId: userBookAId,
      victimSessionId: sessionBId,
    },
    {
      attackerId: userBId,
      attackerUserBookId: userBookBId,
      victimSessionId: sessionAId,
    },
  ];

  try {
    for (const attempt of attempts) {
      await assert.rejects(
        getUserChatSession(
          attempt.attackerId,
          attempt.attackerUserBookId,
          attempt.victimSessionId,
        ),
        hasStatus(404),
      );
      await assert.rejects(
        createUserChatMessage(
          attempt.attackerId,
          attempt.attackerUserBookId,
          attempt.victimSessionId,
          { content: "Cross-user attempt" },
        ),
        hasStatus(404),
      );
    }

    assert.equal(queries.length, 4);
    assert.deepEqual(
      queries.map((query) => (query as { where: unknown }).where),
      attempts.flatMap((attempt) => [
        {
          id: attempt.victimSessionId,
          userId: attempt.attackerId,
          userBookId: attempt.attackerUserBookId,
          userBook: { userId: attempt.attackerId },
        },
        {
          id: attempt.victimSessionId,
          userId: attempt.attackerId,
          userBookId: attempt.attackerUserBookId,
          userBook: { userId: attempt.attackerId },
        },
      ]),
    );
  } finally {
    restore();
  }
});
