import { useEffect, useState } from 'react'
import {
  BooksApiError,
  getBookPdfUrl,
  getReaderData,
  type ReaderDataResponse,
} from '../books'
import { navigate } from '../routing/navigation'

type ReaderPageProps = {
  userBookId: string
}

type ReaderState =
  | { status: 'loading' }
  | { status: 'ready'; data: ReaderDataResponse }
  | { status: 'not-ready'; message: string }
  | { status: 'error'; message: string }

function createReaderLoginRedirect(userBookId: string): string {
  return `/login?redirectTo=${encodeURIComponent(`/reader/${userBookId}`)}`
}

function formatPageCount(pageCount: number | null): string {
  return pageCount ? `${pageCount} pages` : 'Page count unavailable'
}

function ReaderPdfViewer({ data }: { data: ReaderDataResponse }) {
  const [currentPage, setCurrentPage] = useState(data.book.currentPage)
  const pdfSrc = getBookPdfUrl(data.book.pdfUrl, data.book.currentPage)

  useEffect(() => {
    setCurrentPage(data.book.currentPage)
  }, [data.book.currentPage])

  return (
    <section className="grid h-[calc(100svh-190px)] min-h-[560px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-sophia-border bg-sophia-surface">
      <div className="flex flex-col gap-2 border-b border-sophia-border px-4 py-3 text-sm text-sophia-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 font-semibold text-sophia-text">
          Page {currentPage}
          {data.book.pageCount ? ` of ${data.book.pageCount}` : ''}
        </p>
        <p className="m-0">{formatPageCount(data.book.pageCount)}</p>
      </div>
      <iframe
        className="h-full min-h-0 w-full border-0 bg-white"
        key={pdfSrc}
        src={pdfSrc}
        title={data.book.title}
      />
    </section>
  )
}

export function ReaderPage({ userBookId }: ReaderPageProps) {
  const [readerState, setReaderState] = useState<ReaderState>({ status: 'loading' })

  useEffect(() => {
    let isMounted = true

    async function loadReader() {
      if (!userBookId) {
        setReaderState({
          status: 'error',
          message: 'We could not find this book in your library.',
        })
        return
      }

      setReaderState({ status: 'loading' })

      try {
        const data = await getReaderData(userBookId)

        if (isMounted) {
          setReaderState({ status: 'ready', data })
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (error instanceof BooksApiError && error.status === 401) {
          navigate(createReaderLoginRedirect(userBookId), { replace: true })
          return
        }

        if (error instanceof BooksApiError && error.status === 409) {
          setReaderState({
            status: 'not-ready',
            message: error.message,
          })
          return
        }

        setReaderState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'We could not open this book right now.',
        })
      }
    }

    void loadReader()

    return () => {
      isMounted = false
    }
  }, [userBookId])

  function goToLibrary() {
    navigate('/library')
  }

  const readyBook = readerState.status === 'ready' ? readerState.data.book : null

  return (
    <main className="min-h-svh bg-sophia-bg text-sophia-text">
      <div className="mx-auto grid min-h-svh w-full max-w-[1180px] grid-rows-[auto_1fr] gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-sophia-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
              Sophia Reader
            </p>
            <h1 className="m-0 text-3xl leading-tight font-semibold tracking-normal text-sophia-text sm:text-4xl">
              {readyBook?.title ?? 'Reading room'}
            </h1>
            {readyBook ? (
              <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                {readyBook.author ?? 'Unknown author'}
              </p>
            ) : null}
          </div>
          <button
            className="min-h-10 rounded-lg border border-sophia-border px-4 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            type="button"
            onClick={goToLibrary}
          >
            Back to library
          </button>
        </header>

        {readerState.status === 'loading' ? (
          <section className="grid min-h-[520px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center">
            <div className="grid justify-items-center gap-4" role="status">
              <span
                className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                aria-hidden="true"
              />
              <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                Opening your book...
              </p>
            </div>
          </section>
        ) : null}

        {readerState.status === 'error' || readerState.status === 'not-ready' ? (
          <section
            className="grid min-h-[520px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center"
            role="alert"
          >
            <div className="grid max-w-[460px] justify-items-center gap-4">
              <h2 className="m-0 text-2xl font-semibold tracking-normal text-sophia-text">
                {readerState.status === 'not-ready'
                  ? 'This book is not ready yet.'
                  : 'We could not open this book.'}
              </h2>
              <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                {readerState.message}
              </p>
              <button
                className="min-h-11 rounded-lg bg-sophia-primary px-5 text-sm font-bold text-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                type="button"
                onClick={goToLibrary}
              >
                Return to library
              </button>
            </div>
          </section>
        ) : null}

        {readerState.status === 'ready' ? <ReaderPdfViewer data={readerState.data} /> : null}
      </div>
    </main>
  )
}
