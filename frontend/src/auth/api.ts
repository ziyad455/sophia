import { config } from '../config'
import type { AuthResponse, LoginPayload, PublicUser, RegisterPayload } from './types'

type RequestOptions = {
  body?: unknown
  signal?: AbortSignal
}

export class AuthApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

function authUrl(path: string): string {
  return `${config.apiBaseUrl}${path}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const message = value.message
  return typeof message === 'string' && message.trim() ? message : undefined
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    return undefined
  }

  return response.json()
}

async function request<TResponse>(
  path: string,
  method: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  let response: Response

  try {
    response = await fetch(authUrl(path), {
      method,
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new AuthApiError(0, 'Unable to reach Sophia. Check your connection and try again.')
  }

  const data = await readJson(response)

  if (!response.ok) {
    throw new AuthApiError(
      response.status,
      readErrorMessage(data) ?? 'Authentication request failed.',
    )
  }

  return data as TResponse
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', 'POST', { body: payload })
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', 'POST', { body: payload })
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', 'POST')
}

export async function refreshSession(): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/refresh', 'POST')
}

export async function getCurrentUser(options: { signal?: AbortSignal } = {}): Promise<PublicUser> {
  const response = await request<AuthResponse>('/auth/me', 'GET', {
    signal: options.signal,
  })

  return response.user
}
