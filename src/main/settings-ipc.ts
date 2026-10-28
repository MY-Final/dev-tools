import { settingsStore, type AppSettings } from './settings'
import { registerGuardedHandler } from './ipc-security'

export function registerSettingsHandlers(): void {
  registerGuardedHandler('settings:get', () => settingsStore.getSettings())
  registerGuardedHandler('settings:get-appearance', () => settingsStore.getAppearance())
  registerGuardedHandler('settings:get-editor', () => settingsStore.getEditor())
  registerGuardedHandler('settings:update-appearance', (_event, updates: Partial<AppSettings['appearance']>) => settingsStore.updateAppearance(updates))
  registerGuardedHandler('settings:update-editor', (_event, updates: Partial<AppSettings['editor']>) => settingsStore.updateEditor(updates))
  registerGuardedHandler('settings:reset', () => settingsStore.resetToDefaults())
  registerGuardedHandler('settings:update-updater', (_event, updates: Partial<AppSettings['updater']>) => settingsStore.updateUpdater(updates))
  registerGuardedHandler('settings:update-window', (_event, updates: Partial<AppSettings['window']>) => settingsStore.updateWindow(updates))
  registerGuardedHandler('settings:get-npm-registry', () => settingsStore.getSettings().npmRegistry)
  registerGuardedHandler('settings:update-npm-registry', (_event, npmRegistry: string) => settingsStore.updateNpmRegistry(npmRegistry))
  registerGuardedHandler('settings:get-maven-search-url', () => settingsStore.getSettings().mavenSearchUrl)
  registerGuardedHandler('settings:update-maven-search-url', (_event, url: string) => settingsStore.updateMavenSearchUrl(url))
  registerGuardedHandler('settings:get-proxy', () => settingsStore.getSettings().proxy)
  registerGuardedHandler('settings:update-proxy', (_event, updates: Partial<{ enabled: boolean; url: string }>) => settingsStore.updateProxy(updates))
  registerGuardedHandler('settings:update-shortcuts', (_event, updates: Partial<AppSettings['shortcuts']>) => settingsStore.updateShortcuts(updates))
  registerGuardedHandler('settings:update-favorites', (_event, toolId: string) => settingsStore.updateFavorites(toolId))
  registerGuardedHandler('settings:get-path', () => settingsStore.getFilePath())
  registerGuardedHandler('settings:get-translator', () => settingsStore.getTranslator())
  registerGuardedHandler('settings:update-translator', (_event, updates: Partial<AppSettings['translator']>) => settingsStore.updateTranslator(updates))
}
