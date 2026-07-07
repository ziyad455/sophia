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
