import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from './api'
import { AuthApiError } from './api'
import { AuthContext } from './auth-context'
import type { AuthContextValue, LoginPayload, PublicUser, RegisterPayload } from './types'

type AuthProviderProps = {
  children: ReactNode
}

function toAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    return error.message
  }

  return 'Something went wrong while checking your session.'
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)

    authApi
      .getCurrentUser({ signal: controller.signal })
      .then((currentUser) => {
        setUser(currentUser)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return
        }

        setUser(null)

        if (requestError instanceof AuthApiError && requestError.status === 401) {
          setError(null)
          return
        }

        setError(toAuthErrorMessage(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    try {
      const response = await authApi.login(payload)
      setUser(response.user)
      setError(null)
      return response.user
    } catch (requestError) {
      const message = toAuthErrorMessage(requestError)
      setError(message)
      throw requestError
    }
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const response = await authApi.register(payload)
      setUser(response.user)
      setError(null)
      return response.user
    } catch (requestError) {
      const message = toAuthErrorMessage(requestError)
      setError(message)
      throw requestError
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (requestError) {
      if (!(requestError instanceof AuthApiError) || requestError.status !== 401) {
        setError(toAuthErrorMessage(requestError))
      }
    } finally {
      setUser(null)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const response = await authApi.refreshSession()
      setUser(response.user)
      setError(null)
      return response.user
    } catch (requestError) {
      setUser(null)

      if (requestError instanceof AuthApiError && requestError.status === 401) {
        setError(null)
      } else {
        setError(toAuthErrorMessage(requestError))
      }

      return null
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshSession,
      clearError,
    }),
    [clearError, error, loading, login, logout, refreshSession, register, user],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
