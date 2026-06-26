/// <reference types="vite/client" />

// WebHID API types (not in default DOM lib)
interface HIDDevice {
  opened: boolean
  vendorId: number
  productId: number
  productName: string
  manufacturerName: string
  collections?: HIDCollection[]
  open(): Promise<void>
  close(): Promise<void>
  sendReport(reportId: number, data: BufferSource): Promise<void>
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>
  receiveFeatureReport(reportId: number): Promise<DataView>
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface HIDCollection {
  usagePage: number
  usage: number
  type?: number
  inputReports?: HIDReport[]
  outputReports?: HIDReport[]
  featureReports?: HIDReport[]
}

interface HIDReport {
  reportId: number
  byteLength: number
}

interface HIDInputReportEvent extends Event {
  device: HIDDevice
  reportId: number
  data: DataView
}

interface HID extends EventTarget {
  requestDevice(options: { filters: Array<{ vendorId?: number; productId?: number; usagePage?: number; usage?: number }> }): Promise<HIDDevice[]>
  getDevices(): Promise<HIDDevice[]>
}

interface Navigator {
  hid: HID
}

// Web version API declarations (replaces Electron IPC)
interface Window {
  api: {
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
    resetToDefaults: () => Promise<AppSettings>
  }
  updater: {
    checkForUpdates: () => Promise<UpdateStatus>
    downloadUpdate: () => Promise<void>
    quitAndInstall: () => Promise<void>
    getVersion: () => Promise<string>
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  }
  maven: {
    searchArtifacts: (query: string, rows: number) => Promise<unknown>
    getVersions: (groupId: string, artifactId: string) => Promise<unknown>
    fetchPopular: () => Promise<unknown>
  }
  env: {
    getEnvVars: () => Promise<Record<string, string>>
  }
  translator: {
    translate: (text: string, sourceLang: string, targetLang: string) => Promise<{ translation?: string; error?: string }>
    testConnection: () => Promise<{ success?: boolean; models?: string[]; error?: string }>
  }
  npm: {
    search: (query: string, size?: number) => Promise<NpmSearchResult[]>
    getPackage: (name: string) => Promise<NpmPackageDetail | null>
  }
  docker: {
    search: (query: string, size?: number) => Promise<DockerSearchResult[]>
    getTags: (imageName: string) => Promise<DockerTagResult[]>
  }
}

interface AppSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system'
    fontSize: 'small' | 'medium' | 'large'
    sidebarCollapsed: boolean
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
}

type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

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

interface DockerSearchResult {
  name: string
  description: string
  stars: number
  pulls: number
  isOfficial: boolean
  isAutomated: boolean
  imageName: string
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
