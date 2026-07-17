import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BookProcessingStatus,
  BookSourceType,
  PageExtractionStatus,
  UserBookStatus,
} from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db/prisma";
import { badRequest, conflict, notFound } from "../http/errors";
import type { UpdateBookMetadataDto, UpdateReadingProgressDto } from "./books.dto";
import type {
  LibraryBook,
  ReaderChapter,
  ReaderData,
  ReadingContentChapter,
  ReadingContentData,
  ReadingContentPage,
  ReadingProgressData,
  UploadedLibraryBook,
} from "./books.types";
import { generatePdfCoverThumbnail } from "./covers";
import type { UploadedPdfFile } from "./upload";

type UserBookWithBook = {
  id: string;
  status: UserBookStatus;
  addedAt: Date;
  lastOpenedAt: Date | null;
  readingProgress?: {
    currentPage: number;
    progressPercent: { toNumber(): number };
  } | null;
  book: {
    id: string;
    title: string;
    author: string | null;
    language: string;
    filePath: string;
    processingStatus: BookProcessingStatus;
    processingError: string | null;
    pageCount: number | null;
    coverPath: string | null;
  };
};

export type BookCoverFile = {
  buffer: Buffer;
  contentType: "image/webp";
};

export type BookPdfFile = {
  absolutePath: string;
  sizeBytes: number;
};

export type UploadPdfBookInput = {
  userId: string;
  file: UploadedPdfFile;
  title?: string;
  author?: string;
  language?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serializeStatus(value: string): string {
  return value.toLowerCase();
}

function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function calculateProgressPercent(currentPage: number, pageCount: number | null): number {
  if (!pageCount || pageCount < 1) {
    return 0;
  }

  return clampProgressPercent((currentPage / pageCount) * 100);
}

function findChapterIdForPage(
  chapters: Array<{
    id: string;
    pageStart: number | null;
    pageEnd: number | null;
  }>,
  currentPage: number,
  pageCount: number | null,
): string | null {
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.pageStart === null || currentPage < chapter.pageStart) {
      continue;
    }

    const nextChapterStart = chapters[index + 1]?.pageStart;
    const effectivePageEnd =
      chapter.pageEnd ??
      (nextChapterStart === null || nextChapterStart === undefined
        ? pageCount
        : nextChapterStart - 1);

    if (effectivePageEnd === null || currentPage <= effectivePageEnd) {
      return chapter.id;
    }
  }

  return null;
}

function serializeReaderChapter(chapter: {
  id: string;
  title: string | null;
  chapterIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
}): ReaderChapter {
  return {
    id: chapter.id,
    title: chapter.title,
    chapterIndex: chapter.chapterIndex,
    pageStart: chapter.pageStart,
    pageEnd: chapter.pageEnd,
  };
}

function serializeLibraryBook(userBook: UserBookWithBook): LibraryBook {
  return {
    userBookId: userBook.id,
    bookId: userBook.book.id,
    title: userBook.book.title,
    author: userBook.book.author,
    language: userBook.book.language,
    status: serializeStatus(userBook.status),
    processingStatus: serializeStatus(userBook.book.processingStatus),
    processingError: userBook.book.processingError,
    pageCount: userBook.book.pageCount,
    addedAt: userBook.addedAt.toISOString(),
    lastOpenedAt: userBook.lastOpenedAt?.toISOString() ?? null,
    currentPage: userBook.readingProgress?.currentPage ?? 1,
    progressPercent: clampProgressPercent(
      userBook.readingProgress?.progressPercent.toNumber() ?? 0,
    ),
    coverUrl: userBook.book.coverPath ? `/books/${userBook.id}/cover` : null,
  };
}

async function tryGenerateMissingCover(book: { id: string; filePath: string }): Promise<string | null> {
  try {
    const pdfBuffer = await readFile(resolveUploadPath(book.filePath));
    const coverPath = await generatePdfCoverThumbnail(book.id, pdfBuffer);
    const updatedBook = await prisma.book.update({
      where: {
        id: book.id,
      },
      data: {
        coverPath,
      },
      select: {
        coverPath: true,
      },
    });

    return updatedBook.coverPath;
  } catch (error) {
    console.warn(`Failed to generate missing cover thumbnail for book ${book.id}.`, error);
    return null;
  }
}

async function withMissingCoversGenerated(userBooks: UserBookWithBook[]): Promise<UserBookWithBook[]> {
  return Promise.all(
    userBooks.map(async (userBook) => {
      if (userBook.book.coverPath) {
        return userBook;
      }

      const coverPath = await tryGenerateMissingCover(userBook.book);

      return {
        ...userBook,
        book: {
          ...userBook.book,
          coverPath,
        },
      };
    }),
  );
}

function serializeUploadedLibraryBook(userBook: UserBookWithBook): UploadedLibraryBook {
  return serializeLibraryBook(userBook);
}

function getTitleFromFilename(filename: string): string {
  const parsedName = path.basename(filename, path.extname(filename)).trim();

  return parsedName || "Untitled PDF";
}

function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function buildPdfStoragePath(bookId: string): {
  absolutePath: string;
  relativePath: string;
} {
  const relativePath = path.join("books", "pdf", `${bookId}.pdf`);

  return {
    relativePath,
    absolutePath: path.join(config.upload.uploadDir, relativePath),
  };
}

function resolveUploadPath(relativePath: string): string {
  const uploadRoot = path.resolve(config.upload.uploadDir);
  const absolutePath = path.resolve(uploadRoot, relativePath);

  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw notFound("Book cover not found.");
  }

  return absolutePath;
}

export async function listUserLibrary(userId: string): Promise<LibraryBook[]> {
  const userBooks = await prisma.userBook.findMany({
    where: {
      userId,
    },
    orderBy: {
      addedAt: "desc",
    },
    include: {
      readingProgress: {
        select: {
          currentPage: true,
          progressPercent: true,
        },
      },
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          language: true,
          filePath: true,
          processingStatus: true,
          processingError: true,
          pageCount: true,
          coverPath: true,
        },
      },
    },
  });

  const booksWithCovers = await withMissingCoversGenerated(userBooks);

  return booksWithCovers.map(serializeLibraryBook);
}

export async function getUserLibraryBook(userId: string, userBookId: string): Promise<LibraryBook> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    include: {
      readingProgress: {
        select: {
          currentPage: true,
          progressPercent: true,
        },
      },
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          language: true,
          filePath: true,
          processingStatus: true,
          processingError: true,
          pageCount: true,
          coverPath: true,
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  const [bookWithCover] = await withMissingCoversGenerated([userBook]);

  return serializeLibraryBook(bookWithCover);
}

function getReaderStatusConflictMessage(status: BookProcessingStatus): string {
  if (status === BookProcessingStatus.UPLOADED) {
    return "This book has not been prepared yet.";
  }

  if (
    status === BookProcessingStatus.EXTRACTING_TEXT ||
    status === BookProcessingStatus.CHUNKING
  ) {
    return "This book is still being prepared.";
  }

  if (status === BookProcessingStatus.FAILED) {
    return "This book could not be prepared for reading.";
  }

  return "This book is not ready to read yet.";
}

export async function getUserLibraryBookReaderData(
  userId: string,
  userBookId: string,
): Promise<ReaderData> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      id: true,
      readingProgress: {
        select: {
          currentPage: true,
          currentChapter: {
            select: {
              id: true,
              title: true,
              chapterIndex: true,
              pageStart: true,
              pageEnd: true,
            },
          },
        },
      },
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          language: true,
          processingStatus: true,
          pageCount: true,
          chapters: {
            orderBy: {
              chapterIndex: "asc",
            },
            select: {
              id: true,
              title: true,
              chapterIndex: true,
              pageStart: true,
              pageEnd: true,
            },
          },
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  if (userBook.book.processingStatus !== BookProcessingStatus.READY) {
    throw conflict(getReaderStatusConflictMessage(userBook.book.processingStatus));
  }

  await prisma.userBook.update({
    where: {
      id: userBook.id,
    },
    data: {
      lastOpenedAt: new Date(),
    },
  });

  return {
    book: {
      userBookId: userBook.id,
      bookId: userBook.book.id,
      title: userBook.book.title,
      author: userBook.book.author,
      language: userBook.book.language,
      processingStatus: serializeStatus(userBook.book.processingStatus),
      pageCount: userBook.book.pageCount,
      currentPage: userBook.readingProgress?.currentPage ?? 1,
      currentChapter: userBook.readingProgress?.currentChapter
        ? serializeReaderChapter(userBook.readingProgress.currentChapter)
        : null,
      pdfUrl: `/books/${userBook.id}/pdf`,
    },
    chapters: userBook.book.chapters.map(serializeReaderChapter),
  };
}

export async function getUserBookReadingProgress(
  userId: string,
  userBookId: string,
): Promise<ReadingProgressData> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      id: true,
      readingProgress: {
        select: {
          currentPage: true,
          progressPercent: true,
          lastReadAt: true,
          updatedAt: true,
        },
      },
      book: {
        select: {
          pageCount: true,
          chapters: {
            orderBy: {
              chapterIndex: "asc",
            },
            select: {
              id: true,
              pageStart: true,
              pageEnd: true,
            },
          },
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  const storedProgress = userBook.readingProgress;

  if (!storedProgress) {
    return {
      userBookId: userBook.id,
      currentPage: 1,
      currentChapterId: null,
      progressPercent: 0,
      lastReadAt: null,
      updatedAt: null,
    };
  }

  const maximumPage = userBook.book.pageCount && userBook.book.pageCount > 0
    ? userBook.book.pageCount
    : null;
  const currentPage = maximumPage
    ? Math.min(maximumPage, Math.max(1, storedProgress.currentPage))
    : Math.max(1, storedProgress.currentPage);
  const currentChapterId = findChapterIdForPage(
    userBook.book.chapters,
    currentPage,
    maximumPage,
  );
  const progressPercent = maximumPage
    ? calculateProgressPercent(currentPage, maximumPage)
    : clampProgressPercent(storedProgress.progressPercent.toNumber());

  return {
    userBookId: userBook.id,
    currentPage,
    currentChapterId,
    progressPercent,
    lastReadAt: storedProgress.lastReadAt?.toISOString() ?? null,
    updatedAt: storedProgress.updatedAt.toISOString(),
  };
}

export async function upsertUserBookReadingProgress(
  userId: string,
  userBookId: string,
  dto: UpdateReadingProgressDto,
): Promise<ReadingProgressData> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      id: true,
      bookId: true,
      readingProgress: {
        select: {
          currentPage: true,
          progressPercent: true,
        },
      },
      book: {
        select: {
          pageCount: true,
          chapters: {
            orderBy: {
              chapterIndex: "asc",
            },
            select: {
              id: true,
              pageStart: true,
              pageEnd: true,
            },
          },
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  if (
    dto.currentChapterId &&
    !userBook.book.chapters.some((chapter) => chapter.id === dto.currentChapterId)
  ) {
    throw badRequest("currentChapterId does not belong to this book.");
  }

  const currentPage = dto.currentPage ?? userBook.readingProgress?.currentPage ?? 1;
  const pageCount = userBook.book.pageCount;

  if (pageCount && currentPage > pageCount) {
    throw badRequest(`currentPage must not exceed this book's ${pageCount} pages.`);
  }

  const currentChapterId = findChapterIdForPage(
    userBook.book.chapters,
    currentPage,
    pageCount,
  );
  const progressPercent = pageCount
    ? calculateProgressPercent(currentPage, pageCount)
    : clampProgressPercent(
        dto.progressPercent ?? userBook.readingProgress?.progressPercent.toNumber() ?? 0,
      );
  const now = new Date();
  const progress = await prisma.readingProgress.upsert({
    where: {
      userBookId: userBook.id,
    },
    create: {
      userId,
      userBookId: userBook.id,
      bookId: userBook.bookId,
      currentPage,
      currentChapterId,
      progressPercent,
      lastReadAt: now,
    },
    update: {
      currentPage,
      currentChapterId,
      progressPercent,
      lastReadAt: now,
    },
    select: {
      userBookId: true,
      currentPage: true,
      currentChapterId: true,
      progressPercent: true,
      lastReadAt: true,
      updatedAt: true,
    },
  });

  return {
    userBookId: progress.userBookId,
    currentPage: progress.currentPage,
    currentChapterId: progress.currentChapterId,
    progressPercent: clampProgressPercent(progress.progressPercent.toNumber()),
    lastReadAt: progress.lastReadAt?.toISOString() ?? null,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

export async function getUserLibraryBookReadingContent(
  userId: string,
  userBookId: string,
): Promise<ReadingContentData> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Library entry not found.");
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
          title: true,
          author: true,
          language: true,
          pageCount: true,
          processingStatus: true,
          chapters: {
            orderBy: {
              chapterIndex: "asc",
            },
            select: {
              id: true,
              title: true,
              chapterIndex: true,
              pageStart: true,
              pageEnd: true,
            },
          },
          pages: {
            where: {
              extractionStatus: PageExtractionStatus.EXTRACTED,
            },
            orderBy: {
              pageNumber: "asc",
            },
            select: {
              id: true,
              chapterId: true,
              pageNumber: true,
              text: true,
            },
          },
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  if (userBook.book.processingStatus !== BookProcessingStatus.READY) {
    throw conflict(getReaderStatusConflictMessage(userBook.book.processingStatus));
  }

  const chapters: ReadingContentChapter[] = userBook.book.chapters.map((chapter) => ({
    ...serializeReaderChapter(chapter),
    pages: [],
  }));
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const unassignedPages: ReadingContentPage[] = [];

  for (const page of userBook.book.pages) {
    const serializedPage: ReadingContentPage = {
      id: page.id,
      pageNumber: page.pageNumber,
      text: page.text ?? "",
    };
    const explicitlyAssignedChapter = page.chapterId
      ? chaptersById.get(page.chapterId)
      : undefined;
    const rangeAssignedChapter = explicitlyAssignedChapter
      ? undefined
      : chapters.find((chapter, index) => {
          if (chapter.pageStart === null || page.pageNumber < chapter.pageStart) {
            return false;
          }

          const nextChapterStart = chapters[index + 1]?.pageStart;
          const effectivePageEnd =
            chapter.pageEnd ??
            (nextChapterStart === null || nextChapterStart === undefined
              ? userBook.book.pageCount
              : nextChapterStart - 1);

          return effectivePageEnd === null || page.pageNumber <= effectivePageEnd;
        });
    const chapter = explicitlyAssignedChapter ?? rangeAssignedChapter;

    if (chapter) {
      chapter.pages.push(serializedPage);
    } else {
      unassignedPages.push(serializedPage);
    }
  }

  return {
    book: {
      userBookId: userBook.id,
      bookId: userBook.book.id,
      title: userBook.book.title,
      author: userBook.book.author,
      language: userBook.book.language,
      pageCount: userBook.book.pageCount,
    },
    chapters,
    unassignedPages,
  };
}

export async function updateUserLibraryBookMetadata(
  userId: string,
  userBookId: string,
  dto: UpdateBookMetadataDto,
): Promise<LibraryBook> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      bookId: true,
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  const updatedUserBook = await prisma.$transaction(async (transaction) => {
    await transaction.book.update({
      where: {
        id: userBook.bookId,
      },
      data: dto,
    });

    return transaction.userBook.findFirst({
      where: {
        id: userBookId,
        userId,
      },
      include: {
        readingProgress: {
          select: {
            currentPage: true,
            progressPercent: true,
          },
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            language: true,
            filePath: true,
            processingStatus: true,
            processingError: true,
            pageCount: true,
            coverPath: true,
          },
        },
      },
    });
  });

  if (!updatedUserBook) {
    throw notFound("Library entry not found.");
  }

  return serializeLibraryBook(updatedUserBook);
}

export async function uploadPdfBook(input: UploadPdfBookInput): Promise<UploadedLibraryBook> {
  const bookId = randomUUID();
  const fileHash = hashFile(input.file.buffer);
  const title = input.title?.trim() || getTitleFromFilename(input.file.originalName);
  const author = input.author?.trim() || null;
  const language = input.language?.trim() || "en";
  const existingUserBook = await prisma.userBook.findFirst({
    where: {
      userId: input.userId,
      book: {
        fileHash,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingUserBook) {
    throw conflict("This book is already in your library.");
  }

  const { absolutePath, relativePath } = buildPdfStoragePath(bookId);
  let fileWritten = false;
  let coverPath: string | null = null;

  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.file.buffer, { flag: "wx" });
    fileWritten = true;

    try {
      coverPath = await generatePdfCoverThumbnail(bookId, input.file.buffer);
    } catch (error) {
      console.warn(`Failed to generate cover thumbnail for book ${bookId}.`, error);
    }

    const userBook = await prisma.$transaction(async (transaction) => {
      const book = await transaction.book.create({
        data: {
          id: bookId,
          title,
          author,
          language,
          sourceType: BookSourceType.UPLOAD,
          filePath: relativePath,
          coverPath,
          fileHash,
          mimeType: "application/pdf",
          pageCount: null,
          processingStatus: BookProcessingStatus.UPLOADED,
          processingError: null,
          createdByUserId: input.userId,
        },
      });

      return transaction.userBook.create({
        data: {
          userId: input.userId,
          bookId: book.id,
          status: UserBookStatus.ACTIVE,
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              language: true,
              filePath: true,
              processingStatus: true,
              processingError: true,
              pageCount: true,
              coverPath: true,
            },
          },
        },
      });
    });

    return serializeUploadedLibraryBook(userBook);
  } catch (error) {
    if (fileWritten) {
      await unlink(absolutePath).catch(() => undefined);
    }

    if (coverPath) {
      await unlink(resolveUploadPath(coverPath)).catch(() => undefined);
    }

    throw error;
  }
}

export async function getUserLibraryBookCover(
  userId: string,
  userBookId: string,
): Promise<BookCoverFile> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Book cover not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    include: {
      book: {
        select: {
          id: true,
          filePath: true,
          coverPath: true,
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Book cover not found.");
  }

  const coverPath =
    userBook.book.coverPath ??
    (await tryGenerateMissingCover({
      id: userBook.book.id,
      filePath: userBook.book.filePath,
    }));

  if (!coverPath) {
    throw notFound("Book cover not found.");
  }

  const absolutePath = resolveUploadPath(coverPath);

  try {
    return {
      buffer: await readFile(absolutePath),
      contentType: "image/webp",
    };
  } catch {
    throw notFound("Book cover not found.");
  }
}

export async function getUserLibraryBookPdf(
  userId: string,
  userBookId: string,
): Promise<BookPdfFile> {
  if (!uuidPattern.test(userBookId)) {
    throw notFound("Book PDF not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      book: {
        select: {
          filePath: true,
          processingStatus: true,
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Book PDF not found.");
  }

  if (userBook.book.processingStatus !== BookProcessingStatus.READY) {
    throw conflict(getReaderStatusConflictMessage(userBook.book.processingStatus));
  }

  let absolutePath: string;

  try {
    absolutePath = resolveUploadPath(userBook.book.filePath);
  } catch {
    throw notFound("Book PDF not found.");
  }

  const fileStats = await stat(absolutePath).catch(() => null);

  if (!fileStats?.isFile()) {
    throw notFound("Book PDF not found.");
  }

  return {
    absolutePath,
    sizeBytes: fileStats.size,
  };
}
