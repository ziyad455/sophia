import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../http/errors";
import { parseCreateHighlightDto } from "./highlights.dto";
import { THEME_HIGHLIGHT_COLORS } from "./highlights.types";

const pageId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";

function validReadingHighlight() {
  return {
    text: "  The unexamined   life is not worth living.  ",
    mode: "reading",
    pageStart: 12,
    pageEnd: 12,
    chapterId,
    sourceBlockId: `${pageId}:paragraph:3`,
    startOffset: 8,
    endOffset: 48,
    color: "printed-ink-v2-1",
    pdfRects: [],
  };
}

function assertBadRequest(callback: () => unknown): void {
  assert.throws(callback, (error: unknown) =>
    error instanceof HttpError && error.statusCode === 400,
  );
}

test("parses and normalizes a stable Reading Mode highlight", () => {
  const dto = parseCreateHighlightDto(validReadingHighlight());

  assert.equal(dto.text, "The unexamined life is not worth living.");
  assert.equal(dto.sourceBlockId, `${pageId}:paragraph:3`);
  assert.equal(dto.color, "printed-ink-v2-1");
});

test("accepts a cross-block Reading Mode highlight without invented offsets", () => {
  const dto = parseCreateHighlightDto({
    ...validReadingHighlight(),
    pageEnd: 13,
    sourceBlockId: null,
    startOffset: null,
    endOffset: null,
  });

  assert.equal(dto.sourceBlockId, null);
  assert.equal(dto.startOffset, null);
  assert.equal(dto.endOffset, null);
});

test("accepts validated PDF page coordinates", () => {
  const dto = parseCreateHighlightDto({
    text: "A PDF quotation",
    mode: "pdf",
    pageStart: 4,
    pageEnd: 4,
    chapterId: null,
    sourceBlockId: null,
    startOffset: 40,
    endOffset: 55,
    color: "warm-paper-v2-2",
    pdfRects: [{ pageNumber: 4, x: 10.5, y: 20, width: 80, height: 14 }],
  });

  assert.deepEqual(dto.pdfRects, [
    { pageNumber: 4, x: 10.5, y: 20, width: 80, height: 14 },
  ]);
});

test("rejects unsupported fields and arbitrary colors", () => {
  assertBadRequest(() => parseCreateHighlightDto({
    ...validReadingHighlight(),
    userId: "not-client-controlled",
  }));
  assertBadRequest(() => parseCreateHighlightDto({
    ...validReadingHighlight(),
    color: "#ff00ff",
  }));
  assertBadRequest(() => parseCreateHighlightDto({
    ...validReadingHighlight(),
    color: "gold",
  }));
  assertBadRequest(() => parseCreateHighlightDto({
    ...validReadingHighlight(),
    color: "printed-ink-1",
  }));
});

test("accepts exactly the nine theme-specific highlight colors", () => {
  assert.deepEqual(THEME_HIGHLIGHT_COLORS, [
    "printed-ink-v2-1",
    "printed-ink-v2-2",
    "printed-ink-v2-3",
    "warm-paper-v2-1",
    "warm-paper-v2-2",
    "warm-paper-v2-3",
    "night-study-v2-1",
    "night-study-v2-2",
    "night-study-v2-3",
  ]);

  for (const color of THEME_HIGHLIGHT_COLORS) {
    assert.equal(
      parseCreateHighlightDto({ ...validReadingHighlight(), color }).color,
      color,
    );
  }
});

test("defaults an omitted color to the first Printed Ink color", () => {
  const highlight = validReadingHighlight();

  delete (highlight as Partial<typeof highlight>).color;

  assert.equal(parseCreateHighlightDto(highlight).color, "printed-ink-v2-1");
});

test("rejects invalid ranges and incomplete source offsets", () => {
  assertBadRequest(() => parseCreateHighlightDto({
    ...validReadingHighlight(),
    pageStart: 13,
    pageEnd: 12,
  }));
  assertBadRequest(() => parseCreateHighlightDto({
    ...validReadingHighlight(),
    endOffset: null,
  }));
});
