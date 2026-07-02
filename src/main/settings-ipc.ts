import { ipcMain } from 'electron'
import { settingsStore, type AppSettings } from './settings'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => settingsStore.getSettings())
  ipcMain.handle('settings:get-appearance', () => settingsStore.getAppearance())
  ipcMain.handle('settings:get-editor', () => settingsStore.getEditor())
  ipcMain.handle('settings:update-appearance', (_event, updates: Partial<AppSettings['appearance']>) => settingsStore.updateAppearance(updates))
  ipcMain.handle('settings:update-editor', (_event, updates: Partial<AppSettings['editor']>) => settingsStore.updateEditor(updates))
  ipcMain.handle('settings:reset', () => settingsStore.resetToDefaults())
  ipcMain.handle('settings:update-updater', (_event, updates: Partial<AppSettings['updater']>) => settingsStore.updateUpdater(updates))
  ipcMain.handle('settings:get-npm-registry', () => settingsStore.getSettings().npmRegistry)
  ipcMain.handle('settings:update-npm-registry', (_event, npmRegistry: string) => settingsStore.updateNpmRegistry(npmRegistry))
  ipcMain.handle('settings:get-maven-search-url', () => settingsStore.getSettings().mavenSearchUrl)
  ipcMain.handle('settings:update-maven-search-url', (_event, url: string) => settingsStore.updateMavenSearchUrl(url))
  ipcMain.handle('settings:get-proxy', () => settingsStore.getSettings().proxy)
  ipcMain.handle('settings:update-proxy', (_event, updates: Partial<{ enabled: boolean; url: string }>) => settingsStore.updateProxy(updates))
  ipcMain.handle('settings:update-shortcuts', (_event, updates: Partial<AppSettings['shortcuts']>) => settingsStore.updateShortcuts(updates))
  ipcMain.handle('settings:update-favorites', (_event, toolId: string) => settingsStore.updateFavorites(toolId))
  ipcMain.handle('settings:get-path', () => settingsStore.getFilePath())
  ipcMain.handle('settings:get-translator', () => settingsStore.getTranslator())
  ipcMain.handle('settings:update-translator', (_event, updates: Partial<AppSettings['translator']>) => settingsStore.updateTranslator(updates))
}
