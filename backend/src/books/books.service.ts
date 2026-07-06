import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BookProcessingStatus, BookSourceType, UserBookStatus } from "@prisma/client";
import type { Book, UserBook } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db/prisma";
import { conflict, notFound } from "../http/errors";
import type { LibraryBook, UploadedLibraryBook } from "./books.types";
import type { UploadedPdfFile } from "./upload";

type UserBookWithBook = UserBook & {
  book: Pick<Book, "id" | "title" | "author" | "language" | "processingStatus" | "pageCount">;
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
    id: userBook.id,
    bookId: userBook.book.id,
    title: userBook.book.title,
    author: userBook.book.author,
    language: userBook.book.language,
    status: serializeStatus(userBook.status),
    processingStatus: serializeStatus(userBook.book.processingStatus),
    pageCount: userBook.book.pageCount,
    addedAt: userBook.addedAt.toISOString(),
    lastOpenedAt: userBook.lastOpenedAt?.toISOString() ?? null,
  };
}

function serializeUploadedLibraryBook(userBook: UserBookWithBook): UploadedLibraryBook {
  const book = serializeLibraryBook(userBook);

  return {
    userBookId: book.id,
    bookId: book.bookId,
    title: book.title,
    author: book.author,
    language: book.language,
    status: book.status,
    processingStatus: book.processingStatus,
    pageCount: book.pageCount,
    addedAt: book.addedAt,
    lastOpenedAt: book.lastOpenedAt,
  };
}

function getTitleFromFilename(filename: string): string {
  const parsedName = path.basename(filename, path.extname(filename)).trim();

  return parsedName || "Untitled PDF";
}

function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function buildStoragePath(userId: string, bookId: string): {
  absolutePath: string;
  relativePath: string;
} {
  const relativePath = path.join("books", userId, `${bookId}.pdf`);

  return {
    relativePath,
    absolutePath: path.join(config.upload.uploadDir, relativePath),
  };
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
          processingStatus: true,
          pageCount: true,
        },
      },
    },
  });

  return userBooks.map(serializeLibraryBook);
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
          processingStatus: true,
          pageCount: true,
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  return serializeLibraryBook(userBook);
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

  const { absolutePath, relativePath } = buildStoragePath(input.userId, bookId);
  let fileWritten = false;

  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.file.buffer, { flag: "wx" });
    fileWritten = true;

    const userBook = await prisma.$transaction(async (transaction) => {
      const book = await transaction.book.create({
        data: {
          id: bookId,
          title,
          author,
          language,
          sourceType: BookSourceType.UPLOAD,
          filePath: relativePath,
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
              processingStatus: true,
              pageCount: true,
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

    throw error;
  }
}
