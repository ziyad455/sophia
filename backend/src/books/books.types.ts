export type LibraryBook = {
  userBookId: string;
  bookId: string;
  title: string;
  author: string | null;
  language: string;
  status: string;
  processingStatus: string;
  pageCount: number | null;
  addedAt: string;
  lastOpenedAt: string | null;
  coverUrl: string | null;
};

export type UploadedLibraryBook = LibraryBook;
