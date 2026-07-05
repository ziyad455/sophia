export function AuthLoading() {
  return (
    <main className="grid min-h-svh place-items-center bg-sophia-bg px-6 text-sophia-text">
      <div className="grid justify-items-center gap-4 text-center">
        <span
          className="h-9 w-9 animate-spin rounded-full border-2 border-sophia-border border-t-sophia-primary"
          aria-hidden="true"
        />
        <p className="m-0 text-sm font-semibold tracking-normal text-sophia-text-muted">
          Loading Sophia...
        </p>
      </div>
    </main>
  )
}
