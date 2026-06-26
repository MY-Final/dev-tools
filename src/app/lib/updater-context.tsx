import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// Web version: updater is not available, provide no-op implementations

const UpdaterContext = createContext<{
  status: UpdateStatus
  version: string
  isChecking: boolean
  isDownloading: boolean
  isAvailable: boolean
  isDownloaded: boolean
  hasError: boolean
  releaseNotes?: string
  releaseDate?: string
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => Promise<void>
} | null>(null)

export function UpdaterProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<UpdateStatus>({ type: 'idle' })
  const [version] = useState('1.0.11 (Web)')

  const checkForUpdates = useCallback(async () => {
    setStatus({ type: 'not-available' })
  }, [])

  const downloadUpdate = useCallback(async () => {
    // No-op in web version
  }, [])

  const quitAndInstall = useCallback(async () => {
    // No-op in web version
  }, [])

  return (
    <UpdaterContext.Provider
      value={{
        status,
        version,
        releaseNotes: status.type === 'available' ? status.releaseNotes : undefined,
        releaseDate: status.type === 'available' ? status.releaseDate : undefined,
        isChecking: status.type === 'checking',
        isDownloading: status.type === 'downloading',
        isAvailable: status.type === 'available',
        isDownloaded: status.type === 'downloaded',
        hasError: status.type === 'error',
        checkForUpdates,
        downloadUpdate,
        quitAndInstall
      }}
    >
      {children}
    </UpdaterContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUpdater() {
  const context = useContext(UpdaterContext)
  if (!context) {
    throw new Error('useUpdater must be used within an UpdaterProvider')
  }
  return context
}

// Initialize window.updater with no-op implementations
window.updater = {
  checkForUpdates: async () => ({ type: 'not-available' }),
  downloadUpdate: async () => {},
  quitAndInstall: async () => {},
  getVersion: async () => '1.0.11 (Web)',
  onUpdateStatus: () => () => {}
}
