import type { BookProcessingStatus } from "@prisma/client";

export type ProcessingStatusBook = {
  userBookId: string;
  bookId: string;
  processingStatus: string;
  processingError: string | null;
  pageCount: number | null;
};

export type OwnedProcessingBook = {
  id: string;
  book: {
    id: string;
    filePath: string;
    processingStatus: BookProcessingStatus;
    processingError: string | null;
    pageCount: number | null;
  };
};

export type StartProcessingResult = {
  book: ProcessingStatusBook;
  message: string;
};

export type ChapterDetectionBook = ProcessingStatusBook & {
  chapterCount: number;
};

export type ChapterDetectionResult = {
  book: ChapterDetectionBook;
  message: string;
};

export type ChunkGenerationBook = ChapterDetectionBook & {
  chunkCount: number;
};

export type ChunkGenerationResult = {
  book: ChunkGenerationBook;
  message: string;
};
