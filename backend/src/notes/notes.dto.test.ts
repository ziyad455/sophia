import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../http/errors";
import {
  MAX_NOTE_CONTENT_LENGTH,
  parseCreateNoteDto,
  parseUpdateNoteDto,
} from "./notes.dto";

const chapterId = "22222222-2222-4222-8222-222222222222";
const highlightId = "33333333-3333-4333-8333-333333333333";

function assertBadRequest(callback: () => unknown): void {
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400,
  );
}

test("parses a passage note and preserves the note wording", () => {
  const dto = parseCreateNoteDto({
    type: "margin_note",
    content: "  First line.\n\nSecond   line.  ",
    quote: "  The examined   life.  ",
    pageStart: 12,
    pageEnd: 12,
    chapterId,
    anchor: {
      mode: "pdf",
      sourceBlockId: null,
      startOffset: 8,
      endOffset: 27,
      pdfRects: [
        { pageNumber: 12, x: 10, y: 20, width: 80, height: 14 },
      ],
    },
  });

  assert.equal(dto.context, "passage");
  assert.equal(dto.content, "First line.\n\nSecond   line.");
  assert.equal(dto.quote, "The examined life.");
  assert.equal(dto.anchor?.source, "reader-selection-v1");
});

test("derives highlight source server-side by rejecting client source fields", () => {
  const dto = parseCreateNoteDto({
    content: "A central claim.",
    highlightId,
  });

  assert.equal(dto.context, "highlight");
  assert.equal(dto.highlightId, highlightId);

  assertBadRequest(() =>
    parseCreateNoteDto({
      content: "A central claim.",
      highlightId,
      quote: "Client-controlled quote",
    }),
  );
});

test("distinguishes page, chapter, and book note contexts", () => {
  assert.equal(
    parseCreateNoteDto({
      content: "This page introduces the problem.",
      pageStart: 4,
      pageEnd: 4,
    }).context,
    "page",
  );
  assert.equal(
    parseCreateNoteDto({
      content: "The argument turns here.",
      chapterId,
    }).context,
    "chapter",
  );
  assert.equal(
    parseCreateNoteDto({
      content: "Compare this with Camus.",
    }).context,
    "book",
  );
});

test("rejects invalid types, source ranges, unknown fields, and markup", () => {
  assertBadRequest(() =>
    parseCreateNoteDto({ type: "summary", content: "Not in this MVP." }),
  );
  assertBadRequest(() =>
    parseCreateNoteDto({
      content: "Invalid range.",
      quote: "Passage",
      pageStart: 5,
      pageEnd: 4,
    }),
  );
  assertBadRequest(() =>
    parseCreateNoteDto({
      content: "Not a single page.",
      pageStart: 5,
      pageEnd: 6,
    }),
  );
  assertBadRequest(() =>
    parseCreateNoteDto({
      content: "Private",
      userId: "client-controlled",
    }),
  );
  assertBadRequest(() =>
    parseCreateNoteDto({
      content: "<script>alert(1)</script>",
    }),
  );
});

test("rejects empty and oversized note content", () => {
  assertBadRequest(() => parseCreateNoteDto({ content: "   " }));
  assertBadRequest(() =>
    parseCreateNoteDto({ content: "x".repeat(MAX_NOTE_CONTENT_LENGTH + 1) }),
  );
});

test("PATCH accepts only trimmed plain-text content", () => {
  assert.deepEqual(parseUpdateNoteDto({ content: "  Revised thought.  " }), {
    content: "Revised thought.",
  });
  assertBadRequest(() =>
    parseUpdateNoteDto({
      content: "Revised.",
      pageStart: 4,
    }),
  );
});
