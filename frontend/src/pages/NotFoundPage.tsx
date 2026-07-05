export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-sophia-bg px-5 py-10 text-sophia-text">
      <section className="grid max-w-[520px] gap-4 rounded-lg border border-sophia-border bg-sophia-surface p-6 text-center">
        <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
          Sophia
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-normal">Page not found</h1>
        <p className="m-0 text-sophia-text-muted">
          This path is not part of the reading room yet.
        </p>
        <a className="font-semibold text-sophia-primary" href="/library">
          Return to library
        </a>
      </section>
    </main>
  )
}
