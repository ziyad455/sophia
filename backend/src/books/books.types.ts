export type LibraryBook = {
  userBookId: string;
  bookId: string;
  title: string;
  author: string | null;
  language: string;
  status: string;
  processingStatus: string;
  processingError: string | null;
  pageCount: number | null;
  addedAt: string;
  lastOpenedAt: string | null;
  currentPage: number;
  progressPercent: number;
  coverUrl: string | null;
};

export type UploadedLibraryBook = LibraryBook;

export type ReaderChapter = {
  id: string;
  title: string | null;
  chapterIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
};

export type ReaderBook = {
  userBookId: string;
  bookId: string;
  title: string;
  author: string | null;
  language: string;
  processingStatus: string;
  pageCount: number | null;
  currentPage: number;
  currentChapter: ReaderChapter | null;
  pdfUrl: string;
};

export type ReaderData = {
  book: ReaderBook;
  chapters: ReaderChapter[];
};

export type ReadingContentPage = {
  id: string;
  pageNumber: number;
  text: string;
};

export type ReadingContentChapter = ReaderChapter & {
  pages: ReadingContentPage[];
};

export type ReadingContentData = {
  book: {
    userBookId: string;
    bookId: string;
    title: string;
    author: string | null;
    language: string;
    pageCount: number | null;
  };
  chapters: ReadingContentChapter[];
  unassignedPages: ReadingContentPage[];
};

export type ReadingProgressData = {
  userBookId: string;
  currentPage: number;
  currentChapterId: string | null;
  progressPercent: number;
  lastReadAt: string | null;
  updatedAt: string | null;
};
