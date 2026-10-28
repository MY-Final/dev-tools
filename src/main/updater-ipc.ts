import {
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getCurrentVersion
} from './updater'
import { registerGuardedHandler } from './ipc-security'

export function registerUpdaterHandlers(): void {
  registerGuardedHandler('updater:check', () => checkForUpdates())
  registerGuardedHandler('updater:download', () => downloadUpdate())
  registerGuardedHandler('updater:install', () => quitAndInstall())
  registerGuardedHandler('updater:get-version', () => getCurrentVersion())
}
