import { useEffect, useState } from 'react'
import { config } from './config'

type ApiStatus = 'checking' | 'online' | 'offline'

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')

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

  return (
    <main className="grid min-h-svh grid-cols-1 bg-[#f6f2ea] text-[#514b43] lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(260px,340px)]">
      <aside
        className="min-w-0 border-b border-[#d8cfbf] bg-[#eee8dc] p-5 lg:border-r lg:border-b-0 lg:p-7"
        aria-label="Library"
      >
        <div>
          <p className="m-0 text-xs leading-none font-bold tracking-[0.08em] text-[#817567] uppercase">
            Sophia
          </p>
          <h1 className="mt-2 mb-0 text-3xl leading-tight font-semibold tracking-normal text-[#201c18]">
            Library
          </h1>
        </div>

        <nav
          className="mt-7 grid gap-2 sm:grid-cols-3 lg:grid-cols-1"
          aria-label="Books"
        >
          <a
            className="grid gap-1 rounded-lg border border-[#b7a88f] bg-[#faf7f0] p-3 text-[#514b43] no-underline"
            href="#reader"
          >
            <span className="font-bold text-[#201c18]">The Myth of Sisyphus</span>
            <small className="text-[#817567]">Albert Camus</small>
          </a>
          <a
            className="grid gap-1 rounded-lg border border-transparent p-3 text-[#514b43] no-underline hover:border-[#b7a88f] hover:bg-[#faf7f0]"
            href="#reader"
          >
            <span className="font-bold text-[#201c18]">Meditations</span>
            <small className="text-[#817567]">Marcus Aurelius</small>
          </a>
          <a
            className="grid gap-1 rounded-lg border border-transparent p-3 text-[#514b43] no-underline hover:border-[#b7a88f] hover:bg-[#faf7f0]"
            href="#reader"
          >
            <span className="font-bold text-[#201c18]">Beyond Good and Evil</span>
            <small className="text-[#817567]">Friedrich Nietzsche</small>
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
            <p className="m-0 text-xs leading-none font-bold tracking-[0.08em] text-[#817567] uppercase">
              Reading now
            </p>
            <h2 className="mt-2 mb-0 text-2xl leading-tight font-semibold tracking-normal text-[#201c18]">
              The Myth of Sisyphus
            </h2>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-2 text-xs leading-none font-bold tracking-normal uppercase ${
              apiStatus === 'online'
                ? 'border-[#8ab39b] text-[#2f6f4f]'
                : apiStatus === 'offline'
                  ? 'border-[#c99089] text-[#9b3d35]'
                  : 'border-[#d8cfbf] text-[#817567]'
            }`}
          >
            API {apiStatus}
          </span>
        </header>

        <article className="mx-auto w-full max-w-[720px] rounded-lg border border-[#d8cfbf] bg-[#fffdf8] p-7 shadow-[0_18px_50px_rgb(42_34_25_/_10%)] sm:p-12 lg:p-16">
          <p className="m-0 text-xs leading-none font-bold tracking-[0.08em] text-[#817567] uppercase">
            Absurd Reasoning
          </p>
          <p className="mt-6 mb-0 font-serif text-[19px] leading-[1.75] tracking-normal text-[#29231d] sm:text-[22px]">
            The first movement of the mind is to distinguish what is true from
            what is false. Yet the appetite for clarity meets a world that does
            not answer in the same language.
          </p>
          <p className="mt-6 mb-0 font-serif text-[19px] leading-[1.75] tracking-normal text-[#29231d] sm:text-[22px]">
            Sophia keeps the page quiet, the question close, and the reader in
            command of the passage.
          </p>
        </article>
      </section>

      <aside
        className="grid min-w-0 content-start gap-5 border-t border-[#d8cfbf] bg-[#eee8dc] p-5 lg:border-t-0 lg:border-l lg:p-7"
        aria-label="Companion"
      >
        <header>
          <p className="m-0 text-xs leading-none font-bold tracking-[0.08em] text-[#817567] uppercase">
            Companion
          </p>
          <h2 className="mt-2 mb-0 text-2xl leading-tight font-semibold tracking-normal text-[#201c18]">
            Passage Notes
          </h2>
        </header>

        <div className="border-t border-[#d8cfbf] pt-5">
          <h3 className="mt-0 mb-2 text-[15px] font-semibold tracking-normal text-[#201c18]">
            Current question
          </h3>
          <p className="m-0 text-[#514b43]">
            What does Camus mean by a demand for clarity?
          </p>
        </div>

        <div className="border-t border-[#d8cfbf] pt-5">
          <h3 className="mt-0 mb-2 text-[15px] font-semibold tracking-normal text-[#201c18]">
            Reading memory
          </h3>
          <p className="m-0 text-[#514b43]">
            Recurring theme: tension between reason, meaning, and silence.
          </p>
        </div>
      </aside>
    </main>
  )
}

export default App
