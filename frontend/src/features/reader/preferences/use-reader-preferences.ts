import { useContext } from 'react'
import { ReaderPreferencesContext } from './reader-preferences-context'

export function useReaderPreferences() {
  const context = useContext(ReaderPreferencesContext)

  if (!context) {
    throw new Error(
      'useReaderPreferences must be used within a ReaderPreferencesProvider.',
    )
  }

  return context
}
