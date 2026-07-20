import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import type { NoteEditorState } from './note.types'
import { MAX_NOTE_CONTENT_LENGTH } from './note.types'
import {
  newNoteSourceLabel,
  noteQuotePreview,
  noteSourceLabel,
} from './note.utils'

type NoteEditorProps = {
  state: NoteEditorState
  saving: boolean
  onSave: (content: string) => Promise<void>
  onClose: () => void
}

const focusableSelector =
  'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function NoteEditor({
  state,
  saving,
  onSave,
  onClose,
}: NoteEditorProps) {
  const [content, setContent] = useState(
    state.mode === 'edit' ? state.note.content : '',
  )
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const savingRef = useRef(saving)
  const titleId = useId()
  savingRef.current = saving

  const descriptionId = useId()
  const errorId = useId()
  const source = state.mode === 'create' ? state.source : state.note
  const contextLabel = state.mode === 'create'
    ? newNoteSourceLabel(state.source)
    : noteSourceLabel(state.note)
  const quote = noteQuotePreview(source)
  const trimmedContent = content.trim()
  const canSave =
    trimmedContent.length > 0 &&
    trimmedContent.length <= MAX_NOTE_CONTENT_LENGTH &&
    !saving

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()

        if (!savingRef.current) {
          onClose()
        }
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ]

      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown, true)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!trimmedContent) {
      setError('Write a thought before saving.')
      textareaRef.current?.focus()
      return
    }

    if (trimmedContent.length > MAX_NOTE_CONTENT_LENGTH) {
      setError(
        'Keep this note within ' +
          MAX_NOTE_CONTENT_LENGTH.toLocaleString() +
          ' characters.',
      )
      textareaRef.current?.focus()
      return
    }

    setError(null)

    try {
      await onSave(content)
    } catch {
      setError('We could not save this note. Your text is still here.')
      textareaRef.current?.focus()
    }
  }

  function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/55 sm:grid sm:place-items-center sm:px-5 sm:py-8"
      data-note-editor
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose()
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="absolute inset-0 flex max-h-[100dvh] flex-col overflow-hidden bg-sophia-surface text-sophia-text shadow-2xl focus:outline-none sm:static sm:max-h-[min(80dvh,680px)] sm:w-full sm:max-w-[560px] sm:rounded-2xl sm:border sm:border-sophia-border"
        onKeyDown={keepFocusInside}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-sophia-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-sophia-primary">
              {contextLabel}
            </p>
            <h2 id={titleId} className="mb-0 mt-1 text-lg font-semibold">
              {state.mode === 'edit' ? 'Edit your note' : 'Write a private note'}
            </h2>
            <p id={descriptionId} className="mb-0 mt-1 text-xs leading-5 text-sophia-text-muted">
              Only you can see this reflection.
            </p>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:opacity-50"
            onClick={onClose}
            disabled={saving}
            aria-label="Close note editor"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
            {quote ? (
              <blockquote className="m-0 line-clamp-4 rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 text-sm leading-6 text-sophia-text-muted">
                “{quote}”
              </blockquote>
            ) : null}

            <label
              className="flex min-h-0 flex-1 flex-col gap-2 text-sm font-semibold"
              htmlFor={titleId + '-content'}
            >
              Your note
              <textarea
                ref={textareaRef}
                id={titleId + '-content'}
                className="min-h-48 w-full flex-1 resize-none rounded-lg border border-sophia-border bg-sophia-bg px-4 py-3 text-base font-normal leading-6 text-sophia-text outline-none focus:border-sophia-primary focus:ring-2 focus:ring-sophia-primary/30"
                value={content}
                maxLength={MAX_NOTE_CONTENT_LENGTH}
                onChange={(event) => {
                  setContent(event.target.value)
                  if (error) setError(null)
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                placeholder="What matters here?"
              />
            </label>

            <div className="flex items-start justify-between gap-4 text-xs text-sophia-text-muted">
              <p
                id={errorId}
                className="m-0 min-h-5 leading-5 text-sophia-primary"
                role={error ? 'alert' : undefined}
              >
                {error}
              </p>
              <span className="shrink-0" aria-label={content.length + ' characters'}>
                {content.length.toLocaleString()} / {MAX_NOTE_CONTENT_LENGTH.toLocaleString()}
              </span>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-sophia-border bg-sophia-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <button
              type="button"
              className="min-h-11 rounded-lg border border-sophia-border px-5 text-sm font-semibold text-sophia-text hover:border-sophia-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:opacity-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-lg bg-sophia-primary px-5 text-sm font-bold text-sophia-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-sophia-primary disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!canSave}
              aria-label={saving ? 'Saving note' : 'Save note'}
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {saving ? 'Saving' : 'Save'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
