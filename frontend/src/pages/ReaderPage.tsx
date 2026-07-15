import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoomMode } from '@embedpdf/plugin-zoom/react'
import {
  BooksApiError,
  fetchBookPdfBlob,
  getReaderData,
  type ReaderDataResponse,
} from '../books'
import { navigate } from '../routing/navigation'
import {
  PDFViewer,
  type PDFViewerHandle,
  type PDFViewerZoomLevel,
} from '../components/ui/pdf-viewer'
import { ReaderHeader } from '../features/reader/ReaderHeader'
import { ReaderSidebar } from '../features/reader/ReaderSidebar'
import { ReaderMobileChapters } from '../features/reader/ReaderMobileChapters'
import { findChapterForPage, sortChapters } from '../features/reader/reader.utils'
import type { ReaderState } from '../features/reader/reader.types'
import {
  ReaderPreferencesPanel,
  getReaderThemeClass,
  useReaderPreferences,
} from '../features/reader/preferences'

type ReaderPageProps = {
  userBookId: string
}

function createReaderLoginRedirect(userBookId: string): string {
  return `/login?redirectTo=${encodeURIComponent(`/reader/${userBookId}`)}`
}

type PdfState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blobUrl: string }
  | { status: 'error'; message: string }

function reportPdfFailure(stage: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[Sophia reader] ${stage}`, error)
  }
}

export function ReaderPage({ userBookId }: ReaderPageProps) {
  const [readerState, setReaderState] = useState<ReaderState>({ status: 'loading' })
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [pdfLoadAttempt, setPdfLoadAttempt] = useState(0)
  const [isFirstPageRendered, setIsFirstPageRendered] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewerPageCount, setViewerPageCount] = useState<number | null>(null)
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false)
  const viewerRef = useRef<PDFViewerHandle>(null)
  const blobUrlRef = useRef<string | null>(null)
  const {
    preferences,
    loading: preferencesLoading,
    saving: preferencesSaving,
    error: preferencesError,
    updatePreferences,
    resetPreferences,
  } = useReaderPreferences()
  const readerThemeClass = getReaderThemeClass(preferences.readerTheme)
  const viewerZoom: PDFViewerZoomLevel =
    preferences.pdfFitMode === 'custom'
      ? preferences.pdfZoom / 100
      : preferences.pdfFitMode === 'fit-page'
        ? ZoomMode.FitPage
        : ZoomMode.FitWidth

  // Load reader data
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
          setCurrentPage(data.book.currentPage)
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

  // Load the PDF blob once reader data is ready
  useEffect(() => {
    if (readerState.status !== 'ready') {
      return
    }

    let isMounted = true
    const controller = new AbortController()
    let createdBlobUrl: string | null = null

    async function loadPdf(data: ReaderDataResponse) {
      setPdfState({ status: 'loading' })
      setIsFirstPageRendered(false)

      try {
        const blob = await fetchBookPdfBlob(data.book.pdfUrl, {
          signal: controller.signal,
        })

        if (!isMounted) {
          return
        }

        const url = URL.createObjectURL(blob)

        createdBlobUrl = url
        blobUrlRef.current = url
        setPdfState({ status: 'ready', blobUrl: url })
      } catch (error) {
        if (!isMounted) {
          return
        }

        // Abort errors are expected on cleanup
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (error instanceof BooksApiError && error.status === 401) {
          navigate(createReaderLoginRedirect(userBookId), { replace: true })
          return
        }

        reportPdfFailure('PDF download failed', error)
        setPdfState({
          status: 'error',
          message: 'The PDF file could not be downloaded. Please try again.',
        })
      }
    }

    void loadPdf(readerState.data)

    return () => {
      isMounted = false
      controller.abort()

      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl)

        if (blobUrlRef.current === createdBlobUrl) {
          blobUrlRef.current = null
        }
      }
    }
  }, [pdfLoadAttempt, readerState, userBookId])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  // Callbacks for Extend UI PDFViewer
  const handleActivePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber)
  }, [])

  const handleDocumentLoadSuccess = useCallback((numPages: number) => {
    setViewerPageCount(numPages)
  }, [])

  const handleDocumentLoadError = useCallback((error: Error) => {
    reportPdfFailure('PDF document load failed', error)
    setIsFirstPageRendered(false)
    setPdfState({
      status: 'error',
      message: 'The PDF could not be opened. Please try again.',
    })
  }, [])

  const handlePageRenderSuccess = useCallback((pageNumber: number) => {
    if (pageNumber === 1) {
      setIsFirstPageRendered(true)
    }
  }, [])

  const handlePageRenderError = useCallback((error: Error, pageNumber: number) => {
    if (pageNumber !== 1) {
      return
    }

    reportPdfFailure('First page render failed', error)
    setIsFirstPageRendered(false)
    setPdfState({
      status: 'error',
      message: 'The PDF was loaded, but the first page could not be rendered.',
    })
  }, [])

  // Chapter navigation — scrolls the Extend UI viewer to a page
  const handleSelectChapter = useCallback((pageStart: number) => {
    viewerRef.current?.scrollToPage(pageStart)
  }, [])

  const toggleChapterDrawer = useCallback(() => {
    setChapterDrawerOpen((prev) => !prev)
  }, [])

  const closeChapterDrawer = useCallback(() => {
    setChapterDrawerOpen(false)
  }, [])

  const handleThumbnailSidebarOpenChange = useCallback(
    (open: boolean) => {
      updatePreferences({ readerSidebarOpen: open })
    },
    [updatePreferences],
  )

  function handleRetryPdf() {
    setViewerPageCount(null)
    setIsFirstPageRendered(false)
    setPdfState({ status: 'idle' })
    setPdfLoadAttempt((attempt) => attempt + 1)
  }

  function goToLibrary() {
    navigate('/library')
  }

  // --- Loading state ---
  if (readerState.status === 'loading') {
    return (
      <main className={`${readerThemeClass} flex h-svh flex-col bg-sophia-bg text-sophia-text`}>
        <div className="flex h-14 shrink-0 items-center border-b border-sophia-border bg-sophia-surface px-4">
          <p className="m-0 text-sm font-semibold text-sophia-text-muted">Sophia Reader</p>
        </div>
        <div className="grid flex-1 place-items-center">
          <div className="grid justify-items-center gap-4" role="status">
            <span
              className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
              aria-hidden="true"
            />
            <p className="m-0 text-sm font-semibold text-sophia-text-muted">
              Opening your book...
            </p>
          </div>
        </div>
      </main>
    )
  }

  // --- Error / Not Ready states ---
  if (readerState.status === 'error' || readerState.status === 'not-ready') {
    return (
      <main className={`${readerThemeClass} flex h-svh flex-col bg-sophia-bg text-sophia-text`}>
        <div className="flex h-14 shrink-0 items-center border-b border-sophia-border bg-sophia-surface px-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sophia-text-muted transition-colors hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
            onClick={goToLibrary}
            aria-label="Back to library"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                clipRule="evenodd"
              />
            </svg>
            Library
          </button>
        </div>
        <div className="grid flex-1 place-items-center px-5 text-center" role="alert">
          <div className="grid max-w-[460px] justify-items-center gap-4">
            <h1 className="m-0 text-2xl font-semibold tracking-normal text-sophia-text">
              {readerState.status === 'not-ready'
                ? 'This book is not ready yet.'
                : 'We could not open this book.'}
            </h1>
            <p className="m-0 text-sm leading-6 text-sophia-text-muted">
              {readerState.message}
            </p>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-sophia-primary px-5 text-sm font-bold text-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
              onClick={goToLibrary}
            >
              Return to library
            </button>
          </div>
        </div>
      </main>
    )
  }

  // --- Ready state ---
  const { book, chapters: rawChapters } = readerState.data
  const chapters = sortChapters(rawChapters)
  const hasChapters = chapters.length > 0
  const activeChapter = findChapterForPage(chapters, currentPage)
  const effectivePageCount = viewerPageCount ?? book.pageCount

  return (
    <main className={`${readerThemeClass} flex h-svh flex-col overflow-hidden bg-sophia-bg text-sophia-text`}>
      {/* Reader header */}
      <ReaderHeader
        title={book.title}
        author={book.author}
        currentPage={currentPage}
        pageCount={effectivePageCount}
        currentChapterTitle={activeChapter?.title ?? null}
        hasChapters={hasChapters}
        onToggleChapters={toggleChapterDrawer}
        settings={
          <ReaderPreferencesPanel
            preferences={preferences}
            loading={preferencesLoading}
            saving={preferencesSaving}
            error={preferencesError}
            themeClassName={readerThemeClass}
            onChange={updatePreferences}
            onReset={resetPreferences}
          />
        }
      />

      {/* Main content area: sidebar + viewer */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <ReaderSidebar
          chapters={chapters}
          currentPage={currentPage}
          onSelectChapter={handleSelectChapter}
        />

        {/* PDF viewer area — fills remaining space */}
        <div className="relative min-h-0 min-w-0 flex-1">
          {pdfState.status === 'loading' || pdfState.status === 'idle' ? (
            <div className="grid h-full place-items-center">
              <div className="grid justify-items-center gap-4" role="status">
                <span
                  className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                  aria-hidden="true"
                />
                <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                  Loading the PDF...
                </p>
              </div>
            </div>
          ) : null}

          {pdfState.status === 'error' ? (
            <div className="grid h-full place-items-center px-5 text-center">
              <div className="grid max-w-[400px] justify-items-center gap-4">
                <h2 className="m-0 text-lg font-semibold text-sophia-text">
                  Unable to display this book.
                </h2>
                <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                  {pdfState.message}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="min-h-10 rounded-lg border border-sophia-border px-4 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={goToLibrary}
                  >
                    Back to library
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded-lg bg-sophia-primary px-4 text-sm font-bold text-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                    onClick={handleRetryPdf}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {pdfState.status === 'ready' ? (
            <PDFViewer
              ref={viewerRef}
              src={pdfState.blobUrl}
              defaultZoom={viewerZoom}
              fileName={book.title}
              showDownload={false}
              showUpload={false}
              showRotateControls={false}
              onActivePageChange={handleActivePageChange}
              onDocumentLoadError={handleDocumentLoadError}
              onDocumentLoadSuccess={handleDocumentLoadSuccess}
              onPageRenderError={handlePageRenderError}
              onPageRenderSuccess={handlePageRenderSuccess}
              onThumbnailSidebarOpenChange={handleThumbnailSidebarOpenChange}
              thumbnailSidebarOpen={preferences.readerSidebarOpen}
              className="h-full w-full"
            />
          ) : null}

          {pdfState.status === 'ready' && !isFirstPageRendered ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-sophia-bg/95">
              <div className="grid justify-items-center gap-4" role="status">
                <span
                  className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                  aria-hidden="true"
                />
                <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                  Rendering the first page...
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile chapter drawer */}
      <ReaderMobileChapters
        chapters={chapters}
        currentPage={currentPage}
        isOpen={chapterDrawerOpen}
        onClose={closeChapterDrawer}
        onSelectChapter={handleSelectChapter}
      />
    </main>
  )
}
