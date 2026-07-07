import { BookProcessingStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { conflict, notFound } from "../http/errors";
import {
  canMoveToStatus,
  canStartProcessing,
  getStartProcessingConflictMessage,
  serializeProcessingStatus,
} from "./processing.status";
import type {
  OwnedProcessingBook,
  ProcessingStatusBook,
  StartProcessingResult,
} from "./processing.types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const defaultPublicProcessingError = "This PDF could not be processed.";
const maxPublicProcessingErrorLength = 300;

function sanitizeProcessingErrorMessage(errorMessage: string | undefined): string {
  const message = errorMessage
    ?.replace(/[A-Za-z]:\\[^\s]+|\/[^\s]+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim();

  if (!message) {
    return defaultPublicProcessingError;
  }

  return message.slice(0, maxPublicProcessingErrorLength);
}

function serializeProcessingBook(userBook: OwnedProcessingBook): ProcessingStatusBook {
  return {
    userBookId: userBook.id,
    bookId: userBook.book.id,
    processingStatus: serializeProcessingStatus(userBook.book.processingStatus),
    processingError: userBook.book.processingError,
    pageCount: userBook.book.pageCount,
  };
}

async function findOwnedProcessingBook(
  userId: string,
  userBookId: string,
): Promise<OwnedProcessingBook> {
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
          processingStatus: true,
          processingError: true,
          pageCount: true,
        },
      },
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  return userBook;
}

export async function getBookProcessingStatus(
  userId: string,
  userBookId: string,
): Promise<ProcessingStatusBook> {
  return serializeProcessingBook(await findOwnedProcessingBook(userId, userBookId));
}

export async function updateProcessingStatus(
  bookId: string,
  currentStatus: BookProcessingStatus,
  nextStatus: BookProcessingStatus,
): Promise<boolean> {
  if (!canMoveToStatus(currentStatus, nextStatus)) {
    throw conflict("This book cannot move to the requested processing status.");
  }

  const result = await prisma.book.updateMany({
    where: {
      id: bookId,
      processingStatus: currentStatus,
    },
    data: {
      processingStatus: nextStatus,
      processingError: nextStatus === BookProcessingStatus.FAILED ? undefined : null,
    },
  });

  return result.count === 1;
}

export async function markProcessingFailed(
  bookId: string,
  currentStatus: BookProcessingStatus,
  errorMessage?: string,
): Promise<boolean> {
  if (!canMoveToStatus(currentStatus, BookProcessingStatus.FAILED)) {
    throw conflict("This book cannot be marked failed from its current status.");
  }

  const result = await prisma.book.updateMany({
    where: {
      id: bookId,
      processingStatus: currentStatus,
    },
    data: {
      processingStatus: BookProcessingStatus.FAILED,
      processingError: sanitizeProcessingErrorMessage(errorMessage),
    },
  });

  return result.count === 1;
}

export async function startBookProcessing(
  userId: string,
  userBookId: string,
): Promise<StartProcessingResult> {
  const userBook = await findOwnedProcessingBook(userId, userBookId);

  if (!canStartProcessing(userBook.book.processingStatus)) {
    throw conflict(getStartProcessingConflictMessage(userBook.book.processingStatus));
  }

  const statusUpdated = await updateProcessingStatus(
    userBook.book.id,
    userBook.book.processingStatus,
    BookProcessingStatus.EXTRACTING_TEXT,
  );

  if (!statusUpdated) {
    const currentUserBook = await findOwnedProcessingBook(userId, userBookId);

    throw conflict(getStartProcessingConflictMessage(currentUserBook.book.processingStatus));
  }

  return {
    book: serializeProcessingBook({
      ...userBook,
      book: {
        ...userBook.book,
        processingStatus: BookProcessingStatus.EXTRACTING_TEXT,
        processingError: null,
      },
    }),
    message: "Book processing has started.",
  };
}
