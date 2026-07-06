export type LibraryBook = {
  id: string;
  bookId: string;
  title: string;
  author: string | null;
  language: string;
  status: string;
  processingStatus: string;
  pageCount: number | null;
  addedAt: string;
  lastOpenedAt: string | null;
};

export type UploadedLibraryBook = Omit<LibraryBook, "id"> & {
  userBookId: string;
};
