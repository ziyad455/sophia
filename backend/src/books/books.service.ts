import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BookProcessingStatus, BookSourceType, UserBookStatus } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db/prisma";
import { conflict, notFound } from "../http/errors";
import type { LibraryBook, UploadedLibraryBook } from "./books.types";
import { generatePdfCoverThumbnail } from "./covers";
import type { UploadedPdfFile } from "./upload";

type UserBookWithBook = {
  id: string;
  status: UserBookStatus;
  addedAt: Date;
  lastOpenedAt: Date | null;
  book: {
    id: string;
    title: string;
    author: string | null;
    language: string;
    filePath: string;
    processingStatus: BookProcessingStatus;
    pageCount: number | null;
    coverPath: string | null;
  };
};

export type BookCoverFile = {
  buffer: Buffer;
  contentType: "image/webp";
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

function serializeLibraryBook(userBook: UserBookWithBook): LibraryBook {
  return {
    userBookId: userBook.id,
    bookId: userBook.book.id,
    title: userBook.book.title,
    author: userBook.book.author,
    language: userBook.book.language,
    status: serializeStatus(userBook.status),
    processingStatus: serializeStatus(userBook.book.processingStatus),
    pageCount: userBook.book.pageCount,
    addedAt: userBook.addedAt.toISOString(),
    lastOpenedAt: userBook.lastOpenedAt?.toISOString() ?? null,
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
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          language: true,
          filePath: true,
          processingStatus: true,
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
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          language: true,
          filePath: true,
          processingStatus: true,
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
