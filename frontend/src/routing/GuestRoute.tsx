import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import { AuthLoading } from './AuthLoading'
import { Navigate } from './Navigate'
import { getSafeRedirectPath, useRouteLocation } from './navigation'

type GuestRouteProps = {
  children: ReactNode
}

export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const location = useRouteLocation()

  if (loading) {
    return <AuthLoading />
  }

  if (isAuthenticated) {
    return <Navigate replace to={getSafeRedirectPath(location.search)} />
  }

  return <>{children}</>
}
