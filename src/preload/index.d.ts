import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface SettingsAPI {
  getSettings: () => Promise<AppSettings>
  getAppearance: () => Promise<AppSettings['appearance']>
  getEditor: () => Promise<AppSettings['editor']>
  updateAppearance: (updates: Partial<AppSettings['appearance']>) => Promise<AppSettings>
  updateEditor: (updates: Partial<AppSettings['editor']>) => Promise<AppSettings>
  updateUpdater: (updates: Partial<AppSettings['updater']>) => Promise<AppSettings>
  getTranslator: () => Promise<AppSettings['translator']>
  updateTranslator: (updates: Partial<AppSettings['translator']>) => Promise<AppSettings>
  getNpmRegistry: () => Promise<string>
  updateNpmRegistry: (npmRegistry: string) => Promise<AppSettings>
  getMavenSearchUrl: () => Promise<string>
  updateMavenSearchUrl: (url: string) => Promise<AppSettings>
  getProxy: () => Promise<{ enabled: boolean; url: string }>
  updateProxy: (updates: Partial<{ enabled: boolean; url: string }>) => Promise<AppSettings>
  updateShortcuts: (updates: Partial<AppSettings['shortcuts']>) => Promise<AppSettings>
  updateFavorites: (toolId: string) => Promise<AppSettings>
  getSettingsPath: () => Promise<string>
  resetToDefaults: () => Promise<AppSettings>
}

export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

export interface UpdaterAPI {
  checkForUpdates: () => Promise<UpdateStatus>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => Promise<void>
  getVersion: () => Promise<string>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
}

export interface MavenAPI {
  searchArtifacts: (query: string, rows: number) => Promise<unknown>
  getVersions: (groupId: string, artifactId: string) => Promise<unknown>
  fetchPopular: () => Promise<unknown>
}

export interface EnvAPI {
  getEnvVars: () => Promise<Record<string, string>>
}

export interface TranslatorAPI {
  translate: (text: string, sourceLang: string, targetLang: string) => Promise<{ translation?: string; error?: string }>
  testConnection: () => Promise<{ success?: boolean; models?: string[]; error?: string }>
}

export interface NpmSearchResult {
  name: string
  version: string
  description: string
  keywords: string[]
  publisher: string
  link: string
  date: string
}

export interface NpmPackageDetail {
  name: string
  description: string
  license: string
  homepage: string
  repository: string
  keywords: string[]
  maintainers: string[]
  versions: string[]
}

export interface NpmAPI {
  search: (query: string, size?: number) => Promise<NpmSearchResult[]>
  getPackage: (name: string) => Promise<NpmPackageDetail | null>
}

export interface DockerSearchResult {
  name: string
  description: string
  stars: number
  pulls: number
  isOfficial: boolean
  isAutomated: boolean
  imageName: string
}

export interface DockerAPI {
  search: (query: string, size?: number) => Promise<DockerSearchResult[]>
  getTags: (imageName: string) => Promise<DockerTagResult[]>
}

export interface DockerTagResult {
  name: string
  digest: string
  digestShort: string
  size: number
  arch: string
  os: string
  lastUpdated: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SettingsAPI
    updater: UpdaterAPI
    maven: MavenAPI
    env: EnvAPI
    translator: TranslatorAPI
    npm: NpmAPI
    docker: DockerAPI
  }
}
