import type { ReactNode } from 'react'

type AuthPageLayoutProps = {
  children: ReactNode
  eyebrow: string
  title: string
}

export function AuthPageLayout({ children, eyebrow, title }: AuthPageLayoutProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-sophia-bg px-5 py-10 text-sophia-text">
      <section className="grid w-full max-w-[420px] gap-7 rounded-lg border border-sophia-border bg-sophia-surface p-6 shadow-[0_22px_60px_rgb(0_0_0_/_18%)] sm:p-8">
        <header>
          <p className="printed-gold m-0 text-xs leading-none font-bold tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 mb-0 text-3xl leading-tight font-semibold tracking-normal text-sophia-text">
            {title}
          </h1>
        </header>
        {children}
      </section>
    </main>
  )
}
