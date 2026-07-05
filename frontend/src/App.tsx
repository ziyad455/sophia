import { GuestRoute } from './routing/GuestRoute'
import { ProtectedRoute } from './routing/ProtectedRoute'
import { useRouteLocation } from './routing/navigation'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PrivatePlaceholderPage } from './pages/PrivatePlaceholderPage'
import { PublicHomePage } from './pages/PublicHomePage'
import { RegisterPage } from './pages/RegisterPage'

type PrivatePlaceholderRoute = {
  eyebrow: string
  title: string
  description: string
}

const protectedPlaceholderRoutes: Record<string, PrivatePlaceholderRoute> = {
  '/upload': {
    eyebrow: 'Library',
    title: 'Upload',
    description: 'Book upload will live here when the reading library is connected.',
  },
  '/settings': {
    eyebrow: 'Account',
    title: 'Settings',
    description: 'Reader preferences and account controls will live here.',
  },
  '/profile': {
    eyebrow: 'Reader',
    title: 'Profile',
    description: 'Your reading identity and reflection history will live here.',
  },
}

const readerRoutePattern = /^\/reader\/[^/]+$/

function normalizePathname(pathname: string) {
  if (pathname === '/') {
    return pathname
  }

  return pathname.replace(/\/+$/, '')
}

function App() {
  const location = useRouteLocation()
  const pathname = normalizePathname(location.pathname)

  if (pathname === '/') {
    return <PublicHomePage />
  }

  if (pathname === '/login') {
    return (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    )
  }

  if (pathname === '/register') {
    return (
      <GuestRoute>
        <RegisterPage />
      </GuestRoute>
    )
  }

  if (pathname === '/library') {
    return (
      <ProtectedRoute>
        <LibraryPage />
      </ProtectedRoute>
    )
  }

  if (readerRoutePattern.test(pathname)) {
    return (
      <ProtectedRoute>
        {/* TODO: Replace with the reader page once user_books routes exist. */}
        <LibraryPage />
      </ProtectedRoute>
    )
  }

  const protectedPlaceholder = protectedPlaceholderRoutes[pathname]

  if (protectedPlaceholder) {
    return (
      <ProtectedRoute>
        <PrivatePlaceholderPage
          eyebrow={protectedPlaceholder.eyebrow}
          title={protectedPlaceholder.title}
          description={protectedPlaceholder.description}
        />
      </ProtectedRoute>
    )
  }

  return <NotFoundPage />
}

export default App
