export type UploadedLibraryBook = {
  userBookId: string
  bookId: string
  title: string
  author: string | null
  language: string
  status: string
  processingStatus: string
  pageCount: number | null
  addedAt: string
  lastOpenedAt: string | null
}

export type UploadBookPayload = {
  file: File
  title?: string
  author?: string
  language?: string
}

export type UploadBookResponse = {
  book: UploadedLibraryBook
}
