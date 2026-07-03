export type PublicUser = {
  id: string
  email: string
  displayName?: string | null
  avatarUrl?: string | null
  emailVerifiedAt?: string | null
  createdAt?: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  password: string
  displayName?: string
}

export type AuthState = {
  user: PublicUser | null
  loading: boolean
  error: string | null
}

export type AuthContextValue = AuthState & {
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<PublicUser>
  register: (payload: RegisterPayload) => Promise<PublicUser>
  logout: () => Promise<void>
  refreshSession: () => Promise<PublicUser | null>
  clearError: () => void
}

export type AuthResponse = {
  user: PublicUser
}
