import { useCallback, useEffect, useState } from 'react'
import type {
  ReaderSelection,
  ReaderSelectionCaptureResult,
  ReaderSelectionMode,
} from './reader-selection.types'
import { MAX_READER_SELECTION_CHARACTERS } from './reader-selection.utils'

type UseReaderSelectionOptions = {
  mode: ReaderSelectionMode
  userBookId: string
  bookId: string | null
  clearNativeSelection: () => void
}

function isSameSelection(
  current: ReaderSelection,
  next: ReaderSelection,
): boolean {
  return (
    current.mode === next.mode &&
    current.userBookId === next.userBookId &&
    current.bookId === next.bookId &&
    current.text === next.text &&
    current.pageStart === next.pageStart &&
    current.pageEnd === next.pageEnd &&
    current.sourceBlockId === next.sourceBlockId &&
    current.startOffset === next.startOffset &&
    current.endOffset === next.endOffset
  )
}

export function useReaderSelection({
  mode,
  userBookId,
  bookId,
  clearNativeSelection,
}: UseReaderSelectionOptions) {
  const [selection, setSelection] = useState<ReaderSelection | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)

  const captureSelection = useCallback(
    (result: ReaderSelectionCaptureResult) => {
      if (result.status === 'empty') {
        setSelection(null)
        setSelectionError(null)
        return
      }

      if (result.status === 'invalid') {
        setSelection(null)
        setSelectionError(result.message)
        return
      }

      const nextSelection = result.selection
      const hasValidIdentity =
        Boolean(bookId) &&
        nextSelection.mode === mode &&
        nextSelection.userBookId === userBookId &&
        nextSelection.bookId === bookId

      if (!hasValidIdentity) {
        return
      }

      if (nextSelection.text.length > MAX_READER_SELECTION_CHARACTERS) {
        setSelection(null)
        setSelectionError(
          `Select a shorter passage (up to ${MAX_READER_SELECTION_CHARACTERS.toLocaleString()} characters).`,
        )
        return
      }

      setSelection((current) =>
        current && isSameSelection(current, nextSelection)
          ? { ...nextSelection, createdAt: current.createdAt }
          : nextSelection,
      )
      setSelectionError(null)
    },
    [bookId, mode, userBookId],
  )

  const clearSelection = useCallback(() => {
    clearNativeSelection()
    setSelection(null)
    setSelectionError(null)
  }, [clearNativeSelection])

  const dismissSelectionError = useCallback(() => {
    setSelectionError(null)
  }, [])

  const reportSelectionError = useCallback((message: string) => {
    setSelection(null)
    setSelectionError(message)
  }, [])

  useEffect(() => {
    clearNativeSelection()
    setSelection(null)
    setSelectionError(null)
  }, [bookId, clearNativeSelection, mode, userBookId])

  return {
    selection,
    hasSelection: selection !== null,
    selectionError,
    captureSelection,
    clearSelection,
    dismissSelectionError,
    reportSelectionError,
  }
}
