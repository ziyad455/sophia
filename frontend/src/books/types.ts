export type LibraryBook = {
  id?: string
  userBookId: string
  bookId: string
  title: string
  author: string | null
  language: string
  status: string
  processingStatus: string
  processingError: string | null
  pageCount: number | null
  addedAt: string
  lastOpenedAt: string | null
  currentPage: number
  progressPercent: number
  coverUrl: string | null
}

export type UploadedLibraryBook = LibraryBook

export type UploadBookPayload = {
  file: File
  title?: string
  author?: string
  language?: string
}

export type UploadBookResponse = {
  book: UploadedLibraryBook
}

export type ListBooksResponse = {
  books: LibraryBook[]
}

export type UpdateBookMetadataPayload = {
  title?: string
  author?: string | null
  language?: string
}

export type UpdateBookMetadataResponse = {
  book: LibraryBook
}

export type ReaderChapter = {
  id: string
  title: string | null
  chapterIndex: number
  pageStart: number | null
  pageEnd: number | null
}

export type ReaderBook = {
  userBookId: string
  bookId: string
  title: string
  author: string | null
  language: string
  processingStatus: string
  pageCount: number | null
  currentPage: number
  currentChapter: ReaderChapter | null
  pdfUrl: string
}

export type ReaderDataResponse = {
  book: ReaderBook
  chapters: ReaderChapter[]
}

export type ReadingContentPage = {
  pageNumber: number
  text: string
}

export type ReadingContentChapter = ReaderChapter & {
  pages: ReadingContentPage[]
}

export type ReadingContentResponse = {
  book: {
    userBookId: string
    bookId: string
    title: string
    author: string | null
    language: string
    pageCount: number | null
  }
  chapters: ReadingContentChapter[]
  unassignedPages: ReadingContentPage[]
}

export type ReadingProgress = {
  userBookId: string
  currentPage: number
  currentChapterId: string | null
  progressPercent: number
  lastReadAt: string | null
  updatedAt: string | null
}

export type ReadingProgressResponse = {
  progress: ReadingProgress
}

export type UpdateReadingProgressPayload = {
  currentPage?: number
  currentChapterId?: string | null
  progressPercent?: number
}

export type ProcessingStatusBook = {
  userBookId: string
  bookId: string
  processingStatus: string
  processingError: string | null
  pageCount: number | null
  chapterCount?: number
  chunkCount?: number
}

export type ProcessingStatusResponse = {
  book: ProcessingStatusBook
  message?: string
}
