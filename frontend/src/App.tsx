import { useEffect, useState } from 'react'
import { config } from './config'

type ApiStatus = 'checking' | 'online' | 'offline'
type ThemeId = 'printed-ink' | 'warm-paper' | 'night-study'

const themes: Array<{ id: ThemeId; label: string }> = [
  { id: 'printed-ink', label: 'Printed Ink' },
  { id: 'warm-paper', label: 'Warm Paper' },
  { id: 'night-study', label: 'Night Study' },
]

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [theme, setTheme] = useState<ThemeId>('printed-ink')

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${config.apiBaseUrl}/health`, {
      signal: controller.signal,
    })
      .then((response) => {
        setApiStatus(response.ok ? 'online' : 'offline')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiStatus('offline')
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <main className="grid min-h-svh grid-cols-1 bg-sophia-bg text-sophia-text lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(260px,340px)]">
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
        </div>

        <nav
          className="mt-7 grid gap-2 sm:grid-cols-3 lg:grid-cols-1"
          aria-label="Books"
        >
          <a
            className="grid gap-1 rounded-lg border border-sophia-primary bg-sophia-bg p-3 text-sophia-text no-underline"
            href="#reader"
          >
            <span className="font-bold text-sophia-text">The Myth of Sisyphus</span>
            <small className="text-sophia-text-muted">Albert Camus</small>
          </a>
          <a
            className="grid gap-1 rounded-lg border border-transparent p-3 text-sophia-text no-underline hover:border-sophia-primary hover:bg-sophia-bg"
            href="#reader"
          >
            <span className="font-bold text-sophia-text">Meditations</span>
            <small className="text-sophia-text-muted">Marcus Aurelius</small>
          </a>
          <a
            className="grid gap-1 rounded-lg border border-transparent p-3 text-sophia-text no-underline hover:border-sophia-primary hover:bg-sophia-bg"
            href="#reader"
          >
            <span className="font-bold text-sophia-text">Beyond Good and Evil</span>
            <small className="text-sophia-text-muted">Friedrich Nietzsche</small>
          </a>
        </nav>
      </aside>

      <section
        id="reader"
        className="grid min-w-0 content-start gap-7 p-5 lg:grid-rows-[auto_1fr] lg:p-7"
        aria-label="Reader"
      >
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
              Reading now
            </p>
            <h2 className="mt-2 mb-0 text-2xl leading-tight font-semibold tracking-normal text-sophia-text">
              The Myth of Sisyphus
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex rounded-lg border border-sophia-border bg-sophia-surface p-1"
              role="group"
              aria-label="Theme"
            >
              {themes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-normal transition-colors ${
                    theme === themeOption.id
                      ? 'bg-sophia-primary text-sophia-bg'
                      : 'text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text'
                  }`}
                  aria-pressed={theme === themeOption.id}
                  onClick={() => setTheme(themeOption.id)}
                >
                  {themeOption.label}
                </button>
              ))}
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-2 text-xs leading-none font-bold tracking-normal uppercase ${
                apiStatus === 'online'
                  ? 'border-sophia-accent text-sophia-accent'
                  : apiStatus === 'offline'
                    ? 'border-sophia-primary text-sophia-primary'
                    : 'border-sophia-border text-sophia-text-muted'
              }`}
            >
              API {apiStatus}
            </span>
          </div>
        </header>

        <article className="paper-card mx-auto w-full max-w-[720px] rounded-lg p-7 shadow-[0_22px_60px_rgb(0_0_0_/_22%)] sm:p-12 lg:p-16">
          <p className="m-0 text-xs leading-none font-bold tracking-[0.08em] text-sophia-primary uppercase">
            Absurd Reasoning
          </p>
          <p className="mt-6 mb-0 font-serif text-[19px] leading-[1.75] tracking-normal text-sophia-paper-text sm:text-[22px]">
            The first movement of the mind is to distinguish what is true from
            what is false. Yet the appetite for clarity meets a world that does
            not answer in the same language.
          </p>
          <p className="mt-6 mb-0 font-serif text-[19px] leading-[1.75] tracking-normal text-sophia-paper-text sm:text-[22px]">
            Sophia keeps the page quiet, the question close, and the reader in
            command of the passage.
          </p>
        </article>
      </section>

      <aside
        className="grid min-w-0 content-start gap-5 border-t border-sophia-border bg-sophia-surface p-5 lg:border-t-0 lg:border-l lg:p-7"
        aria-label="Companion"
      >
        <header>
          <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
            Companion
          </p>
          <h2 className="mt-2 mb-0 text-2xl leading-tight font-semibold tracking-normal text-sophia-text">
            Passage Notes
          </h2>
        </header>

        <div className="border-t border-sophia-border pt-5">
          <h3 className="mt-0 mb-2 text-[15px] font-semibold tracking-normal text-sophia-text">
            Current question
          </h3>
          <p className="m-0 text-sophia-text-muted">
            What does Camus mean by a demand for clarity?
          </p>
        </div>

        <div className="border-t border-sophia-border pt-5">
          <h3 className="mt-0 mb-2 text-[15px] font-semibold tracking-normal text-sophia-text">
            Reading memory
          </h3>
          <p className="m-0 text-sophia-text-muted">
            Recurring theme: tension between reason, meaning, and silence.
          </p>
        </div>
      </aside>
    </main>
  )
}

export default App
