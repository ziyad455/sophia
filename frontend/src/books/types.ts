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
