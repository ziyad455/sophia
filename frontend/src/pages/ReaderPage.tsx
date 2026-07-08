import { useEffect, useState } from 'react'
import { BooksApiError, getReaderData, type ReaderDataResponse } from '../books'
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

function formatChapterTitle(chapter: ReaderDataResponse['chapters'][number]): string {
  return chapter.title?.trim() || `Chapter ${chapter.chapterIndex}`
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

  return (
    <main className="min-h-svh bg-sophia-bg text-sophia-text">
      <div className="mx-auto grid min-h-svh w-full max-w-[1120px] grid-rows-[auto_1fr] gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-sophia-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
              Sophia Reader
            </p>
            <h1 className="m-0 text-3xl leading-tight font-semibold tracking-normal text-sophia-text sm:text-4xl">
              Reading room
            </h1>
          </div>
          <button
            className="min-h-10 rounded-lg border border-sophia-border px-4 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            type="button"
            onClick={goToLibrary}
          >
            Library
          </button>
        </header>

        {readerState.status === 'loading' ? (
          <section className="grid min-h-[520px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center">
            <div className="grid justify-items-center gap-4">
              <span
                className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                aria-hidden="true"
              />
              <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                Opening this book...
              </p>
            </div>
          </section>
        ) : null}

        {readerState.status === 'error' || readerState.status === 'not-ready' ? (
          <section className="grid min-h-[520px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center">
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
                className="min-h-11 rounded-lg bg-sophia-primary px-5 text-sm font-bold text-sophia-bg"
                type="button"
                onClick={goToLibrary}
              >
                Return to library
              </button>
            </div>
          </section>
        ) : null}

        {readerState.status === 'ready' ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <article className="grid min-h-[560px] content-start gap-7 rounded-lg border border-sophia-border bg-sophia-surface p-6 sm:p-8">
              <div className="grid gap-3">
                <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
                  Ready to read
                </p>
                <div className="grid gap-2">
                  <h2 className="m-0 text-3xl leading-tight font-semibold tracking-normal text-sophia-text sm:text-4xl">
                    {readerState.data.book.title}
                  </h2>
                  <p className="m-0 text-base text-sophia-text-muted">
                    {readerState.data.book.author ?? 'Unknown author'}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-sm text-sophia-text-muted sm:grid-cols-3">
                <div className="rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3">
                  <dt className="font-semibold text-sophia-text">Pages</dt>
                  <dd className="m-0 mt-1">{formatPageCount(readerState.data.book.pageCount)}</dd>
                </div>
                <div className="rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3">
                  <dt className="font-semibold text-sophia-text">Current page</dt>
                  <dd className="m-0 mt-1">Page {readerState.data.book.currentPage}</dd>
                </div>
                <div className="rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3">
                  <dt className="font-semibold text-sophia-text">Language</dt>
                  <dd className="m-0 mt-1">{readerState.data.book.language.toUpperCase()}</dd>
                </div>
              </dl>

              <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-sophia-border bg-sophia-bg px-5 text-center">
                <div className="grid max-w-[420px] gap-3">
                  <h3 className="m-0 text-xl font-semibold tracking-normal text-sophia-text">
                    Reader is ready.
                  </h3>
                  <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                    PDF viewer integration comes next.
                  </p>
                  {/* TODO: Extend UI PDF Viewer will be integrated in S5-T2. */}
                </div>
              </div>
            </article>

            <aside className="grid content-start gap-4 rounded-lg border border-sophia-border bg-sophia-surface p-5">
              <div className="grid gap-1">
                <h2 className="m-0 text-lg font-semibold tracking-normal text-sophia-text">
                  Chapters
                </h2>
                <p className="m-0 text-sm text-sophia-text-muted">
                  {readerState.data.chapters.length
                    ? `${readerState.data.chapters.length} detected`
                    : 'No chapters detected yet.'}
                </p>
              </div>

              {readerState.data.chapters.length ? (
                <ol className="m-0 grid list-none gap-2 p-0">
                  {readerState.data.chapters.map((chapter) => (
                    <li
                      className="rounded-lg border border-sophia-border bg-sophia-bg px-3 py-3 text-sm"
                      key={chapter.id}
                    >
                      <p className="m-0 font-semibold text-sophia-text">
                        {formatChapterTitle(chapter)}
                      </p>
                      <p className="m-0 mt-1 text-xs text-sophia-text-muted">
                        {chapter.pageStart
                          ? `Starts on page ${chapter.pageStart}`
                          : 'Page range unavailable'}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  )
}
