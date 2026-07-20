import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../http/errors";
import {
  parseStartReadingSessionDto,
  parseUpdateReadingSessionDto,
} from "./reading-sessions.dto";

const chapterId = "22222222-2222-4222-8222-222222222222";

function assertBadRequest(callback: () => unknown): void {
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400,
  );
}

test("parses a reading-session start without client timestamps or ownership", () => {
  assert.deepEqual(
    parseStartReadingSessionDto({
      startPage: 12,
      startChapterId: chapterId,
      readerMode: "pdf",
    }),
    {
      startPage: 12,
      startChapterId: chapterId,
      readerMode: "pdf",
    },
  );
});

test("parses a monotonic total-duration session update", () => {
  assert.deepEqual(
    parseUpdateReadingSessionDto({
      activeDurationSeconds: 180,
      endPage: 18,
      endChapterId: null,
      readerMode: "reading",
      sequence: 4,
    }),
    {
      activeDurationSeconds: 180,
      endPage: 18,
      endChapterId: null,
      readerMode: "reading",
      sequence: 4,
    },
  );
});

test("rejects unknown identity, timestamp, and telemetry fields", () => {
  assertBadRequest(() =>
    parseStartReadingSessionDto({
      startPage: 1,
      readerMode: "pdf",
      userId: "client-controlled",
    }),
  );
  assertBadRequest(() =>
    parseUpdateReadingSessionDto({
      activeDurationSeconds: 2,
      endPage: 1,
      endChapterId: null,
      readerMode: "pdf",
      sequence: 1,
      endedAt: new Date().toISOString(),
    }),
  );
  assertBadRequest(() =>
    parseUpdateReadingSessionDto({
      activeDurationSeconds: 2,
      endPage: 1,
      endChapterId: null,
      readerMode: "pdf",
      sequence: 1,
      selectedText: "Private passage",
    }),
  );
});

test("rejects invalid pages, durations, modes, chapters, and missing fields", () => {
  assertBadRequest(() =>
    parseStartReadingSessionDto({ startPage: 0, readerMode: "pdf" }),
  );
  assertBadRequest(() =>
    parseStartReadingSessionDto({ startPage: 1, readerMode: "immersive" }),
  );
  assertBadRequest(() =>
    parseStartReadingSessionDto({
      startPage: 1,
      startChapterId: "not-a-uuid",
      readerMode: "pdf",
    }),
  );
  assertBadRequest(() =>
    parseUpdateReadingSessionDto({
      activeDurationSeconds: -1,
      endPage: 1,
      endChapterId: null,
      readerMode: "pdf",
      sequence: 1,
    }),
  );
  assertBadRequest(() =>
    parseUpdateReadingSessionDto({
      activeDurationSeconds: 1,
      endPage: 1,
      endChapterId: null,
      readerMode: "pdf",
    }),
  );
});
