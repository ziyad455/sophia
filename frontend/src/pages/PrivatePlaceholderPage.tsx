import { useAuth } from '../auth'
import { navigate } from '../routing/navigation'

type PrivatePlaceholderPageProps = {
  eyebrow: string
  title: string
  description: string
}

export function PrivatePlaceholderPage({ description, eyebrow, title }: PrivatePlaceholderPageProps) {
  const { logout, user } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="grid min-h-svh place-items-center bg-sophia-bg px-5 py-10 text-sophia-text">
      <section className="grid w-full max-w-[620px] gap-6 rounded-lg border border-sophia-border bg-sophia-surface p-6 sm:p-8">
        <header>
          <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 mb-0 text-3xl leading-tight font-semibold tracking-normal text-sophia-text">
            {title}
          </h1>
        </header>

        <p className="m-0 text-sophia-text-muted">{description}</p>

        <div className="flex flex-wrap items-center gap-3 border-t border-sophia-border pt-5">
          <span className="text-sm text-sophia-text-muted">{user?.email}</span>
          <a className="rounded-lg border border-sophia-border px-4 py-2 text-sm font-semibold text-sophia-text no-underline" href="/library">
            Library
          </a>
          <button
            className="rounded-lg border border-sophia-border px-4 py-2 text-sm font-semibold text-sophia-text"
            type="button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  )
}
