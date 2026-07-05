import { useAuth } from '../auth'

export function PublicHomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <main className="grid min-h-svh place-items-center bg-sophia-bg px-5 py-10 text-sophia-text">
      <section className="grid w-full max-w-[680px] gap-7 text-center">
        <header>
          <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
            Sophia
          </p>
          <h1 className="mt-4 mb-0 text-4xl leading-tight font-semibold tracking-normal text-sophia-text sm:text-5xl">
            Your AI Philosophy Companion
          </h1>
        </header>

        <p className="m-0 mx-auto max-w-[560px] text-lg leading-8 text-sophia-text-muted">
          A quiet place to read, understand, and return to philosophical ideas.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <a
            className="rounded-lg bg-sophia-primary px-5 py-3 font-bold text-sophia-bg no-underline"
            href={isAuthenticated ? '/library' : '/login'}
          >
            {isAuthenticated ? 'Open library' : 'Sign in'}
          </a>
          {!isAuthenticated ? (
            <a
              className="rounded-lg border border-sophia-border px-5 py-3 font-bold text-sophia-text no-underline"
              href="/register"
            >
              Create account
            </a>
          ) : null}
        </div>
      </section>
    </main>
  )
}
