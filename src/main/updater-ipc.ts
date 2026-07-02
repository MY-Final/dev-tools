import { ipcMain } from 'electron'
import {
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getCurrentVersion
} from './updater'

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => quitAndInstall())
  ipcMain.handle('updater:get-version', () => getCurrentVersion())
}
