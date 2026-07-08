import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BookProcessingStatus,
  ChapterDetectedMethod,
  PageExtractionStatus,
} from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db/prisma";
import { badRequest, conflict, HttpError, notFound } from "../http/errors";
import { detectChaptersFromPages, type DetectedChapter } from "./chapter-detector";
import {
  chunkingVersion,
  generateBookChunksFromPages,
  type GeneratedBookChunk,
} from "./chunker";
import { extractTextFromPdf, type ExtractedPdfText } from "./pdf-text";
import {
  canMoveToStatus,
  canStartProcessing,
  getStartProcessingConflictMessage,
  serializeProcessingStatus,
} from "./processing.status";
import type {
  OwnedProcessingBook,
  ChapterDetectionResult,
  ChunkGenerationResult,
  ProcessingStatusBook,
  StartProcessingResult,
} from "./processing.types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const defaultPublicProcessingError = "This PDF could not be processed.";
const unsupportedTextPdfMessage =
  "This PDF does not contain selectable text. OCR support will be added later.";
const missingPdfFileMessage = "The uploaded PDF file could not be found.";
const missingExtractedPagesMessage = "Extract PDF text before detecting chapters.";
const missingChunkingPagesMessage = "This book has no extracted text to prepare.";
const chapterDetectionErrorMessage = "Sophia could not detect chapters for this book.";
const chunkGenerationErrorMessage = "This book could not be prepared for reading.";
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

function serializeChapterDetectionResult(
  userBook: OwnedProcessingBook,
  chapterCount: number,
): ChapterDetectionResult["book"] {
  return {
    ...serializeProcessingBook(userBook),
    chapterCount,
  };
}

function serializeChunkGenerationResult(
  userBook: OwnedProcessingBook,
  chapterCount: number,
  chunkCount: number,
): ChunkGenerationResult["book"] {
  return {
    ...serializeChapterDetectionResult(userBook, chapterCount),
    chunkCount,
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

async function countBookChapters(bookId: string): Promise<number> {
  return prisma.chapter.count({
    where: {
      bookId,
    },
  });
}

async function loadExtractedPages(bookId: string): Promise<
  {
    id: string;
    pageNumber: number;
    text: string | null;
    chapterId: string | null;
  }[]
> {
  return prisma.page.findMany({
    where: {
      bookId,
      extractionStatus: PageExtractionStatus.EXTRACTED,
    },
    orderBy: {
      pageNumber: "asc",
    },
    select: {
      id: true,
      pageNumber: true,
      text: true,
      chapterId: true,
    },
  });
}

async function replaceHeuristicChapters(
  bookId: string,
  chapters: DetectedChapter[],
): Promise<number> {
  return prisma.$transaction(async (transaction) => {
    const existingHeuristicChapters = await transaction.chapter.findMany({
      where: {
        bookId,
        detectedMethod: ChapterDetectedMethod.HEURISTIC,
      },
      select: {
        id: true,
      },
    });
    const existingHeuristicChapterIds = existingHeuristicChapters.map((chapter) => chapter.id);

    if (existingHeuristicChapterIds.length > 0) {
      await transaction.page.updateMany({
        where: {
          bookId,
          chapterId: {
            in: existingHeuristicChapterIds,
          },
        },
        data: {
          chapterId: null,
        },
      });

      await transaction.chapter.deleteMany({
        where: {
          id: {
            in: existingHeuristicChapterIds,
          },
        },
      });
    }

    if (chapters.length === 0) {
      return 0;
    }

    const createdChapters = [];

    for (const chapter of chapters) {
      const createdChapter = await transaction.chapter.create({
        data: {
          bookId,
          title: chapter.title,
          chapterIndex: chapter.chapterIndex,
          pageStart: chapter.pageStart,
          pageEnd: chapter.pageEnd,
          startOffset: chapter.startOffset,
          endOffset: chapter.endOffset,
          detectedMethod: ChapterDetectedMethod.HEURISTIC,
        },
        select: {
          id: true,
          pageStart: true,
          pageEnd: true,
        },
      });

      createdChapters.push(createdChapter);
    }

    for (const chapter of createdChapters) {
      if (!chapter.pageStart || !chapter.pageEnd) {
        continue;
      }

      await transaction.page.updateMany({
        where: {
          bookId,
          pageNumber: {
            gte: chapter.pageStart,
            lte: chapter.pageEnd,
          },
        },
        data: {
          chapterId: chapter.id,
        },
      });
    }

    return createdChapters.length;
  });
}

async function replaceBookChunks(
  bookId: string,
  chunks: GeneratedBookChunk[],
): Promise<number> {
  return prisma.$transaction(async (transaction) => {
    await transaction.bookChunk.deleteMany({
      where: {
        bookId,
        chunkingVersion,
      },
    });

    for (const chunk of chunks) {
      await transaction.bookChunk.create({
        data: {
          bookId,
          chapterId: chunk.chapterId,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          textHash: hashText(chunk.content),
          chunkingVersion,
          metadata: chunk.metadata,
        },
      });
    }

    return chunks.length;
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

async function markChunkGenerationFailed(
  bookId: string,
  currentStatus: BookProcessingStatus,
  errorMessage: string,
): Promise<void> {
  if (currentStatus === BookProcessingStatus.READY) {
    await prisma.book.update({
      where: {
        id: bookId,
      },
      data: {
        processingStatus: BookProcessingStatus.FAILED,
        processingError: sanitizeProcessingErrorMessage(errorMessage),
      },
    });
    return;
  }

  await markProcessingFailed(bookId, currentStatus, errorMessage);
}

export async function detectChaptersForBook(
  userId: string,
  userBookId: string,
): Promise<ChapterDetectionResult> {
  const userBook = await findOwnedProcessingBook(userId, userBookId);

  if (userBook.book.processingStatus === BookProcessingStatus.EXTRACTING_TEXT) {
    throw conflict("This book is already being processed.");
  }

  if (userBook.book.processingStatus === BookProcessingStatus.READY) {
    throw conflict("This book is already ready to read.");
  }

  if (userBook.book.processingStatus !== BookProcessingStatus.CHUNKING) {
    throw badRequest(missingExtractedPagesMessage);
  }

  const pages = await loadExtractedPages(userBook.book.id);

  if (pages.length === 0) {
    throw badRequest(missingExtractedPagesMessage);
  }

  try {
    const detectedChapters = detectChaptersFromPages(pages);
    const chapterCount = await replaceHeuristicChapters(userBook.book.id, detectedChapters);

    await prisma.book.update({
      where: {
        id: userBook.book.id,
      },
      data: {
        processingError: null,
      },
    });

    const responseBook = serializeChapterDetectionResult(
      {
        ...userBook,
        book: {
          ...userBook.book,
          processingError: null,
        },
      },
      chapterCount,
    );

    return {
      book: responseBook,
      message:
        chapterCount > 0
          ? "Chapter detection completed."
          : "No chapter headings were detected.",
    };
  } catch (error) {
    await markProcessingFailed(
      userBook.book.id,
      BookProcessingStatus.CHUNKING,
      chapterDetectionErrorMessage,
    ).catch(() => undefined);

    if (error instanceof HttpError) {
      throw error;
    }

    console.warn(`Failed to detect chapters for book ${userBook.book.id}.`, error);
    throw badRequest(chapterDetectionErrorMessage);
  }
}

export async function generateChunksForBook(
  userId: string,
  userBookId: string,
): Promise<ChunkGenerationResult> {
  const userBook = await findOwnedProcessingBook(userId, userBookId);

  if (userBook.book.processingStatus === BookProcessingStatus.EXTRACTING_TEXT) {
    throw conflict("This book is already being processed.");
  }

  if (
    userBook.book.processingStatus !== BookProcessingStatus.CHUNKING &&
    userBook.book.processingStatus !== BookProcessingStatus.READY
  ) {
    throw badRequest(missingChunkingPagesMessage);
  }

  const pages = await loadExtractedPages(userBook.book.id);

  if (pages.length === 0 || pages.every((page) => !page.text?.trim())) {
    await markChunkGenerationFailed(
      userBook.book.id,
      userBook.book.processingStatus,
      missingChunkingPagesMessage,
    ).catch(() => undefined);
    throw badRequest(missingChunkingPagesMessage);
  }

  try {
    const chunks = generateBookChunksFromPages(pages);

    if (chunks.length === 0) {
      await markChunkGenerationFailed(
        userBook.book.id,
        userBook.book.processingStatus,
        missingChunkingPagesMessage,
      );
      throw badRequest(missingChunkingPagesMessage);
    }

    const chunkCount = await replaceBookChunks(userBook.book.id, chunks);
    if (userBook.book.processingStatus === BookProcessingStatus.CHUNKING) {
      const movedToReady = await updateProcessingStatus(
        userBook.book.id,
        BookProcessingStatus.CHUNKING,
        BookProcessingStatus.READY,
      );

      if (!movedToReady) {
        throw conflict("This book is no longer ready for chunking.");
      }
    } else {
      await prisma.book.update({
        where: {
          id: userBook.book.id,
        },
        data: {
          processingError: null,
        },
      });
    }

    const chapterCount = await countBookChapters(userBook.book.id);
    const responseBook = serializeChunkGenerationResult(
      {
        ...userBook,
        book: {
          ...userBook.book,
          processingStatus: BookProcessingStatus.READY,
          processingError: null,
        },
      },
      chapterCount,
      chunkCount,
    );

    return {
      book: responseBook,
      message: "Book chunks generated.",
    };
  } catch (error) {
    await markChunkGenerationFailed(
      userBook.book.id,
      userBook.book.processingStatus,
      chunkGenerationErrorMessage,
    ).catch(() => undefined);

    if (error instanceof HttpError) {
      throw error;
    }

    console.warn(`Failed to generate chunks for book ${userBook.book.id}.`, error);
    throw badRequest(chunkGenerationErrorMessage);
  }
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
