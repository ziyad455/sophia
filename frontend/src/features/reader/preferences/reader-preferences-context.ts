import { createContext } from 'react'
import type {
  ReaderPreferences,
  ReaderPreferencesUpdate,
} from './reader-preferences.types'

export type ReaderPreferencesContextValue = {
  preferences: ReaderPreferences
  loading: boolean
  saving: boolean
  error: string | null
  updatePreferences: (update: ReaderPreferencesUpdate) => void
  resetPreferences: () => void
}

export const ReaderPreferencesContext =
  createContext<ReaderPreferencesContextValue | undefined>(undefined)
