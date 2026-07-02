import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface AppSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system'
    fontSize: 'small' | 'medium' | 'large'
    sidebarCollapsed: boolean
    showSidebarShortDesc: boolean
  }
  editor: {
    jsonIndent: 2 | 4
    autoCopy: boolean
    timestampFormat: 'seconds' | 'milliseconds'
  }
  updater: {
    autoCheck: boolean
  }
  translator: {
    baseUrl: string
    apiKey: string
    model: string
    systemPrompt: string
    temperature: number
    maxTokens: number
  }
  npmRegistry: string
  mavenSearchUrl: string
  proxy: {
    enabled: boolean
    url: string
  }
  shortcuts: {
    toggleSidebar: string
    openSettings: string
    goHome: string
  }
  favorites: string[]
}

export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

// Settings API
const settingsAPI = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  getAppearance: (): Promise<AppSettings['appearance']> =>
    ipcRenderer.invoke('settings:get-appearance'),
  getEditor: (): Promise<AppSettings['editor']> => ipcRenderer.invoke('settings:get-editor'),
  updateAppearance: (updates: Partial<AppSettings['appearance']>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-appearance', updates),
  updateEditor: (updates: Partial<AppSettings['editor']>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-editor', updates),
  updateUpdater: (updates: Partial<AppSettings['updater']>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-updater', updates),
  getTranslator: (): Promise<AppSettings['translator']> =>
    ipcRenderer.invoke('settings:get-translator'),
  updateTranslator: (updates: Partial<AppSettings['translator']>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-translator', updates),
  getNpmRegistry: (): Promise<string> =>
    ipcRenderer.invoke('settings:get-npm-registry'),
  updateNpmRegistry: (npmRegistry: string): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-npm-registry', npmRegistry),
  getMavenSearchUrl: (): Promise<string> =>
    ipcRenderer.invoke('settings:get-maven-search-url'),
  updateMavenSearchUrl: (url: string): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-maven-search-url', url),
  getProxy: (): Promise<{ enabled: boolean; url: string }> =>
    ipcRenderer.invoke('settings:get-proxy'),
  updateProxy: (updates: Partial<{ enabled: boolean; url: string }>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-proxy', updates),
  updateShortcuts: (updates: Partial<AppSettings['shortcuts']>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-shortcuts', updates),
  updateFavorites: (toolId: string): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update-favorites', toolId),
  getSettingsPath: (): Promise<string> =>
    ipcRenderer.invoke('settings:get-path'),
  resetToDefaults: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset')
}

// Updater API
const updaterAPI = {
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:check'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('updater:download'),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke('updater:install'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
      callback(status)
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  }
}

// Maven API (proxied through main process)
const mavenAPI = {
  searchArtifacts: (query: string, rows: number): Promise<unknown> =>
    ipcRenderer.invoke('maven:search', query, rows),
  getVersions: (groupId: string, artifactId: string): Promise<unknown> =>
    ipcRenderer.invoke('maven:versions', groupId, artifactId)
}

// Environment Variables API
const envAPI = {
  getEnvVars: (): Promise<Record<string, string>> => ipcRenderer.invoke('env:get-vars')
}

interface NpmSearchResult {
  name: string
  version: string
  description: string
  keywords: string[]
  publisher: string
  link: string
  date: string
}

interface NpmPackageDetail {
  name: string
  description: string
  license: string
  homepage: string
  repository: string
  keywords: string[]
  maintainers: string[]
  versions: string[]
}

// Translator API (proxied through main process)
const translatorAPI = {
  translate: (text: string, sourceLang: string, targetLang: string): Promise<{ translation?: string; error?: string }> =>
    ipcRenderer.invoke('translator:translate', text, sourceLang, targetLang),
  testConnection: (): Promise<{ success?: boolean; models?: string[]; error?: string }> =>
    ipcRenderer.invoke('translator:test-connection')
}

// npm API (proxied through main process)
const npmAPI = {
  search: (query: string, size?: number): Promise<NpmSearchResult[]> =>
    ipcRenderer.invoke('npm:search', query, size || 20),
  getPackage: (name: string): Promise<NpmPackageDetail | null> =>
    ipcRenderer.invoke('npm:package', name)
}

interface DockerSearchResult {
  name: string
  description: string
  stars: number
  pulls: number
  isOfficial: boolean
  isAutomated: boolean
  imageName: string
}

// Docker API (proxied through main process)
const dockerAPI = {
  search: (query: string, size?: number): Promise<DockerSearchResult[]> =>
    ipcRenderer.invoke('docker:search', query, size || 20),
  getTags: (imageName: string): Promise<DockerTagResult[]> =>
    ipcRenderer.invoke('docker:tags', imageName)
}

// WebSocket Proxy API
const wsProxyAPI = {
  connect: (opts: { url: string; headers?: Record<string, string>; protocols?: string[] }): Promise<{ id: number; error?: string }> =>
    ipcRenderer.invoke('ws-proxy:connect', opts),
  send: (opts: { id: number; message: string }): Promise<{ ok?: boolean; error?: string }> =>
    ipcRenderer.invoke('ws-proxy:send', opts),
  disconnect: (id: number): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('ws-proxy:disconnect', id),
  onOpen: (callback: (data: { id: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: number }): void => callback(data)
    ipcRenderer.on('ws-proxy:open', handler)
    return () => ipcRenderer.removeListener('ws-proxy:open', handler)
  },
  onMessage: (callback: (data: { id: number; data: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: number; data: string }): void => callback(data)
    ipcRenderer.on('ws-proxy:message', handler)
    return () => ipcRenderer.removeListener('ws-proxy:message', handler)
  },
  onClose: (callback: (data: { id: number; code: number; reason: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: number; code: number; reason: string }): void => callback(data)
    ipcRenderer.on('ws-proxy:close', handler)
    return () => ipcRenderer.removeListener('ws-proxy:close', handler)
  },
  onError: (callback: (data: { id: number; error: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: number; error: string }): void => callback(data)
    ipcRenderer.on('ws-proxy:error', handler)
    return () => ipcRenderer.removeListener('ws-proxy:error', handler)
  }
}

interface DockerTagResult {
  name: string
  digest: string
  digestShort: string
  size: number
  arch: string
  os: string
  lastUpdated: string
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', settingsAPI)
    contextBridge.exposeInMainWorld('updater', updaterAPI)
    contextBridge.exposeInMainWorld('maven', mavenAPI)
    contextBridge.exposeInMainWorld('env', envAPI)
    contextBridge.exposeInMainWorld('translator', translatorAPI)
    contextBridge.exposeInMainWorld('npm', npmAPI)
    contextBridge.exposeInMainWorld('docker', dockerAPI)
    contextBridge.exposeInMainWorld('wsProxy', wsProxyAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = settingsAPI
  // @ts-ignore (define in dts)
  window.updater = updaterAPI
  // @ts-ignore (define in dts)
  window.maven = mavenAPI
  // @ts-ignore (define in dts)
  window.env = envAPI
  // @ts-ignore (define in dts)
  window.translator = translatorAPI
  // @ts-ignore (define in dts)
  window.npm = npmAPI
  // @ts-ignore (define in dts)
  window.docker = dockerAPI
  // @ts-ignore (define in dts)
  window.wsProxy = wsProxyAPI
}
