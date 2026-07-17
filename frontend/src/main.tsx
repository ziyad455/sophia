import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth'
import { ReaderPreferencesProvider } from './features/reader/preferences'
import { applyStoredTheme } from './theme'

applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ReaderPreferencesProvider>
        <App />
      </ReaderPreferencesProvider>
    </AuthProvider>
  </StrictMode>,
)
