import { NoteType, type Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../http/errors";
import { parseStoredHighlightAnchor } from "../highlights/highlights.mapper";
import type { CreateNoteDto, UpdateNoteDto } from "./notes.dto";
import { isUuid } from "./notes.dto";
import { mapNote, sortNotes } from "./notes.mapper";
import type { NoteWithChapter } from "./notes.mapper";
import type { NoteAnchor, PublicNote } from "./notes.types";

type OwnedBook = {
  id: string;
  book: {
    id: string;
    pageCount: number | null;
  };
};

const chapterSelection = {
  title: true,
  chapterIndex: true,
  pageStart: true,
  pageEnd: true,
} as const;

const noteInclude = {
  chapter: {
    select: chapterSelection,
  },
} as const;

async function requireOwnedBook(
  userId: string,
  userBookId: string,
): Promise<OwnedBook> {
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

function validatePageRange(
  book: OwnedBook,
  pageStart: number | null,
  pageEnd: number | null,
): void {
  if (pageStart === null || pageEnd === null) {
    return;
  }

  if (book.book.pageCount !== null && pageEnd > book.book.pageCount) {
    throw badRequest("The note page range is outside this book.");
  }
}

async function validateChapter(
  bookId: string,
  chapterId: string | null,
): Promise<void> {
  if (!chapterId) {
    return;
  }

  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      bookId,
    },
    select: { id: true },
  });

  if (!chapter) {
    throw badRequest("chapterId does not belong to this book.");
  }
}

function sourcePageId(sourceBlockId: string): string {
  return sourceBlockId.slice(0, sourceBlockId.indexOf(":paragraph:"));
}

async function validateAnchor(
  bookId: string,
  chapterId: string | null,
  pageStart: number | null,
  pageEnd: number | null,
  anchor: NoteAnchor | null,
): Promise<void> {
  if (
    !anchor ||
    anchor.mode !== "reading" ||
    !anchor.sourceBlockId ||
    pageStart === null ||
    pageEnd === null
  ) {
    return;
  }

  const page = await prisma.page.findFirst({
    where: {
      id: sourcePageId(anchor.sourceBlockId),
      bookId,
      pageNumber: {
        gte: pageStart,
        lte: pageEnd,
      },
    },
    select: {
      chapterId: true,
    },
  });

  if (!page || (chapterId && page.chapterId !== chapterId)) {
    throw badRequest("anchor.sourceBlockId does not belong to this book location.");
  }
}

async function requireOwnedNote(
  userId: string,
  userBookId: string,
  noteId: string,
): Promise<NoteWithChapter> {
  if (!isUuid(noteId)) {
    throw notFound("Note not found.");
  }

  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      noteType: NoteType.MARGIN_NOTE,
      userId,
      userBookId,
      deletedAt: null,
    },
    include: noteInclude,
  });

  if (!note) {
    throw notFound("Note not found.");
  }

  return note;
}

export async function createUserNote(
  userId: string,
  userBookId: string,
  dto: CreateNoteDto,
): Promise<PublicNote> {
  const userBook = await requireOwnedBook(userId, userBookId);
  let quote = dto.quote;
  let pageStart = dto.pageStart;
  let pageEnd = dto.pageEnd;
  let chapterId = dto.chapterId;
  let highlightId = dto.highlightId;
  let anchor = dto.anchor;

  if (highlightId) {
    const highlight = await prisma.highlight.findFirst({
      where: {
        id: highlightId,
        userId,
        userBookId,
        bookId: userBook.book.id,
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

    quote = highlight.selectedText;
    pageStart = highlight.pageStart;
    pageEnd = highlight.pageEnd;
    chapterId = highlight.chapterId;
    anchor = parseStoredHighlightAnchor(highlight.anchor);
  }

  validatePageRange(userBook, pageStart, pageEnd);
  await validateChapter(userBook.book.id, chapterId);
  await validateAnchor(
    userBook.book.id,
    chapterId,
    pageStart,
    pageEnd,
    anchor,
  );

  const note = await prisma.note.create({
    data: {
      userId,
      userBookId,
      bookId: userBook.book.id,
      chapterId,
      pageNumber: pageStart,
      pageEnd,
      highlightId,
      quote,
      anchor: anchor
        ? anchor as unknown as Prisma.InputJsonValue
        : undefined,
      content: dto.content,
      noteType: NoteType.MARGIN_NOTE,
    },
    include: noteInclude,
  });

  return mapNote(note);
}

export async function listUserNotes(
  userId: string,
  userBookId: string,
): Promise<PublicNote[]> {
  await requireOwnedBook(userId, userBookId);

  const notes = await prisma.note.findMany({
    where: {
      userId,
      userBookId,
      noteType: NoteType.MARGIN_NOTE,
      deletedAt: null,
    },
    include: noteInclude,
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return sortNotes(notes.map(mapNote));
}

export async function getUserNote(
  userId: string,
  userBookId: string,
  noteId: string,
): Promise<PublicNote> {
  await requireOwnedBook(userId, userBookId);
  const note = await requireOwnedNote(userId, userBookId, noteId);

  return mapNote(note);
}

export async function updateUserNote(
  userId: string,
  userBookId: string,
  noteId: string,
  dto: UpdateNoteDto,
): Promise<PublicNote> {
  await requireOwnedBook(userId, userBookId);
  const existing = await requireOwnedNote(userId, userBookId, noteId);
  const note = await prisma.note.update({
    where: {
      id: existing.id,
    },
    data: {
      content: dto.content,
    },
    include: noteInclude,
  });

  return mapNote(note);
}

export async function deleteUserNote(
  userId: string,
  userBookId: string,
  noteId: string,
): Promise<void> {
  await requireOwnedBook(userId, userBookId);

  if (!isUuid(noteId)) {
    throw notFound("Note not found.");
  }

  const result = await prisma.note.updateMany({
    where: {
      id: noteId,
      userId,
      noteType: NoteType.MARGIN_NOTE,
      userBookId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    throw notFound("Note not found.");
  }
}
