import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BookProcessingStatus, PageExtractionStatus } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db/prisma";
import { badRequest, conflict, HttpError, notFound } from "../http/errors";
import { extractTextFromPdf, type ExtractedPdfText } from "./pdf-text";
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
const unsupportedTextPdfMessage =
  "This PDF does not contain selectable text. OCR support will be added later.";
const missingPdfFileMessage = "The uploaded PDF file could not be found.";
const maxPublicProcessingErrorLength = 300;
const minTotalTextCharacters = 20;
const minAverageTextCharactersPerPage = 5;
const minTextPageRatio = 0.15;

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

function resolveUploadPath(relativePath: string): string {
  const uploadRoot = path.resolve(config.upload.uploadDir);
  const absolutePath = path.resolve(uploadRoot, relativePath);

  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw notFound("Library entry not found.");
  }

  return absolutePath;
}

async function readBookPdf(filePath: string): Promise<Buffer> {
  try {
    return await readFile(resolveUploadPath(filePath));
  } catch {
    throw badRequest(missingPdfFileMessage);
  }
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function hasEnoughSelectableText(extraction: ExtractedPdfText): boolean {
  if (extraction.pageCount < 1) {
    return false;
  }

  const averageCharactersPerPage = extraction.totalTextCharacters / extraction.pageCount;
  const nonEmptyPageRatio = extraction.nonEmptyPageCount / extraction.pageCount;
  const failedPageRatio = extraction.failedPageCount / extraction.pageCount;

  if (extraction.totalTextCharacters < minTotalTextCharacters) {
    return false;
  }

  if (averageCharactersPerPage < minAverageTextCharactersPerPage) {
    return false;
  }

  if (extraction.pageCount >= 5 && nonEmptyPageRatio < minTextPageRatio) {
    return false;
  }

  return failedPageRatio < 1;
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
          filePath: true,
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

async function storeExtractedPages(
  bookId: string,
  extraction: ExtractedPdfText,
  options: { forceFailed?: boolean } = {},
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const page of extraction.pages) {
      const extractionSucceeded = page.extractionSucceeded && !options.forceFailed;
      const textHash = extractionSucceeded ? hashText(page.text) : null;
      const extractionStatus = extractionSucceeded
        ? PageExtractionStatus.EXTRACTED
        : PageExtractionStatus.FAILED;

      await transaction.page.upsert({
        where: {
          bookId_pageNumber: {
            bookId,
            pageNumber: page.pageNumber,
          },
        },
        create: {
          bookId,
          chapterId: null,
          pageNumber: page.pageNumber,
          text: page.text,
          textHash,
          extractionStatus,
        },
        update: {
          chapterId: null,
          text: page.text,
          textHash,
          extractionStatus,
        },
      });
    }

    await transaction.book.update({
      where: {
        id: bookId,
      },
      data: {
        pageCount: extraction.pageCount,
      },
    });
  });
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

  try {
    const pdfBuffer = await readBookPdf(userBook.book.filePath);
    const extraction = await extractTextFromPdf(pdfBuffer);

    if (!hasEnoughSelectableText(extraction)) {
      await storeExtractedPages(userBook.book.id, extraction, { forceFailed: true });
      await markProcessingFailed(
        userBook.book.id,
        BookProcessingStatus.EXTRACTING_TEXT,
        unsupportedTextPdfMessage,
      );

      throw badRequest(unsupportedTextPdfMessage);
    }

    await storeExtractedPages(userBook.book.id, extraction);

    const movedToChunking = await updateProcessingStatus(
      userBook.book.id,
      BookProcessingStatus.EXTRACTING_TEXT,
      BookProcessingStatus.CHUNKING,
    );

    if (!movedToChunking) {
      throw conflict("This book is no longer extracting text.");
    }

    return {
      book: serializeProcessingBook({
        ...userBook,
        book: {
          ...userBook.book,
          processingStatus: BookProcessingStatus.CHUNKING,
          processingError: null,
          pageCount: extraction.pageCount,
        },
      }),
      message: "PDF text extraction completed.",
    };
  } catch (error) {
    const publicMessage = error instanceof HttpError ? error.message : defaultPublicProcessingError;

    await markProcessingFailed(
      userBook.book.id,
      BookProcessingStatus.EXTRACTING_TEXT,
      publicMessage,
    ).catch(() => undefined);

    if (error instanceof HttpError) {
      throw error;
    }

    console.warn(`Failed to extract PDF text for book ${userBook.book.id}.`, error);
    throw badRequest(defaultPublicProcessingError);
  }
}
