import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ZoomMode } from '@embedpdf/plugin-zoom/react'
import {
  BooksApiError,
  fetchBookPdfBlob,
  getReadingContent,
  getReaderData,
  type ReadingContentResponse,
  type ReaderChapter,
  type ReaderDataResponse,
  type UpdateReadingProgressPayload,
} from '../books'
import { navigate } from '../routing/navigation'
import {
  PDFViewer,
  type PDFViewerHandle,
  type PDFViewerPageOverlayProps,
  type PDFViewerTextSelectionData,
  type PDFViewerZoomLevel,
} from '../components/ui/pdf-viewer'
import { ReaderHeader } from '../features/reader/ReaderHeader'
import { ReaderSidebar } from '../features/reader/ReaderSidebar'
import { ReaderMobileChapters } from '../features/reader/ReaderMobileChapters'
import { ReaderModeToggle } from '../features/reader/ReaderModeToggle'
import {
  HighlightsPanel,
  HighlightsTrigger,
  PdfHighlightsOverlay,
  isStructurallyUnresolved,
  useHighlights,
  type HighlightColor,
  type HighlightPreview,
  type ReaderHighlight,
} from '../features/reader/highlights'
import {
  ReflowedReadingMode,
  type ReflowedReadingModeHandle,
} from '../features/reader/ReflowedReadingMode'
import { findChapterForPage, sortChapters } from '../features/reader/reader.utils'
import type { ReaderState } from '../features/reader/reader.types'
import { useReadingProgress } from '../features/reader/use-reading-progress'
import {
  ReaderSelectionToolbar,
  createPdfSelection,
  useReaderSelection,
  type ReaderSelection,
  type ReaderSelectionCaptureResult,
} from '../features/reader/selection'
import {
  ReaderPreferencesPanel,
  getReadingMoodClass,
  type ReaderMode,
  useReaderPreferences,
} from '../features/reader/preferences'
import { PdfReadingMoodFilters } from '../features/reader/preferences/PdfReadingMoodFilters'

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

type ReadingContentState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: ReadingContentResponse }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

function reportPdfFailure(stage: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[Sophia reader] ${stage}`, error)
  }
}

function clampReaderPage(pageNumber: number, pageCount: number | null): number {
  const safePage = Number.isInteger(pageNumber) ? Math.max(1, pageNumber) : 1

  return pageCount && pageCount > 0 ? Math.min(safePage, pageCount) : safePage
}

function createProgressPayload(
  pageNumber: number,
  pageCount: number | null,
  chapters: ReaderChapter[],
): UpdateReadingProgressPayload {
  const currentPage = clampReaderPage(pageNumber, pageCount)
  const currentChapter = findChapterForPage(sortChapters(chapters), currentPage)
  const progressPercent = pageCount && pageCount > 0
    ? Math.min(100, Math.max(0, Math.round((currentPage / pageCount) * 1_000) / 10))
    : 0

  return {
    currentPage,
    currentChapterId: currentChapter?.id ?? null,
    progressPercent,
  }
}

function getSelectionPreviewKey(selection: ReaderSelection): string {
  const pdfAnchor = selection.mode === 'pdf'
    ? selection.boundingRects.map((rect) => [
        rect.pageNumber,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
      ])
    : null

  return JSON.stringify([
    selection.mode,
    selection.userBookId,
    selection.bookId,
    selection.text,
    selection.pageStart,
    selection.pageEnd,
    selection.sourceBlockId,
    selection.startOffset,
    selection.endOffset,
    pdfAnchor,
  ])
}

export function ReaderPage({ userBookId }: ReaderPageProps) {
  const [readerState, setReaderState] = useState<ReaderState>({ status: 'loading' })
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [pdfLoadRequested, setPdfLoadRequested] = useState(false)
  const [pdfLoadAttempt, setPdfLoadAttempt] = useState(0)
  const [isPdfPageRendered, setIsPdfPageRendered] = useState(false)
  const [readingContentState, setReadingContentState] =
    useState<ReadingContentState>({ status: 'idle' })
  const [readingContentRequested, setReadingContentRequested] = useState(false)
  const [readingContentLoadAttempt, setReadingContentLoadAttempt] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewerPageCount, setViewerPageCount] = useState<number | null>(null)
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false)
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(false)
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null)
  const [previewColor, setPreviewColor] = useState<HighlightColor>('gold')
  const viewerRef = useRef<PDFViewerHandle>(null)
  const reflowedReaderRef = useRef<ReflowedReadingModeHandle>(null)
  const blobUrlRef = useRef<string | null>(null)
  const pendingPdfPageRef = useRef<number | null>(null)
  const currentPageRef = useRef(1)
  const pageChangeVersionRef = useRef(0)
  const progressAppliedRef = useRef(false)
  const progressReadyToSaveRef = useRef(false)
  const previewSelectionKeyRef = useRef<string | null>(null)
  const {
    preferences,
    loading: preferencesLoading,
    saving: preferencesSaving,
    error: preferencesError,
    updatePreferences,
    resetPreferences,
  } = useReaderPreferences()
  const {
    loadState: progressLoadState,
    queueSave: queueProgressSave,
    flush: flushProgress,
    saveError: progressSaveError,
  } = useReadingProgress({
    enabled: readerState.status === 'ready',
    userBookId,
  })
  const selectionBookId = readerState.status === 'ready'
    ? readerState.data.book.bookId
    : null
  const readerChapters = useMemo(
    () => readerState.status === 'ready'
      ? sortChapters(readerState.data.chapters)
      : [],
    [readerState],
  )
  const clearNativeReaderSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    viewerRef.current?.clearTextSelection()
  }, [])
  const {
    selection,
    selectionError,
    captureSelection: captureReaderSelection,
    clearSelection: clearReaderSelection,
    dismissSelectionError,
    reportSelectionError: reportReaderSelectionError,
  } = useReaderSelection({
    mode: preferences.readerMode,
    userBookId,
    bookId: selectionBookId,
    clearNativeSelection: clearNativeReaderSelection,
  })
  const captureSelection = useCallback((result: ReaderSelectionCaptureResult) => {
    if (result.status === 'valid') {
      const selectionKey = getSelectionPreviewKey(result.selection)

      if (previewSelectionKeyRef.current !== selectionKey) {
        previewSelectionKeyRef.current = selectionKey
        setPreviewColor('gold')
      }
    } else {
      previewSelectionKeyRef.current = null
      setPreviewColor('gold')
    }

    captureReaderSelection(result)
  }, [captureReaderSelection])
  const clearSelection = useCallback(() => {
    previewSelectionKeyRef.current = null
    setPreviewColor('gold')
    clearReaderSelection()
  }, [clearReaderSelection])
  const reportSelectionError = useCallback((message: string) => {
    previewSelectionKeyRef.current = null
    setPreviewColor('gold')
    reportReaderSelectionError(message)
  }, [reportReaderSelectionError])
  const highlightPreview = useMemo<HighlightPreview | null>(
    () => selection
      ? { selection, color: previewColor, temporary: true }
      : null,
    [previewColor, selection],
  )
  const {
    highlights,
    loading: highlightsLoading,
    loadError: highlightsLoadError,
    mutationError: highlightMutationError,
    saving: highlightSaving,
    deletingIds: deletingHighlightIds,
    createHighlight: saveHighlight,
    deleteHighlight: removeHighlight,
    refreshHighlights,
    clearMutationError: clearHighlightMutationError,
  } = useHighlights({
    enabled: readerState.status === 'ready',
    userBookId,
  })

  useEffect(() => {
    if (!activeHighlightId) {
      return
    }

    const timeout = window.setTimeout(() => setActiveHighlightId(null), 2_000)

    return () => window.clearTimeout(timeout)
  }, [activeHighlightId])

  useEffect(() => {
    if (!highlightNotice) {
      return
    }

    const timeout = window.setTimeout(() => setHighlightNotice(null), 5_000)

    return () => window.clearTimeout(timeout)
  }, [highlightNotice])

  const activateHighlight = useCallback((highlightId: string) => {
    setActiveHighlightId(highlightId)
  }, [])

  const handleSaveHighlight = useCallback(async () => {
    if (!highlightPreview) {
      return
    }

    clearHighlightMutationError()

    try {
      const savedHighlight = await saveHighlight(
        highlightPreview.selection,
        highlightPreview.color,
      )

      clearSelection()
      setActiveHighlightId(savedHighlight.id)

      if (isStructurallyUnresolved(savedHighlight)) {
        setHighlightNotice(
          'Highlight saved by page. This multi-paragraph passage remains available in Highlights.',
        )
      }
    } catch {
      // The hook exposes a calm retryable error and the selection remains intact.
    }
  }, [
    clearHighlightMutationError,
    clearSelection,
    highlightPreview,
    saveHighlight,
  ])

  const dismissSelectionToolbarError = useCallback(() => {
    dismissSelectionError()
    clearHighlightMutationError()
  }, [clearHighlightMutationError, dismissSelectionError])

  const renderPdfHighlights = useCallback(
    (overlayProps: PDFViewerPageOverlayProps) => (
      <PdfHighlightsOverlay
        {...overlayProps}
        highlights={highlights}
        preview={highlightPreview}
        activeHighlightId={activeHighlightId}
        onActivate={activateHighlight}
      />
    ),
    [activateHighlight, activeHighlightId, highlightPreview, highlights],
  )

  useEffect(() => {
    if (!selection && !selectionError) {
      return
    }

    const handleOutsideSelectionPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        return
      }

      if (
        event.target.closest('[data-reader-selection-toolbar]') ||
        event.target.closest('[data-reader-selection-content]') ||
        event.target.closest('[data-pdf-viewer-page]')
      ) {
        return
      }

      clearSelection()
    }

    document.addEventListener('pointerdown', handleOutsideSelectionPointer)

    return () => {
      document.removeEventListener('pointerdown', handleOutsideSelectionPointer)
    }
  }, [clearSelection, selection, selectionError])
  const readerMoodClass = getReadingMoodClass(preferences.readingMood)
  const viewerZoom: PDFViewerZoomLevel =
    preferences.pdfFitMode === 'custom'
      ? preferences.pdfZoom / 100
      : preferences.pdfFitMode === 'fit-page'
        ? ZoomMode.FitPage
        : ZoomMode.FitWidth

  useEffect(() => {
    if (preferencesLoading) {
      return
    }

    if (preferences.readerMode === 'pdf') {
      setPdfLoadRequested(true)
    } else {
      setReadingContentRequested(true)
    }
  }, [preferences.readerMode, preferencesLoading])

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
          const initialPage = clampReaderPage(data.book.currentPage, data.book.pageCount)

          currentPageRef.current = initialPage
          setCurrentPage(initialPage)
          pendingPdfPageRef.current = initialPage
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
    if (readerState.status !== 'ready' || !pdfLoadRequested) {
      return
    }

    let isMounted = true
    const controller = new AbortController()
    let createdBlobUrl: string | null = null

    async function loadPdf(data: ReaderDataResponse) {
      setPdfState({ status: 'loading' })
      setIsPdfPageRendered(false)

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
  }, [pdfLoadAttempt, pdfLoadRequested, readerState, userBookId])

  useEffect(() => {
    if (readerState.status !== 'ready' || !readingContentRequested) {
      return
    }

    let isMounted = true
    const controller = new AbortController()

    async function loadReadingContent() {
      setReadingContentState({ status: 'loading' })

      try {
        const data = await getReadingContent(userBookId, {
          signal: controller.signal,
        })

        if (!isMounted) {
          return
        }

        const pages = [
          ...data.unassignedPages,
          ...data.chapters.flatMap((chapter) => chapter.pages),
        ]
        const hasReadableText = pages.some((page) => page.text.trim().length > 0)

        setReadingContentState(
          hasReadableText ? { status: 'ready', data } : { status: 'unavailable' },
        )
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (error instanceof BooksApiError && error.status === 401) {
          navigate(createReaderLoginRedirect(userBookId), { replace: true })
          return
        }

        setReadingContentState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'We could not prepare the reading view right now.',
        })
      }
    }

    void loadReadingContent()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [readingContentLoadAttempt, readingContentRequested, readerState, userBookId])

  useEffect(() => {
    if (
      readerState.status !== 'ready' ||
      progressAppliedRef.current ||
      progressLoadState.status === 'loading'
    ) {
      return
    }

    progressAppliedRef.current = true

    if (progressLoadState.status === 'ready' && pageChangeVersionRef.current === 0) {
      const restoredPage = clampReaderPage(
        progressLoadState.progress.currentPage,
        readerState.data.book.pageCount,
      )

      currentPageRef.current = restoredPage
      setCurrentPage(restoredPage)

      if (preferences.readerMode === 'pdf') {
        pendingPdfPageRef.current = restoredPage
        viewerRef.current?.scrollToPage(restoredPage, { behavior: 'auto' })
      } else {
        reflowedReaderRef.current?.scrollToPage(restoredPage, 'auto')
      }
    }

    progressReadyToSaveRef.current = true
  }, [preferences.readerMode, progressLoadState, readerState])

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
  const queueCurrentProgress = useCallback(
    (pageNumber: number) => {
      if (readerState.status !== 'ready') {
        return
      }

      queueProgressSave(
        createProgressPayload(
          pageNumber,
          viewerPageCount ?? readerState.data.book.pageCount,
          readerState.data.chapters,
        ),
      )
    },
    [queueProgressSave, readerState, viewerPageCount],
  )

  const handleActivePageChange = useCallback((pageNumber: number) => {
    const normalizedPage = Math.max(1, Math.trunc(pageNumber))
    const pendingPage = pendingPdfPageRef.current

    if (pendingPage !== null && normalizedPage !== pendingPage) {
      return
    }

    if (normalizedPage === pendingPage) {
      pendingPdfPageRef.current = null
    }

    if (normalizedPage === currentPageRef.current) {
      return
    }

    currentPageRef.current = normalizedPage
    pageChangeVersionRef.current += 1
    setCurrentPage(normalizedPage)

    if (
      selection &&
      selection.pageStart !== null &&
      selection.pageEnd !== null &&
      (normalizedPage < selection.pageStart || normalizedPage > selection.pageEnd)
    ) {
      clearSelection()
    }

    if (progressReadyToSaveRef.current) {
      queueCurrentProgress(normalizedPage)
    }
  }, [clearSelection, queueCurrentProgress, selection])

  const handleDocumentLoadSuccess = useCallback(
    (numPages: number) => {
      setViewerPageCount(numPages)
      const targetPage = pendingPdfPageRef.current ?? currentPage

      window.requestAnimationFrame(() => {
        viewerRef.current?.scrollToPage(targetPage, { behavior: 'auto' })
        window.requestAnimationFrame(() => {
          pendingPdfPageRef.current = null
        })
      })
    },
    [currentPage],
  )

  const handleDocumentLoadError = useCallback((error: Error) => {
    reportPdfFailure('PDF document load failed', error)
    setIsPdfPageRendered(false)
    setPdfState({
      status: 'error',
      message: 'The PDF could not be opened. Please try again.',
    })
  }, [])

  const handlePageRenderSuccess = useCallback((_pageNumber: number) => {
    setIsPdfPageRendered(true)
  }, [])

  const handlePageRenderError = useCallback((error: Error, pageNumber: number) => {
    if (pageNumber !== currentPage) {
      return
    }

    reportPdfFailure('PDF page render failed', error)
    setIsPdfPageRendered(false)
    setPdfState({
      status: 'error',
      message: 'The PDF was loaded, but the current page could not be rendered.',
    })
  }, [currentPage])

  const handlePdfTextSelectionChange = useCallback(
    (pdfSelection: PDFViewerTextSelectionData | null) => {
      if (readerState.status !== 'ready') {
        return
      }

      captureSelection(
        createPdfSelection({
          data: pdfSelection,
          userBookId,
          bookId: readerState.data.book.bookId,
          chapters: readerState.data.chapters,
        }),
      )
    },
    [captureSelection, readerState, userBookId],
  )

  const handlePdfTextSelectionError = useCallback(
    (error: Error) => {
      reportPdfFailure('PDF text selection failed', error)
      reportSelectionError('We could not capture that passage. Please try selecting it again.')
    },
    [reportSelectionError],
  )

  // Chapter navigation — scrolls the Extend UI viewer to a page
  const handleSelectChapter = useCallback(
    (pageStart: number) => {
      clearSelection()

      if (preferences.readerMode === 'reading') {
        reflowedReaderRef.current?.scrollToPage(pageStart)
      } else {
        viewerRef.current?.scrollToPage(pageStart)
      }
    },
    [clearSelection, preferences.readerMode],
  )

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

  const handleReaderModeChange = useCallback(
    (mode: ReaderMode) => {
      if (mode === preferences.readerMode) {
        return
      }

      clearSelection()

      if (progressReadyToSaveRef.current) {
        queueCurrentProgress(currentPageRef.current)
        void flushProgress()
      }

      if (mode === 'pdf') {
        pendingPdfPageRef.current = currentPageRef.current
        setPdfLoadRequested(true)
        setIsPdfPageRendered(false)
      } else {
        pendingPdfPageRef.current = currentPageRef.current
        setReadingContentRequested(true)
      }

      updatePreferences({ readerMode: mode })
    },
    [
      clearSelection,
      flushProgress,
      preferences.readerMode,
      queueCurrentProgress,
      updatePreferences,
    ],
  )

  const handleNavigateHighlight = useCallback((highlight: ReaderHighlight) => {
    clearSelection()
    setActiveHighlightId(highlight.id)
    setHighlightsPanelOpen(false)

    if (preferences.readerMode === 'reading') {
      const restored = reflowedReaderRef.current?.scrollToHighlight(
        highlight.id,
        highlight.sourceBlockId,
        highlight.pageStart,
      ) ?? false

      if (!restored) {
        setHighlightNotice('This highlight could not be located in the current reading view.')
      }
      return
    }

    viewerRef.current?.scrollToPage(highlight.pageStart)
  }, [clearSelection, preferences.readerMode])

  const handleDeleteHighlight = useCallback(async (highlightId: string) => {
    await removeHighlight(highlightId)

    if (activeHighlightId === highlightId) {
      setActiveHighlightId(null)
    }
  }, [activeHighlightId, removeHighlight])

  const handleRetryHighlights = useCallback(() => {
    clearHighlightMutationError()
    refreshHighlights()
  }, [clearHighlightMutationError, refreshHighlights])

  function handleRetryPdf() {
    setViewerPageCount(null)
    setIsPdfPageRendered(false)
    setPdfState({ status: 'idle' })
    setPdfLoadAttempt((attempt) => attempt + 1)
  }

  function handleRetryReadingContent() {
    setReadingContentState({ status: 'idle' })
    setReadingContentLoadAttempt((attempt) => attempt + 1)
  }

  function openOriginalPdf() {
    handleReaderModeChange('pdf')
  }

  function goToLibrary() {
    if (progressReadyToSaveRef.current) {
      queueCurrentProgress(currentPageRef.current)
      void flushProgress()
    }

    navigate('/library')
  }

  // --- Loading state ---
  if (readerState.status === 'loading') {
    return (
      <main className={`${readerMoodClass} flex h-svh flex-col bg-sophia-bg text-sophia-text`}>
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
      <main className={`${readerMoodClass} flex h-svh flex-col bg-sophia-bg text-sophia-text`}>
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
  const { book } = readerState.data
  const chapters = readerChapters
  const hasChapters = chapters.length > 0
  const activeChapter = findChapterForPage(chapters, currentPage)
  const effectivePageCount = viewerPageCount ?? book.pageCount

  return (
    <main className={`${readerMoodClass} flex h-svh flex-col overflow-hidden bg-sophia-bg text-sophia-text`}>
      <PdfReadingMoodFilters />
      {/* Reader header */}
      <ReaderHeader
        title={book.title}
        author={book.author}
        currentPage={currentPage}
        pageCount={effectivePageCount}
        currentChapterTitle={activeChapter?.title ?? null}
        hasChapters={hasChapters}
        onToggleChapters={toggleChapterDrawer}
        actions={
          <HighlightsTrigger
            count={highlights.length}
            hasError={Boolean(highlightsLoadError || highlightMutationError)}
            onClick={() => setHighlightsPanelOpen(true)}
          />
        }
        settings={
          <ReaderPreferencesPanel
            preferences={preferences}
            loading={preferencesLoading}
            saving={preferencesSaving}
            error={preferencesError}
            moodClassName={readerMoodClass}
            onChange={updatePreferences}
            onReset={resetPreferences}
          />
        }
      />

      <div className="flex shrink-0 justify-center border-b border-sophia-border bg-sophia-surface px-3 py-2">
        <ReaderModeToggle
          mode={preferences.readerMode}
          disabled={preferencesLoading}
          onChange={handleReaderModeChange}
        />
      </div>

      {progressLoadState.status === 'error' || progressSaveError ? (
        <p
          className="m-0 shrink-0 border-b border-sophia-border bg-sophia-surface px-4 py-2 text-center text-xs text-sophia-text-muted"
          role="status"
        >
          {progressSaveError ?? 'Your saved position could not be restored. Reading starts here.'}
        </p>
      ) : null}

      {highlightNotice ? (
        <p
          className="m-0 shrink-0 border-b border-sophia-border bg-sophia-surface px-4 py-2 text-center text-xs text-sophia-text-muted"
          role="status"
        >
          {highlightNotice}
        </p>
      ) : null}

      {/* Main content area: sidebar + viewer */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <ReaderSidebar
          chapters={chapters}
          currentPage={currentPage}
          onSelectChapter={handleSelectChapter}
        />

        {/* Only the active reading surface is mounted. */}
        <div className="relative min-h-0 min-w-0 flex-1">
          {preferencesLoading ? (
            <div className="grid h-full place-items-center">
              <div className="grid justify-items-center gap-4" role="status">
                <span
                  className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                  aria-hidden="true"
                />
                <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                  Preparing your reading view...
                </p>
              </div>
            </div>
          ) : null}

          {!preferencesLoading && preferences.readerMode === 'pdf' ? (
            <>
              {pdfState.status === 'loading' || pdfState.status === 'idle' ? (
                <div className="grid h-full place-items-center">
                  <div className="grid justify-items-center gap-4" role="status">
                    <span
                      className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                      Loading the original PDF...
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
                  onTextSelectionChange={handlePdfTextSelectionChange}
                  onTextSelectionError={handlePdfTextSelectionError}
                  renderPageOverlay={renderPdfHighlights}
                  onThumbnailSidebarOpenChange={handleThumbnailSidebarOpenChange}
                  thumbnailSidebarOpen={preferences.readerSidebarOpen}
                  className="h-full w-full"
                />
              ) : null}

              {pdfState.status === 'ready' && !isPdfPageRendered ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-sophia-bg/95">
                  <div className="grid justify-items-center gap-4" role="status">
                    <span
                      className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                      Rendering the page...
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {!preferencesLoading && preferences.readerMode === 'reading' ? (
            <>
              {readingContentState.status === 'loading' ||
              readingContentState.status === 'idle' ? (
                <div className="grid h-full place-items-center">
                  <div className="grid justify-items-center gap-4" role="status">
                    <span
                      className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm font-semibold text-sophia-text-muted">
                      Preparing the reading view...
                    </p>
                  </div>
                </div>
              ) : null}

              {readingContentState.status === 'ready' ? (
                <ReflowedReadingMode
                  ref={reflowedReaderRef}
                  content={readingContentState.data}
                  initialPage={currentPage}
                  preferences={preferences}
                  highlights={highlights}
                  preview={highlightPreview}
                  activeHighlightId={activeHighlightId}
                  onActivePageChange={handleActivePageChange}
                  onHighlightActivate={activateHighlight}
                  onSelectionCapture={captureSelection}
                />
              ) : null}

              {readingContentState.status === 'unavailable' ||
              readingContentState.status === 'error' ? (
                <div className="grid h-full place-items-center px-5 text-center" role="alert">
                  <div className="grid max-w-[440px] justify-items-center gap-4">
                    <h2 className="m-0 text-xl font-semibold text-sophia-text">
                      Reading Mode is not available for this book.
                    </h2>
                    <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                      {readingContentState.status === 'error'
                        ? readingContentState.message
                        : 'This book does not have extracted text yet. You can continue using the original PDF.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {readingContentState.status === 'error' ? (
                        <button
                          type="button"
                          className="min-h-10 rounded-lg border border-sophia-border px-4 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                          onClick={handleRetryReadingContent}
                        >
                          Retry
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="min-h-10 rounded-lg bg-sophia-primary px-4 text-sm font-bold text-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary"
                        onClick={openOriginalPdf}
                      >
                        Open Original PDF
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
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

      <HighlightsPanel
        isOpen={highlightsPanelOpen}
        highlights={highlights}
        chapters={chapters}
        activeHighlightId={activeHighlightId}
        loading={highlightsLoading}
        error={highlightsLoadError ?? highlightMutationError}
        deletingIds={deletingHighlightIds}
        onClose={() => setHighlightsPanelOpen(false)}
        onRetry={handleRetryHighlights}
        onNavigate={handleNavigateHighlight}
        onDelete={handleDeleteHighlight}
      />

      <ReaderSelectionToolbar
        selection={selection}
        error={selectionError ?? (selection ? highlightMutationError : null)}
        saving={highlightSaving}
        color={previewColor}
        onColorChange={setPreviewColor}
        onHighlight={handleSaveHighlight}
        onClear={clearSelection}
        onDismissError={dismissSelectionToolbarError}
      />
    </main>
  )
}
