import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";
import { ChatSessionMode } from "@prisma/client";
import { prisma } from "../db/prisma";
import { HttpError } from "../http/errors";
import type { ApiRequest, ApiResponse } from "../http/types";
import { createChatMessage, createChatSession } from "./chat.controller";

const userAId = "11111111-1111-4111-8111-111111111111";
const userBookAId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";

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

function responseRecorder(): {
  response: ApiResponse;
  statusCode: () => number | undefined;
  body: () => unknown;
} {
  let recordedStatus: number | undefined;
  let recordedBody: unknown;
  const response = {
    status(statusCode: number) {
      recordedStatus = statusCode;
      return this;
    },
    json(body: unknown) {
      recordedBody = body;
    },
    end() {},
  } as unknown as ApiResponse;

  return {
    response,
    statusCode: () => recordedStatus,
    body: () => recordedBody,
  };
}

test("controller creates a session using only authenticated request identity", async () => {
  let ownershipQuery: unknown;
  const restoreOwnership = replaceMethod(
    prisma.userBook,
    "findFirst",
    async (...args) => {
      ownershipQuery = args[0];
      return { id: userBookAId, bookId };
    },
  );
  const restoreCreate = replaceMethod(prisma.chatSession, "create", async () => ({
    id: sessionId,
    userId: userAId,
    userBookId: userBookAId,
    bookId,
    chapterId: null,
    title: null,
    mode: ChatSessionMode.GENERAL_READING_HELP,
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    archivedAt: null,
  }));
  const recorder = responseRecorder();
  const request = {
    headers: {},
    params: { userBookId: userBookAId },
    body: {},
    auth: { userId: userAId, sessionId: "auth-session" },
  } as unknown as ApiRequest;

  try {
    await createChatSession(request, recorder.response);

    assert.deepEqual(
      (ownershipQuery as { where: Record<string, unknown> }).where,
      { id: userBookAId, userId: userAId },
    );
    assert.equal(recorder.statusCode(), 201);
    assert.deepEqual(recorder.body(), {
      session: {
        id: sessionId,
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      },
    });
  } finally {
    restoreCreate();
    restoreOwnership();
  }
});

test("controller rejects client-controlled assistant messages before persistence", async () => {
  let sessionQueried = false;
  const restore = replaceMethod(prisma.chatSession, "findFirst", async () => {
    sessionQueried = true;
    return { id: sessionId };
  });
  const recorder = responseRecorder();
  const request = {
    headers: {},
    params: { userBookId: userBookAId, sessionId },
    body: { content: "Forged response", role: "assistant" },
    auth: { userId: userAId, sessionId: "auth-session" },
  } as unknown as ApiRequest;

  try {
    await assert.rejects(
      createChatMessage(request, recorder.response),
      (error: unknown) =>
        error instanceof HttpError && error.statusCode === 400,
    );
    assert.equal(sessionQueried, false);
  } finally {
    restore();
  }
});
