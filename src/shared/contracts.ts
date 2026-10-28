export const SETTINGS_VERSION = 3
export const TODOS_VERSION = 1

export interface AppSettings {
  version?: number
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
  window: {
    closeBehavior: 'ask' | 'minimize-to-tray' | 'exit'
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
  updateWindow: (updates: Partial<AppSettings['window']>) => Promise<AppSettings>
  getTranslator: () => Promise<AppSettings['translator']>
  updateTranslator: (updates: Partial<AppSettings['translator']>) => Promise<AppSettings>
  getNpmRegistry: () => Promise<string>
  updateNpmRegistry: (npmRegistry: string) => Promise<AppSettings>
  getMavenSearchUrl: () => Promise<string>
  updateMavenSearchUrl: (url: string) => Promise<AppSettings>
  getProxy: () => Promise<AppSettings['proxy']>
  updateProxy: (updates: Partial<AppSettings['proxy']>) => Promise<AppSettings>
  updateShortcuts: (updates: Partial<AppSettings['shortcuts']>) => Promise<AppSettings>
  updateFavorites: (toolId: string) => Promise<AppSettings>
  getSettingsPath: () => Promise<string>
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void
  resetToDefaults: () => Promise<AppSettings>
}

export interface TodoItem {
  id: string
  title: string
  note: string
  date: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTodoInput {
  title: string
  note?: string
  date: string
}

export interface UpdateTodoInput {
  title?: string
  note?: string
  date?: string
  completed?: boolean
}

export interface TodosAPI {
  getItems: () => Promise<TodoItem[]>
  createItem: (input: CreateTodoInput) => Promise<TodoItem>
  updateItem: (id: string, updates: UpdateTodoInput) => Promise<TodoItem | null>
  deleteItem: (id: string) => Promise<boolean>
  clearCompleted: (date?: string) => Promise<number>
}

export interface OpenedFile {
  path: string
  name: string
  content: string
  bytes: number
  truncated: boolean
}

export interface SaveFileOptions {
  content: string
  suggestedName?: string
  filePath?: string
}

export interface SaveFileResult {
  path: string
  name: string
  bytes: number
  canceled: boolean
}

export interface FileAPI {
  open: () => Promise<OpenedFile | null>
  read: (filePath: string) => Promise<OpenedFile>
  save: (options: SaveFileOptions) => Promise<SaveFileResult>
  recent: () => Promise<string[]>
  reveal: (filePath: string) => Promise<boolean>
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

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  appearance: {
    theme: 'dark',
    fontSize: 'medium',
    sidebarCollapsed: false,
    showSidebarShortDesc: true
  },
  editor: {
    jsonIndent: 2,
    autoCopy: false,
    timestampFormat: 'seconds'
  },
  updater: {
    autoCheck: true
  },
  window: {
    closeBehavior: 'ask'
  },
  translator: {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt:
      'You are a professional translator. Translate the following text from {sourceLang} to {targetLang}. Only output the translated text, nothing else. Do not add explanations, notes, or quotation marks.',
    temperature: 0.3,
    maxTokens: 4096
  },
  npmRegistry: '',
  mavenSearchUrl: '',
  proxy: {
    enabled: false,
    url: ''
  },
  shortcuts: {
    toggleSidebar: 'Alt+b',
    openSettings: 'Ctrl+,',
    goHome: 'Escape'
  },
  favorites: []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

function readVersion(source: Record<string, unknown>): number {
  const version = source.version
  return typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : 0
}

function migrateLegacySettings(
  source: Record<string, unknown>,
  version: number
): Record<string, unknown> {
  let migrated = { ...source }

  if (version < 1) {
    migrated = {
      ...migrated,
      translator: {
        ...DEFAULT_SETTINGS.translator,
        ...(isRecord(migrated.translator) ? migrated.translator : {})
      }
    }
  }

  if (version < 2) {
    migrated = {
      ...migrated,
      proxy: { ...DEFAULT_SETTINGS.proxy, ...(isRecord(migrated.proxy) ? migrated.proxy : {}) }
    }
  }

  if (version < 3) {
    migrated = {
      ...migrated,
      window: { ...DEFAULT_SETTINGS.window, ...(isRecord(migrated.window) ? migrated.window : {}) }
    }
  }

  return migrated
}

export function createDefaultSettings(): AppSettings {
  return structuredClone(DEFAULT_SETTINGS)
}

export function normalizeSettings(value: unknown): AppSettings {
  const source = isRecord(value) ? value : {}
  const version = readVersion(source)

  if (version > SETTINGS_VERSION) {
    return createDefaultSettings()
  }

  const migrated = migrateLegacySettings(source, version)
  const appearance = isRecord(migrated.appearance) ? migrated.appearance : {}
  const editor = isRecord(migrated.editor) ? migrated.editor : {}
  const updater = isRecord(migrated.updater) ? migrated.updater : {}
  const windowSettings = isRecord(migrated.window) ? migrated.window : {}
  const translator = isRecord(migrated.translator) ? migrated.translator : {}
  const proxy = isRecord(migrated.proxy) ? migrated.proxy : {}
  const shortcuts = isRecord(migrated.shortcuts) ? migrated.shortcuts : {}

  return {
    version: SETTINGS_VERSION,
    appearance: {
      theme: readEnum(
        appearance.theme,
        ['light', 'dark', 'system'],
        DEFAULT_SETTINGS.appearance.theme
      ),
      fontSize: readEnum(
        appearance.fontSize,
        ['small', 'medium', 'large'],
        DEFAULT_SETTINGS.appearance.fontSize
      ),
      sidebarCollapsed: readBoolean(
        appearance.sidebarCollapsed,
        DEFAULT_SETTINGS.appearance.sidebarCollapsed
      ),
      showSidebarShortDesc: readBoolean(
        appearance.showSidebarShortDesc,
        DEFAULT_SETTINGS.appearance.showSidebarShortDesc
      )
    },
    editor: {
      jsonIndent: editor.jsonIndent === 4 ? 4 : 2,
      autoCopy: readBoolean(editor.autoCopy, DEFAULT_SETTINGS.editor.autoCopy),
      timestampFormat: readEnum(
        editor.timestampFormat,
        ['seconds', 'milliseconds'],
        DEFAULT_SETTINGS.editor.timestampFormat
      )
    },
    updater: {
      autoCheck: readBoolean(updater.autoCheck, DEFAULT_SETTINGS.updater.autoCheck)
    },
    window: {
      closeBehavior: readEnum(
        windowSettings.closeBehavior,
        ['ask', 'minimize-to-tray', 'exit'],
        DEFAULT_SETTINGS.window.closeBehavior
      )
    },
    translator: {
      baseUrl: readString(translator.baseUrl, DEFAULT_SETTINGS.translator.baseUrl),
      apiKey: readString(translator.apiKey, DEFAULT_SETTINGS.translator.apiKey),
      model: readString(translator.model, DEFAULT_SETTINGS.translator.model),
      systemPrompt: readString(translator.systemPrompt, DEFAULT_SETTINGS.translator.systemPrompt),
      temperature: readFiniteNumber(
        translator.temperature,
        DEFAULT_SETTINGS.translator.temperature
      ),
      maxTokens: readFiniteNumber(translator.maxTokens, DEFAULT_SETTINGS.translator.maxTokens)
    },
    npmRegistry: readString(migrated.npmRegistry, DEFAULT_SETTINGS.npmRegistry),
    mavenSearchUrl: readString(migrated.mavenSearchUrl, DEFAULT_SETTINGS.mavenSearchUrl),
    proxy: {
      enabled: readBoolean(proxy.enabled, DEFAULT_SETTINGS.proxy.enabled),
      url: readString(proxy.url, DEFAULT_SETTINGS.proxy.url)
    },
    shortcuts: {
      toggleSidebar: readString(shortcuts.toggleSidebar, DEFAULT_SETTINGS.shortcuts.toggleSidebar),
      openSettings: readString(shortcuts.openSettings, DEFAULT_SETTINGS.shortcuts.openSettings),
      goHome: readString(shortcuts.goHome, DEFAULT_SETTINGS.shortcuts.goHome)
    },
    favorites: Array.isArray(migrated.favorites)
      ? migrated.favorites.filter((item): item is string => typeof item === 'string')
      : []
  }
}

