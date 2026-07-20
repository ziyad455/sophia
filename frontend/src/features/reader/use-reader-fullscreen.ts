import { useCallback, useEffect, useRef, useState } from 'react'

const FULLSCREEN_ERROR_MESSAGE = 'We could not enter fullscreen mode.'

type UseReaderFullscreenOptions = {
  onFullscreenChange?: (isFullscreen: boolean) => void
}

export function useReaderFullscreen({
  onFullscreenChange,
}: UseReaderFullscreenOptions = {}) {
  const [readerElement, setReaderElement] = useState<HTMLElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const onFullscreenChangeRef = useRef(onFullscreenChange)

  onFullscreenChangeRef.current = onFullscreenChange

  const readerRootRef = useCallback((element: HTMLElement | null) => {
    // Keep the last mounted element available to the effect cleanup so it can
    // release fullscreen after React detaches the DOM ref during unmount.
    if (element) {
      setReaderElement((current) => current === element ? current : element)
    }
  }, [])

  const isSupported = Boolean(
    readerElement?.requestFullscreen &&
    typeof document !== 'undefined' &&
    document.exitFullscreen,
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!readerElement || typeof document === 'undefined') {
      return
    }

    const syncFullscreenState = () => {
      const nextIsFullscreen = document.fullscreenElement === readerElement

      if (mountedRef.current) {
        setIsFullscreen(nextIsFullscreen)

        if (nextIsFullscreen) {
          setError(null)
        }
      }

      onFullscreenChangeRef.current?.(nextIsFullscreen)
    }

    const handleFullscreenError = () => {
      if (mountedRef.current) {
        setError(FULLSCREEN_ERROR_MESSAGE)
      }
    }

    setIsFullscreen(document.fullscreenElement === readerElement)
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('fullscreenerror', handleFullscreenError)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('fullscreenerror', handleFullscreenError)

      if (
        document.fullscreenElement === readerElement &&
        typeof document.exitFullscreen === 'function'
      ) {
        void document.exitFullscreen().catch(() => undefined)
      }
    }
  }, [readerElement])

  const toggleFullscreen = useCallback(async () => {
    if (!readerElement || !isSupported) {
      return
    }

    setError(null)

    try {
      if (document.fullscreenElement === readerElement) {
        await document.exitFullscreen()
        return
      }

      // Do not exit or replace fullscreen owned by another part of the page.
      if (document.fullscreenElement !== null) {
        setError(FULLSCREEN_ERROR_MESSAGE)
        return
      }

      await readerElement.requestFullscreen()
    } catch {
      if (mountedRef.current) {
        setError(FULLSCREEN_ERROR_MESSAGE)
      }
    }
  }, [isSupported, readerElement])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    readerRootRef,
    readerElement,
    isSupported,
    isFullscreen,
    error,
    clearError,
    toggleFullscreen,
  }
}
