import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { getSafeRedirectPath, navigate, useRouteLocation } from '../routing/navigation'
import { AuthPageLayout } from './AuthPageLayout'

export function RegisterPage() {
  const { clearError, error, register } = useAuth()
  const location = useRouteLocation()
  const redirectTo = useMemo(() => getSafeRedirectPath(location.search), [location.search])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const displayName = String(formData.get('displayName') ?? '').trim()

    setSubmitting(true)
    setFormError(null)
    clearError()

    try {
      await register({
        email,
        password,
        displayName: displayName || undefined,
      })
      navigate(redirectTo, { replace: true })
    } catch {
      setFormError('Unable to create that account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageLayout eyebrow="Begin reading" title="Create account">
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold text-sophia-text">
          Name
          <input
            className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
            name="displayName"
            type="text"
            autoComplete="name"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-sophia-text">
          Email
          <input
            className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-sophia-text">
          Password
          <input
            className="min-h-11 rounded-lg border border-sophia-border bg-sophia-bg px-3 text-base font-normal text-sophia-text outline-none focus:border-sophia-primary"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        {formError || error ? (
          <p className="m-0 text-sm text-sophia-primary">{formError ?? error}</p>
        ) : null}

        <button
          className="min-h-11 rounded-lg bg-sophia-primary px-4 font-bold text-sophia-bg disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="m-0 text-sm text-sophia-text-muted">
        Already have an account?{' '}
        <a className="font-semibold text-sophia-primary" href="/login">
          Sign in
        </a>
      </p>
    </AuthPageLayout>
  )
}
