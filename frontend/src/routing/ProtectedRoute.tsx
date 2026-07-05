import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import { AuthLoading } from './AuthLoading'
import { Navigate } from './Navigate'
import { createLoginRedirect, useRouteLocation } from './navigation'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const location = useRouteLocation()

  if (loading) {
    return <AuthLoading />
  }

  if (!isAuthenticated) {
    return <Navigate replace to={createLoginRedirect(location)} />
  }

  return <>{children}</>
}
