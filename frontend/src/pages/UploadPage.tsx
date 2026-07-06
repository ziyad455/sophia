import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { uploadBook, type UploadedLibraryBook } from '../books'
import { config } from '../config'
import { navigate } from '../routing/navigation'

type UploadStatus = 'idle' | 'uploading' | 'success'

const DEFAULT_LANGUAGE = 'en'

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isPdfFile(file: File): boolean {
  const hasPdfType = file.type === 'application/pdf'
  const hasPdfName = file.name.toLowerCase().endsWith('.pdf')

  return hasPdfType || hasPdfName
}

function validatePdfFile(file: File): string | null {
  if (!isPdfFile(file)) {
    return 'Choose a PDF book to add to Sophia.'
  }

  const maxBytes = config.maxPdfUploadMb * 1024 * 1024

  if (file.size > maxBytes) {
    return `Choose a PDF smaller than ${config.maxPdfUploadMb} MB.`
  }

  return null
}

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [uploadedBook, setUploadedBook] = useState<UploadedLibraryBook | null>(null)

  const selectedFileDetails = useMemo(() => {
    if (!selectedFile) {
      return null
    }

    return {
      name: selectedFile.name,
      size: formatFileSize(selectedFile.size),
    }
  }, [selectedFile])

  useEffect(() => {
    if (status !== 'success') {
      return undefined
    }

    const redirectTimer = window.setTimeout(() => {
      navigate('/library', { replace: true })
    }, 900)

    return () => window.clearTimeout(redirectTimer)
  }, [status])

  function chooseFile(file: File | undefined) {
    if (!file || status === 'uploading') {
      return
    }

    const validationError = validatePdfFile(file)

    setUploadedBook(null)
    setStatus('idle')

    if (validationError) {
      setSelectedFile(null)
      setError(validationError)
      return
    }

    setSelectedFile(file)
    setError(null)
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    chooseFile(event.dataTransfer.files[0])
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setDragActive(false)
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    inputRef.current?.click()
  }

  function removeSelectedFile() {
    if (status === 'uploading') {
      return
    }

    setSelectedFile(null)
    setUploadedBook(null)
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      setError('Choose a PDF book before adding it to your library.')
      return
    }

    const validationError = validatePdfFile(selectedFile)

    if (validationError) {
      setError(validationError)
      return
    }

    setStatus('uploading')
    setError(null)
    setUploadedBook(null)

    try {
      const response = await uploadBook({
        file: selectedFile,
        title,
        author,
        language,
      })

      setUploadedBook(response.book)
      setStatus('success')
    } catch (requestError) {
      setStatus('idle')
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Sophia could not add this book right now.',
      )
    }
  }

  const isUploading = status === 'uploading'
  const canUpload = Boolean(selectedFile) && !isUploading

  return (
    <main className="min-h-svh bg-sophia-bg px-5 py-8 text-sophia-text sm:px-8 lg:px-10">
      <section className="mx-auto grid w-full max-w-[860px] gap-8 py-8 sm:py-12">
        <header className="grid max-w-[620px] gap-3">
          <a
            className="w-fit text-sm font-semibold text-sophia-primary no-underline hover:text-sophia-accent focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-sophia-primary"
            href="/library"
            onClick={(event) => {
              event.preventDefault()
              navigate('/library')
            }}
          >
            Return to library
          </a>
          <div>
            <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
              Personal library
            </p>
            <h1 className="mt-3 mb-0 text-4xl leading-tight font-semibold tracking-normal text-sophia-text sm:text-5xl">
              Upload a Book
            </h1>
          </div>
          <p className="m-0 max-w-[560px] text-base leading-7 text-sophia-text-muted">
            Bring a philosophy book into Sophia.
          </p>
        </header>

        <form
          className="grid gap-6 rounded-2xl border border-sophia-border bg-sophia-surface p-5 shadow-[0_18px_50px_rgb(43_33_24_/_8%)] sm:p-7"
          onSubmit={handleSubmit}
        >
          <div
            className={`grid min-h-[260px] cursor-pointer place-items-center rounded-2xl border border-dashed p-6 text-center transition-colors ${
              dragActive
                ? 'border-sophia-primary bg-sophia-bg'
                : 'border-sophia-border bg-sophia-bg/70 hover:border-sophia-primary'
            }`}
            role="button"
            tabIndex={0}
            aria-label="Choose a PDF book to upload"
            onClick={() => inputRef.current?.click()}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onKeyDown={handleDropzoneKeyDown}
          >
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Choose PDF file"
              onChange={handleFileInputChange}
            />

            {selectedFileDetails ? (
              <div className="grid w-full max-w-[420px] justify-items-center gap-4">
                <span
                  className="grid h-14 w-12 place-items-center rounded-lg border border-sophia-border bg-sophia-surface text-xs font-bold text-sophia-primary"
                  aria-hidden="true"
                >
                  PDF
                </span>
                <div className="grid gap-1">
                  <p className="m-0 break-words text-lg font-semibold text-sophia-text">
                    {selectedFileDetails.name}
                  </p>
                  <p className="m-0 text-sm text-sophia-text-muted">
                    {selectedFileDetails.size}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-sophia-border px-4 py-2 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={isUploading}
                  onClick={(event) => {
                    event.stopPropagation()
                    removeSelectedFile()
                  }}
                >
                  Remove book
                </button>
              </div>
            ) : (
              <div className="grid max-w-[460px] justify-items-center gap-3">
                <span
                  className="grid h-14 w-14 place-items-center rounded-full border border-sophia-border bg-sophia-surface text-lg text-sophia-primary"
                  aria-hidden="true"
                >
                  +
                </span>
                <div className="grid gap-2">
                  <p className="m-0 text-lg font-semibold text-sophia-text">
                    Choose a philosophy book to begin your journey.
                  </p>
                  <p className="m-0 text-sm leading-6 text-sophia-text-muted">
                    Drag a PDF here, or click to browse your files.
                  </p>
                </div>
                <p className="m-0 text-xs font-semibold text-sophia-text-muted uppercase">
                  Supported: PDF - Max {config.maxPdfUploadMb} MB
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 border-t border-sophia-border pt-6 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-sophia-text">
              Title
              <input
                className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
                name="title"
                type="text"
                placeholder="Optional"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-sophia-text">
              Author
              <input
                className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
                name="author"
                type="text"
                placeholder="Optional"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-sophia-text sm:max-w-[260px]">
              Language
              <select
                className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
                name="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
              </select>
            </label>
          </div>

          {isUploading ? (
            <div className="grid gap-2" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-sophia-bg">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-sophia-primary" />
              </div>
              <p className="m-0 text-sm text-sophia-text-muted">
                Adding this book to your library...
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="m-0 rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 text-sm text-sophia-primary">
              {error}
            </p>
          ) : null}

          {status === 'success' ? (
            <p className="m-0 rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 text-sm text-sophia-text-muted">
              {uploadedBook?.title ?? 'This book'} is in your library.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-sophia-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm text-sophia-text-muted">
              Sophia will prepare the book for reading in a later step.
            </p>
            <button
              className="min-h-11 rounded-lg bg-sophia-primary px-5 font-bold text-sophia-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canUpload}
            >
              {isUploading ? 'Uploading...' : 'Add to Library'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
