import type { Book, UserBook } from "@prisma/client";
import { prisma } from "../db/prisma";
import { notFound } from "../http/errors";
import type { LibraryBook } from "./books.types";

type UserBookWithBook = UserBook & {
  book: Pick<Book, "id" | "title" | "author" | "language" | "processingStatus" | "pageCount">;
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
