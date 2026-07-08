import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import {
  detectBookChapters,
  generateBookChunks,
  getBookProcessingStatus,
  listBooks,
  processBook,
  updateBookMetadata,
  type LibraryBook,
  type ProcessingStatusBook,
} from '../books'
import { config } from '../config'
import { navigate } from '../routing/navigation'
import { applyTheme, readStoredTheme, themes, type ThemeId } from '../theme'

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recently added'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatStatus(value: string): string {
  const normalized = value.replace(/_/g, ' ').trim()

  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Uploaded'
}

function getProcessingStatusContent(value: string): {
  label: string
  description: string
  dotClassName: string
} {
  switch (value) {
    case 'uploaded':
      return {
        label: 'Uploaded',
        description: 'Ready to prepare for focused reading.',
        dotClassName: 'bg-sophia-text-muted',
      }
    case 'extracting_text':
      return {
        label: 'Extracting text',
        description: 'Sophia is reading the pages.',
        dotClassName: 'bg-sophia-primary',
      }
    case 'chunking':
      return {
        label: 'Preparing structure',
        description: 'Sophia is organizing the book.',
        dotClassName: 'bg-sophia-primary',
      }
    case 'ready':
      return {
        label: 'Ready',
        description: 'Prepared for the reader.',
        dotClassName: 'bg-sophia-primary',
      }
    case 'failed':
      return {
        label: 'Needs attention',
        description: 'Processing failed before the book was ready.',
        dotClassName: 'bg-sophia-text-muted',
      }
    default:
      return {
        label: formatStatus(value),
        description: 'Sophia has recorded this book status.',
        dotClassName: 'bg-sophia-text-muted',
      }
  }
}

function getBookActionLabel(book: LibraryBook, processingPhase?: string): string {
  if (processingPhase) {
    return 'Preparing...'
  }

  switch (book.processingStatus) {
    case 'uploaded':
      return 'Prepare for Reading'
    case 'extracting_text':
      return 'Processing...'
    case 'chunking':
      return 'Preparing...'
    case 'ready':
      return 'Open'
    case 'failed':
      return 'Retry Processing'
    default:
      return 'Prepare for Reading'
  }
}

function canStartProcessing(book: LibraryBook, processingPhase?: string): boolean {
  if (processingPhase) {
    return false
  }

  return book.processingStatus === 'uploaded' || book.processingStatus === 'failed'
}

function getCoverImageUrl(coverUrl: string | null): string | null {
  if (!coverUrl) {
    return null
  }

  return `${config.apiBaseUrl}${coverUrl}`
}

function getFallbackInitial(title: string): string {
  const firstLetter = title.trim().match(/[a-zA-Z0-9]/)?.[0]

  return firstLetter?.toUpperCase() ?? 'S'
}

function BookCover({ book }: { book: LibraryBook }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = getCoverImageUrl(book.coverUrl)

  useEffect(() => {
    if (!imageUrl) {
      setImageSrc(null)
      setImageFailed(false)
      return undefined
    }

    const controller = new AbortController()
    let objectUrl: string | null = null

    setImageFailed(false)

    fetch(imageUrl, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Cover unavailable')
        }

        return response.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setImageSrc(objectUrl)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setImageSrc(null)
        setImageFailed(true)
      })

    return () => {
      controller.abort()

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [imageUrl])

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-sophia-border bg-sophia-bg shadow-[0_16px_28px_rgb(43_33_24_/_14%)]">
      {imageSrc && !imageFailed ? (
        <img
          className="h-full w-full object-cover"
          src={imageSrc}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="grid h-full place-items-center bg-[linear-gradient(145deg,var(--color-surface),var(--color-bg))] p-5 text-center">
          <div className="grid justify-items-center gap-4">
            <span
              className="grid h-16 w-16 place-items-center rounded-full border border-sophia-border bg-sophia-surface font-serif text-3xl text-sophia-primary"
              aria-hidden="true"
            >
              {getFallbackInitial(book.title)}
            </span>
            <div className="grid gap-1">
              <p className="m-0 line-clamp-3 font-serif text-lg leading-snug text-sophia-text">
                {book.title}
              </p>
              <p className="m-0 text-xs font-semibold tracking-[0.08em] text-sophia-text-muted uppercase">
                Sophia Library
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-y-0 left-0 w-3 bg-black/10" aria-hidden="true" />
    </div>
  )
}

function BookCard({
  book,
  onEdit,
  onPrepare,
  processingError,
  processingPhase,
}: {
  book: LibraryBook
  onEdit: (book: LibraryBook) => void
  onPrepare: (book: LibraryBook) => void
  processingError?: string
  processingPhase?: string
}) {
  const status = getProcessingStatusContent(book.processingStatus)
  const visibleError = processingError ?? (book.processingStatus === 'failed' ? book.processingError : null)
  const actionEnabled = canStartProcessing(book, processingPhase)
  const actionLabel = getBookActionLabel(book, processingPhase)

  return (
    <article className="grid min-w-0 gap-4">
      <BookCover book={book} />
      <div className="grid gap-2">
        <div className="grid gap-1">
          <h2 className="m-0 line-clamp-2 text-base leading-snug font-semibold tracking-normal text-sophia-text">
            {book.title}
          </h2>
          <p className="m-0 min-h-5 text-sm text-sophia-text-muted">
            {book.author ?? 'Unknown author'}
          </p>
        </div>

        <div className="grid gap-2 text-xs text-sophia-text-muted">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center gap-2 rounded-full border border-sophia-border px-3 py-1 font-semibold text-sophia-text">
              <span className={`h-2 w-2 rounded-full ${status.dotClassName}`} aria-hidden="true" />
              {status.label}
            </span>
            {book.pageCount ? <span>{book.pageCount} pages</span> : null}
          </div>
          <span>{processingPhase ?? status.description}</span>
          <span>Added {formatDate(book.addedAt)}</span>
        </div>

        {visibleError ? (
          <p className="m-0 rounded-lg border border-sophia-border bg-sophia-surface px-3 py-2 text-xs leading-5 text-sophia-primary">
            {visibleError}
          </p>
        ) : null}

        <div className="mt-1 grid gap-2">
          <button
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-55 ${
              actionEnabled
                ? 'bg-sophia-primary text-sophia-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary'
                : 'border border-sophia-border text-sophia-text'
            }`}
            type="button"
            disabled={!actionEnabled}
            title={book.processingStatus === 'ready' ? 'Reader coming in Sprint 5' : undefined}
            onClick={() => onPrepare(book)}
          >
            {actionLabel}
          </button>
          <button
            className="min-h-10 rounded-lg border border-sophia-border px-3 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            type="button"
            onClick={() => onEdit(book)}
          >
            Edit details
          </button>
        </div>
      </div>
    </article>
  )
}

function MetadataEditDialog({
  book,
  onCancel,
  onSaved,
}: {
  book: LibraryBook
  onCancel: () => void
  onSaved: (book: LibraryBook) => void
}) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author ?? '')
  const [language, setLanguage] = useState(book.language || 'en')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextTitle = title.trim()
    const nextAuthor = author.trim()
    const nextLanguage = language.trim().toLowerCase()

    if (!nextTitle || !nextLanguage) {
      setError('Please check the book details.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await updateBookMetadata(book.userBookId, {
        title: nextTitle,
        author: nextAuthor || null,
        language: nextLanguage,
      })

      onSaved(response.book)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'We could not update this book right now.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-5 py-8"
      role="presentation"
    >
      <section
        className="grid w-full max-w-[520px] gap-6 rounded-2xl border border-sophia-border bg-sophia-surface p-5 text-sophia-text shadow-[0_24px_70px_rgb(0_0_0_/_28%)] sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-book-title"
      >
        <header className="grid gap-2">
          <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
            Book details
          </p>
          <h2
            id="edit-book-title"
            className="m-0 text-2xl leading-tight font-semibold tracking-normal text-sophia-text"
          >
            Edit metadata
          </h2>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-sophia-text">
            Title
            <input
              className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
              maxLength={300}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-sophia-text">
            Author
            <input
              className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
              maxLength={255}
              type="text"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Unknown author"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-sophia-text">
            Language
            <select
              className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="ar">Arabic</option>
              <option value="es">Spanish</option>
            </select>
          </label>

          {error ? (
            <p className="m-0 rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 text-sm text-sophia-primary">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-sophia-border pt-5 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-lg border border-sophia-border px-5 text-sm font-semibold text-sophia-text disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="min-h-11 rounded-lg bg-sophia-primary px-5 text-sm font-bold text-sophia-bg disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save details'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function LibraryPage() {
  const { logout, user } = useAuth()
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme())
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null)
  const [processingPhases, setProcessingPhases] = useState<Record<string, string>>({})
  const [processingErrors, setProcessingErrors] = useState<Record<string, string>>({})

  async function loadLibrary(signal?: AbortSignal) {
    setLoading(true)
    setError(false)

    try {
      const response = await listBooks({ signal })
      setBooks(response.books)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        return
      }

      setError(true)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    void loadLibrary(controller.signal)

    return () => controller.abort()
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function goToUpload() {
    navigate('/upload')
  }

  function handleBookSaved(updatedBook: LibraryBook) {
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.userBookId === updatedBook.userBookId ? updatedBook : book,
      ),
    )
    setEditingBook(null)
  }

  function applyProcessingUpdate(updatedBook: ProcessingStatusBook) {
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.userBookId === updatedBook.userBookId
          ? {
              ...book,
              bookId: updatedBook.bookId || book.bookId,
              processingStatus: updatedBook.processingStatus,
              processingError: updatedBook.processingError,
              pageCount: updatedBook.pageCount,
            }
          : book,
      ),
    )
  }

  function previewProcessingStatus(userBookId: string, processingStatus: string) {
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.userBookId === userBookId
          ? {
              ...book,
              processingStatus,
              processingError: null,
            }
          : book,
      ),
    )
  }

  function setBookProcessingPhase(userBookId: string, phase: string | null) {
    setProcessingPhases((currentPhases) => {
      if (!phase) {
        const nextPhases = { ...currentPhases }
        delete nextPhases[userBookId]
        return nextPhases
      }

      return {
        ...currentPhases,
        [userBookId]: phase,
      }
    })
  }

  function clearBookProcessingError(userBookId: string) {
    setProcessingErrors((currentErrors) => {
      if (!currentErrors[userBookId]) {
        return currentErrors
      }

      const nextErrors = { ...currentErrors }
      delete nextErrors[userBookId]
      return nextErrors
    })
  }

  async function syncBookProcessingStatus(userBookId: string) {
    try {
      const response = await getBookProcessingStatus(userBookId)
      applyProcessingUpdate(response.book)
    } catch {
      return
    }
  }

  async function handlePrepareBook(book: LibraryBook) {
    const userBookId = book.userBookId

    if (processingPhases[userBookId]) {
      return
    }

    clearBookProcessingError(userBookId)

    try {
      setBookProcessingPhase(userBookId, 'Extracting text...')
      previewProcessingStatus(userBookId, 'extracting_text')
      const extraction = await processBook(userBookId)
      applyProcessingUpdate(extraction.book)

      setBookProcessingPhase(userBookId, 'Finding chapters...')
      const chapters = await detectBookChapters(userBookId)
      applyProcessingUpdate(chapters.book)

      setBookProcessingPhase(userBookId, 'Preparing structure...')
      const chunks = await generateBookChunks(userBookId)
      applyProcessingUpdate(chunks.book)
    } catch (requestError) {
      setProcessingErrors((currentErrors) => ({
        ...currentErrors,
        [userBookId]:
          requestError instanceof Error
            ? requestError.message
            : 'Sophia could not prepare this book right now.',
      }))
      await syncBookProcessingStatus(userBookId)
    } finally {
      setBookProcessingPhase(userBookId, null)
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 bg-sophia-bg text-sophia-text lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
      <aside
        className="min-w-0 border-b border-sophia-border bg-sophia-surface p-5 lg:border-r lg:border-b-0 lg:p-7"
        aria-label="Library"
      >
        <div>
          <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
            Sophia
          </p>
          <h1 className="mt-2 mb-0 text-3xl leading-tight font-semibold tracking-normal text-sophia-text">
            Library
          </h1>
          <p className="mt-3 mb-0 break-words text-sm text-sophia-text-muted">{user?.email}</p>
        </div>

        <button
          className="mt-7 min-h-11 w-full rounded-lg bg-sophia-primary px-4 py-2.5 text-sm font-bold text-sophia-bg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sophia-surface"
          type="button"
          onClick={goToUpload}
        >
          Upload Book
        </button>

        <section className="mt-7 border-t border-sophia-border pt-5" aria-label="Theme">
          <p className="m-0 text-xs font-bold tracking-[0.08em] text-sophia-text-muted uppercase">
            Reading mood
          </p>
          <div className="mt-3 grid gap-2">
            {themes.map((themeOption) => (
              <button
                key={themeOption.id}
                type="button"
                className={`min-h-10 rounded-lg border px-3 text-left text-sm font-semibold transition-colors ${
                  theme === themeOption.id
                    ? 'border-sophia-primary bg-sophia-bg text-sophia-text'
                    : 'border-transparent text-sophia-text-muted hover:border-sophia-border hover:bg-sophia-bg'
                }`}
                aria-pressed={theme === themeOption.id}
                onClick={() => setTheme(themeOption.id)}
              >
                {themeOption.label}
              </button>
            ))}
          </div>
        </section>

        <button
          className="mt-7 w-full rounded-lg border border-sophia-border px-4 py-2.5 text-sm font-semibold text-sophia-text"
          type="button"
          onClick={handleLogout}
        >
          Sign out
        </button>
      </aside>

      <section className="min-w-0 p-5 sm:p-8 lg:p-10" aria-label="Bookshelf">
        <div className="mx-auto grid w-full max-w-[1120px] gap-8">
          <header className="flex flex-col items-start justify-between gap-5 border-b border-sophia-border pb-7 sm:flex-row sm:items-end">
            <div className="grid max-w-[620px] gap-3">
              <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
                Personal bookshelf
              </p>
              <h2 className="m-0 text-4xl leading-tight font-semibold tracking-normal text-sophia-text sm:text-5xl">
                Your library
              </h2>
              <p className="m-0 text-base leading-7 text-sophia-text-muted">
                A quiet place for the books you are ready to study slowly.
              </p>
            </div>
          </header>

          {loading ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center">
              <div className="grid justify-items-center gap-4">
                <span
                  className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                  aria-hidden="true"
                />
                <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                  Opening your library...
                </p>
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center">
              <div className="grid max-w-[420px] justify-items-center gap-4">
                <h2 className="m-0 text-2xl font-semibold tracking-normal text-sophia-text">
                  We couldn't open your library.
                </h2>
                <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                  Try again in a moment.
                </p>
                <button
                  className="min-h-11 rounded-lg border border-sophia-border px-5 text-sm font-semibold text-sophia-text"
                  type="button"
                  onClick={() => void loadLibrary()}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          {!loading && !error && books.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-sophia-border bg-sophia-surface px-5 text-center">
              <div className="grid max-w-[460px] justify-items-center gap-4">
                <div
                  className="grid aspect-[3/4] w-28 place-items-center rounded-lg border border-sophia-border bg-sophia-bg shadow-[0_16px_28px_rgb(43_33_24_/_12%)]"
                  aria-hidden="true"
                >
                  <span className="font-serif text-4xl text-sophia-primary">S</span>
                </div>
                <div className="grid gap-2">
                  <h2 className="m-0 text-2xl font-semibold tracking-normal text-sophia-text">
                    Your library is quiet.
                  </h2>
                  <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                    Upload your first philosophy book to begin reading with Sophia.
                  </p>
                </div>
                <button
                  className="min-h-11 rounded-lg bg-sophia-primary px-5 text-sm font-bold text-sophia-bg"
                  type="button"
                  onClick={goToUpload}
                >
                  Upload Book
                </button>
              </div>
            </div>
          ) : null}

          {!loading && !error && books.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => (
                <BookCard
                  key={book.userBookId}
                  book={book}
                  onEdit={setEditingBook}
                  onPrepare={handlePrepareBook}
                  processingError={processingErrors[book.userBookId]}
                  processingPhase={processingPhases[book.userBookId]}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {editingBook ? (
        <MetadataEditDialog
          book={editingBook}
          onCancel={() => setEditingBook(null)}
          onSaved={handleBookSaved}
        />
      ) : null}
    </main>
  )
}
