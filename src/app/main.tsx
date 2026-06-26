import './assets/main.css'

// Initialize web APIs (replaces Electron IPC)
import './lib/web-apis'
import './lib/contexts'
import './lib/updater-context'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
