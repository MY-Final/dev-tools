import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { settingsStore } from './settings'

export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

let mainWindow: BrowserWindow | null = null

function sendStatus(status: UpdateStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', status)
  }
}

export function initUpdater(window: BrowserWindow): void {
  mainWindow = window

  // Don't auto-download — let the user decide
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      type: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ type: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({ type: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (error) => {
    sendStatus({ type: 'error', message: error.message })
  })
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  let status: UpdateStatus = { type: 'not-available' }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const latest = result.updateInfo.version
      const current = autoUpdater.currentVersion.toString()
      // Only report as available if the remote version is actually newer
      if (latest !== current) {
        status = {
          type: 'available',
          version: latest,
          releaseDate: result.updateInfo.releaseDate,
          releaseNotes:
            typeof result.updateInfo.releaseNotes === 'string'
              ? result.updateInfo.releaseNotes
              : undefined
        }
      }
    }
  } catch (err) {
    status = { type: 'error', message: (err as Error).message }
  }
  sendStatus(status)
  return status
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}

export function getCurrentVersion(): string {
  return autoUpdater.currentVersion.toString()
}

export function shouldAutoCheck(): boolean {
  return settingsStore.getSettings().updater.autoCheck
}
