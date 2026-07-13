import type { ReaderChapter, ReaderDataResponse } from '../../books'

export type { ReaderChapter, ReaderDataResponse }

export type ReaderState =
  | { status: 'loading' }
  | { status: 'ready'; data: ReaderDataResponse }
  | { status: 'not-ready'; message: string }
  | { status: 'error'; message: string }
