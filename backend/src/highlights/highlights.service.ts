import type { Highlight, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, conflict, notFound } from "../http/errors";
import type { CreateHighlightDto } from "./highlights.dto";
import { isUuid } from "./highlights.dto";
import { mapHighlight, parseStoredHighlightAnchor } from "./highlights.mapper";
import type { HighlightAnchor, PublicHighlight } from "./highlights.types";

type OwnedBook = {
  id: string;
  book: {
    id: string;
    pageCount: number | null;
  };
};

function sourcePageId(sourceBlockId: string): string {
  return sourceBlockId.slice(0, sourceBlockId.indexOf(":paragraph:"));
}

function createAnchor(dto: CreateHighlightDto): HighlightAnchor {
  return {
    version: 1,
    source: "reader-selection-v1",
    mode: dto.mode,
    sourceBlockId: dto.sourceBlockId,
    startOffset: dto.startOffset,
    endOffset: dto.endOffset,
    pdfRects: dto.pdfRects,
  };
}

function samePdfRects(left: HighlightAnchor["pdfRects"], right: HighlightAnchor["pdfRects"]): boolean {
  return left.length === right.length && left.every((rect, index) => {
    const candidate = right[index];

    return Boolean(candidate) &&
      rect.pageNumber === candidate.pageNumber &&
      rect.x === candidate.x &&
      rect.y === candidate.y &&
      rect.width === candidate.width &&
      rect.height === candidate.height;
  });
}

function sameAnchorLocation(left: HighlightAnchor, right: HighlightAnchor): boolean {
  return left.mode === right.mode &&
    left.sourceBlockId === right.sourceBlockId &&
    left.startOffset === right.startOffset &&
    left.endOffset === right.endOffset &&
    samePdfRects(left.pdfRects, right.pdfRects);
}

function hasRangeOverlap(highlight: Highlight, anchor: HighlightAnchor): boolean {
  if (
    anchor.mode !== "reading" ||
    anchor.sourceBlockId === null ||
    anchor.startOffset === null ||
    anchor.endOffset === null
  ) {
    return false;
  }

  const existing = parseStoredHighlightAnchor(highlight.anchor);

  return existing.mode === "reading" &&
    existing.sourceBlockId === anchor.sourceBlockId &&
    existing.startOffset !== null &&
    existing.endOffset !== null &&
    anchor.startOffset < existing.endOffset &&
    anchor.endOffset > existing.startOffset;
}

function sortHighlights(left: PublicHighlight, right: PublicHighlight): number {
  return left.pageStart - right.pageStart ||
    (left.startOffset ?? Number.MAX_SAFE_INTEGER) -
      (right.startOffset ?? Number.MAX_SAFE_INTEGER) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id);
}

async function requireOwnedBook(userId: string, userBookId: string): Promise<OwnedBook> {
  if (!isUuid(userBookId)) {
    throw notFound("Book not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
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

  if (!userBook) {
    throw notFound("Book not found.");
  }

  return userBook;
}

async function validateSourceLocation(book: OwnedBook, dto: CreateHighlightDto): Promise<void> {
  if (book.book.pageCount !== null && dto.pageEnd > book.book.pageCount) {
    throw badRequest("The highlight page range is outside this book.");
  }

  if (dto.chapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: dto.chapterId,
        bookId: book.book.id,
      },
      select: { id: true },
    });

    if (!chapter) {
      throw badRequest("chapterId does not belong to this book.");
    }
  }

  if (dto.mode !== "reading" || !dto.sourceBlockId) {
    return;
  }

  const page = await prisma.page.findFirst({
    where: {
      id: sourcePageId(dto.sourceBlockId),
      bookId: book.book.id,
      pageNumber: {
        gte: dto.pageStart,
        lte: dto.pageEnd,
      },
    },
    select: {
      chapterId: true,
    },
  });

  if (!page || (dto.chapterId && page.chapterId !== dto.chapterId)) {
    throw badRequest("sourceBlockId does not belong to the supplied book location.");
  }
}

export async function createUserHighlight(
  userId: string,
  userBookId: string,
  dto: CreateHighlightDto,
): Promise<{ highlight: PublicHighlight; created: boolean }> {
  const userBook = await requireOwnedBook(userId, userBookId);

  await validateSourceLocation(userBook, dto);

  const anchor = createAnchor(dto);
  const candidates = await prisma.highlight.findMany({
    where: {
      userId,
      userBookId,
      bookId: userBook.book.id,
      pageStart: dto.pageStart,
      pageEnd: dto.pageEnd,
      deletedAt: null,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
  const duplicate = candidates.find((candidate) =>
    candidate.selectedText === dto.text &&
    candidate.chapterId === dto.chapterId &&
    sameAnchorLocation(parseStoredHighlightAnchor(candidate.anchor), anchor),
  );

  if (duplicate) {
    return { highlight: mapHighlight(duplicate), created: false };
  }

  if (candidates.some((candidate) => hasRangeOverlap(candidate, anchor))) {
    throw conflict("This passage overlaps an existing highlight.");
  }

  const highlight = await prisma.highlight.create({
    data: {
      userId,
      userBookId,
      bookId: userBook.book.id,
      chapterId: dto.chapterId,
      pageStart: dto.pageStart,
      pageEnd: dto.pageEnd,
      selectedText: dto.text,
      color: dto.color,
      anchor: anchor as unknown as Prisma.InputJsonValue,
    },
  });

  return { highlight: mapHighlight(highlight), created: true };
}

export async function listUserHighlights(
  userId: string,
  userBookId: string,
): Promise<PublicHighlight[]> {
  await requireOwnedBook(userId, userBookId);

  const highlights = await prisma.highlight.findMany({
    where: {
      userId,
      userBookId,
      deletedAt: null,
    },
    orderBy: [
      { pageStart: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return highlights.map(mapHighlight).sort(sortHighlights);
}

export async function deleteUserHighlight(
  userId: string,
  userBookId: string,
  highlightId: string,
): Promise<void> {
  await requireOwnedBook(userId, userBookId);

  if (!isUuid(highlightId)) {
    throw notFound("Highlight not found.");
  }

  const highlight = await prisma.highlight.findFirst({
    where: {
      id: highlightId,
      userId,
      userBookId,
      deletedAt: null,
    },
    select: {
      id: true,
      selectedText: true,
      pageStart: true,
      pageEnd: true,
      chapterId: true,
      anchor: true,
    },
  });

  if (!highlight) {
    throw notFound("Highlight not found.");
  }

  const deletedAt = new Date();
  // A deleted highlight becomes an ordinary passage source; never cascade-delete
  // the user's private note content.

  await prisma.$transaction([
    prisma.note.updateMany({
      where: {
        userId,
        userBookId,
        highlightId: highlight.id,
        deletedAt: null,
      },
      data: {
        highlightId: null,
        quote: highlight.selectedText,
        pageNumber: highlight.pageStart,
        pageEnd: highlight.pageEnd,
        chapterId: highlight.chapterId,
        anchor: highlight.anchor as Prisma.InputJsonValue,
      },
    }),
    prisma.highlight.update({
      where: {
        id: highlight.id,
      },
      data: {
        deletedAt,
      },
    }),
  ]);
}
