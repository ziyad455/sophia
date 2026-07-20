import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../db/prisma";
import { deleteUserHighlight } from "../highlights/highlights.service";
import { HttpError } from "../http/errors";
import { parseCreateNoteDto } from "./notes.dto";
import {
  createUserNote,
  deleteUserNote,
  listUserNotes,
} from "./notes.service";

const userId = "11111111-1111-4111-8111-111111111111";
const userBookId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";
const chapterId = "44444444-4444-4444-8444-444444444444";
const highlightId = "55555555-5555-4555-8555-555555555555";
const noteId = "66666666-6666-4666-8666-666666666666";

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

function ownedBook() {
  return {
    id: userBookId,
    book: {
      id: bookId,
      pageCount: 120,
    },
  };
}

test("list returns 404 before querying notes when the user book is not owned", async () => {
  let notesQueried = false;
  let ownershipQuery: unknown;
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async (...args) => {
      ownershipQuery = args[0];
      return null;
    }),
    replaceMethod(prisma.note, "findMany", async () => {
      notesQueried = true;
      return [];
    }),
  ];

  try {
    await assert.rejects(
      listUserNotes(userId, userBookId),
      hasStatus(404),
    );
    assert.equal(notesQueried, false);
    assert.deepEqual(ownershipQuery, {
      where: { id: userBookId, userId },
      select: {
        id: true,
        book: {
          select: {
            id: true,
            pageCount: true,
          },
        },
      },
    });
  } finally {
    restoreAll(restorers);
  }
});

test("highlight notes derive their source from an owned active highlight", async () => {
  const anchor = {
    version: 1,
    source: "reader-selection-v1",
    mode: "pdf",
    sourceBlockId: null,
    startOffset: null,
    endOffset: null,
    pdfRects: [
      { pageNumber: 12, x: 10, y: 20, width: 80, height: 14 },
    ],
  };
  let highlightQuery: unknown;
  let createQuery: unknown;
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async () => ownedBook()),
    replaceMethod(prisma.highlight, "findFirst", async (...args) => {
      highlightQuery = args[0];
      return {
        id: highlightId,
        selectedText: "The examined life.",
        pageStart: 12,
        pageEnd: 12,
        chapterId,
        anchor,
      };
    }),
    replaceMethod(prisma.chapter, "findFirst", async () => ({ id: chapterId })),
    replaceMethod(prisma.note, "create", async (...args) => {
      createQuery = args[0];
      return {
        id: noteId,
        userId,
        userBookId,
        bookId,
        chapterId,
        pageNumber: 12,
        pageEnd: 12,
        chunkId: null,
        highlightId,
        quote: "The examined life.",
        anchor,
        content: "A central claim.",
        noteType: "MARGIN_NOTE",
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
        updatedAt: new Date("2026-07-20T10:00:00.000Z"),
        deletedAt: null,
        chapter: {
          title: "Chapter One",
          chapterIndex: 0,
          pageStart: 10,
          pageEnd: 20,
        },
      };
    }),
  ];

  try {
    const note = await createUserNote(
      userId,
      userBookId,
      parseCreateNoteDto({
        content: "A central claim.",
        highlightId,
      }),
    );
    const highlightWhere = (
      highlightQuery as { where: Record<string, unknown> }
    ).where;
    const createData = (
      createQuery as { data: Record<string, unknown> }
    ).data;

    assert.deepEqual(highlightWhere, {
      id: highlightId,
      userId,
      userBookId,
      bookId,
      deletedAt: null,
    });
    assert.equal(createData.quote, "The examined life.");
    assert.equal(createData.pageNumber, 12);
    assert.equal(createData.pageEnd, 12);
    assert.equal(createData.chapterId, chapterId);
    assert.equal(createData.highlightId, highlightId);
    assert.deepEqual(createData.anchor, anchor);
    assert.equal(note.context, "highlight");
    assert.equal(note.quote, "The examined life.");
  } finally {
    restoreAll(restorers);
  }
});

test("note deletion scopes the soft delete to user and user book", async () => {
  let deleteQuery: unknown;
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async () => ownedBook()),
    replaceMethod(prisma.note, "updateMany", async (...args) => {
      deleteQuery = args[0];
      return { count: 1 };
    }),
  ];

  try {
    await deleteUserNote(userId, userBookId, noteId);

    assert.deepEqual(
      (deleteQuery as { where: Record<string, unknown> }).where,
      {
        noteType: "MARGIN_NOTE",
        id: noteId,
        userId,
        userBookId,
        deletedAt: null,
      },
    );
    assert.ok(
      (deleteQuery as { data: { deletedAt: unknown } }).data.deletedAt
        instanceof Date,
    );
  } finally {
    restoreAll(restorers);
  }
});

test("highlight deletion detaches notes while preserving their source", async () => {
  const anchor = {
    version: 1,
    source: "reader-selection-v1",
    mode: "pdf",
    sourceBlockId: null,
    startOffset: null,
    endOffset: null,
    pdfRects: [
      { pageNumber: 12, x: 10, y: 20, width: 80, height: 14 },
    ],
  };
  let noteUpdateQuery: unknown;
  let highlightUpdateQuery: unknown;
  const restorers = [
    replaceMethod(prisma.userBook, "findFirst", async () => ownedBook()),
    replaceMethod(prisma.highlight, "findFirst", async () => ({
      id: highlightId,
      selectedText: "The examined life.",
      pageStart: 12,
      pageEnd: 12,
      chapterId,
      anchor,
    })),
    replaceMethod(prisma.note, "updateMany", (...args) => {
      noteUpdateQuery = args[0];
      return Promise.resolve({ count: 1 });
    }),
    replaceMethod(prisma.highlight, "update", (...args) => {
      highlightUpdateQuery = args[0];
      return Promise.resolve({ id: highlightId });
    }),
    replaceMethod(prisma, "$transaction", async (...args) => {
      return Promise.all(args[0] as Array<Promise<unknown>>);
    }),
  ];

  try {
    await deleteUserHighlight(userId, userBookId, highlightId);
    const noteUpdate = noteUpdateQuery as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    const highlightUpdate = highlightUpdateQuery as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };

    assert.deepEqual(noteUpdate.where, {
      userId,
      userBookId,
      highlightId,
      deletedAt: null,
    });
    assert.equal(noteUpdate.data.highlightId, null);
    assert.equal(noteUpdate.data.quote, "The examined life.");
    assert.equal(noteUpdate.data.pageNumber, 12);
    assert.equal(noteUpdate.data.pageEnd, 12);
    assert.equal(noteUpdate.data.chapterId, chapterId);
    assert.deepEqual(noteUpdate.data.anchor, anchor);
    assert.deepEqual(highlightUpdate.where, { id: highlightId });
    assert.ok(highlightUpdate.data.deletedAt instanceof Date);
  } finally {
    restoreAll(restorers);
  }
});
