import { GuestRoute } from './routing/GuestRoute'
import { ProtectedRoute } from './routing/ProtectedRoute'
import { useRouteLocation } from './routing/navigation'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PrivatePlaceholderPage } from './pages/PrivatePlaceholderPage'
import { PublicHomePage } from './pages/PublicHomePage'
import { ReaderPage } from './pages/ReaderPage'
import { RegisterPage } from './pages/RegisterPage'
import { UploadPage } from './pages/UploadPage'

type PrivatePlaceholderRoute = {
  eyebrow: string
  title: string
  description: string
}

const protectedPlaceholderRoutes: Record<string, PrivatePlaceholderRoute> = {
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

  if (pathname === '/upload') {
    return (
      <ProtectedRoute>
        <UploadPage />
      </ProtectedRoute>
    )
  }

  if (readerRoutePattern.test(pathname)) {
    const userBookId = decodeURIComponent(pathname.slice('/reader/'.length))

    return (
      <ProtectedRoute>
        <ReaderPage key={userBookId} userBookId={userBookId} />
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
