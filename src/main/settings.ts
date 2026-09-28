import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// ────────────────────────────────────────────────────────────────
// Settings Version & Migration Strategy
// ────────────────────────────────────────────────────────────────

export const SETTINGS_VERSION = 3 // 当前配置版本

export interface AppSettings {
  version?: number // 配置文件版本号
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

const DEFAULT_SHORTCUTS = {
  toggleSidebar: 'Alt+b',
  openSettings: 'Ctrl+,',
  goHome: 'Escape'
}

const DEFAULT_SETTINGS: AppSettings = {
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
  shortcuts: { ...DEFAULT_SHORTCUTS },
  favorites: []
}

interface SettingsData {
  version?: number
  appearance?: Partial<AppSettings['appearance']>
  editor?: Partial<AppSettings['editor']>
  updater?: Partial<AppSettings['updater']>
  window?: Partial<AppSettings['window']>
  translator?: Partial<AppSettings['translator']>
  npmRegistry?: string
  mavenSearchUrl?: string
  proxy?: Partial<AppSettings['proxy']>
  shortcuts?: Partial<AppSettings['shortcuts']>
  favorites?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ────────────────────────────────────────────────────────────────
// Migration Functions
// ────────────────────────────────────────────────────────────────

type MigrationFn = (data: SettingsData) => SettingsData

const migrations: Record<number, MigrationFn> = {
  // v0 → v1: 添加 translator 配置
  1: (data) => {
    return {
      ...data,
      version: 1,
      translator: data.translator || DEFAULT_SETTINGS.translator
    }
  },

  // v1 → v2: 添加 proxy 配置
  2: (data) => {
    return {
      ...data,
      version: 2,
      proxy: data.proxy || DEFAULT_SETTINGS.proxy
    }
  },

  // v2 → v3: 添加窗口关闭行为配置
  3: (data) => {
    return {
      ...data,
      version: 3,
      window: data.window || DEFAULT_SETTINGS.window
    }
  }

  // 未来版本迁移示例:
  // 3: (data) => {
  //   return {
  //     ...data,
  //     version: 3,
  //     newFeature: 'default value'
  //   }
  // }
}

/**
 * 执行配置迁移
 * @param data 旧版本配置
 * @returns 迁移后的配置
 */
function migrateSettings(data: unknown): SettingsData {
  const source = isRecord(data) ? data : {}
  let migrated: SettingsData = { ...source }
  const currentVersion = typeof migrated.version === 'number' ? migrated.version : 0

  // 如果是未来版本，降级到当前版本（向后兼容）
  if (currentVersion > SETTINGS_VERSION) {
    console.warn(
      `Settings version ${currentVersion} is newer than current ${SETTINGS_VERSION}, using defaults`
    )
    return { ...DEFAULT_SETTINGS }
  }

  // 逐步应用迁移
  for (let v = currentVersion + 1; v <= SETTINGS_VERSION; v++) {
    if (migrations[v]) {
      console.log(`Migrating settings from v${v - 1} to v${v}`)
      migrated = migrations[v](migrated)
    }
  }

  migrated.version = SETTINGS_VERSION
  return migrated
}

// ────────────────────────────────────────────────────────────────
// Settings Store (Dependency Injection Pattern)
// ────────────────────────────────────────────────────────────────

export interface ISettingsStore {
  getSettings(): AppSettings
  getFilePath(): string
  getAppearance(): AppSettings['appearance']
  getEditor(): AppSettings['editor']
  getUpdater(): AppSettings['updater']
  getTranslator(): AppSettings['translator']
  updateAppearance(updates: Partial<AppSettings['appearance']>): AppSettings
  updateEditor(updates: Partial<AppSettings['editor']>): AppSettings
  updateUpdater(updates: Partial<AppSettings['updater']>): AppSettings
  updateWindow(updates: Partial<AppSettings['window']>): AppSettings
  updateTranslator(updates: Partial<AppSettings['translator']>): AppSettings
  updateNpmRegistry(npmRegistry: string): AppSettings
  updateMavenSearchUrl(mavenSearchUrl: string): AppSettings
  updateProxy(updates: Partial<AppSettings['proxy']>): AppSettings
  updateShortcuts(updates: Partial<AppSettings['shortcuts']>): AppSettings
  updateFavorites(toolId: string): AppSettings
  resetToDefaults(): AppSettings
}

export class SettingsStore implements ISettingsStore {
  private filePath: string
  private settings: AppSettings

  constructor(userDataPath?: string) {
    const dataPath = userDataPath || app.getPath('userData')
    this.filePath = join(dataPath, 'settings.json')
    this.settings = this.load()
  }

  private load(): AppSettings {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, 'utf-8')
        const parsed: unknown = JSON.parse(data)
        const storedVersion =
          isRecord(parsed) && typeof parsed.version === 'number' ? parsed.version : 0

        // 执行版本迁移
        const migrated = migrateSettings(parsed)

        // 合并默认值（处理新增字段）
        const merged = this.mergeWithDefaults(migrated)

        // 如果版本号变化，保存迁移后的配置
        if (storedVersion !== SETTINGS_VERSION) {
          this.save(merged)
          console.log(`Settings migrated to v${SETTINGS_VERSION}`)
        }

        return merged
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      // 备份损坏的配置文件
      this.backupCorruptedFile()
    }
    return { ...DEFAULT_SETTINGS }
  }

  private backupCorruptedFile(): void {
    try {
      if (existsSync(this.filePath)) {
        const backupPath = `${this.filePath}.backup.${Date.now()}`
        const data = readFileSync(this.filePath, 'utf-8')
        writeFileSync(backupPath, data, 'utf-8')
        console.log(`Corrupted settings backed up to ${backupPath}`)
      }
    } catch (error) {
      console.error('Failed to backup corrupted settings:', error)
    }
  }

  private mergeWithDefaults(data: SettingsData): AppSettings {
    return {
      version: SETTINGS_VERSION,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...data.appearance },
      editor: { ...DEFAULT_SETTINGS.editor, ...data.editor },
      updater: { ...DEFAULT_SETTINGS.updater, ...data.updater },
      window: { ...DEFAULT_SETTINGS.window, ...data.window },
      translator: { ...DEFAULT_SETTINGS.translator, ...data.translator },
      npmRegistry: data.npmRegistry ?? '',
      mavenSearchUrl: data.mavenSearchUrl ?? '',
      proxy: { ...DEFAULT_SETTINGS.proxy, ...data.proxy },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...data.shortcuts },
      favorites: data.favorites ?? []
    }
  }

  private save(settings: AppSettings): void {
    try {
      const dir = join(this.filePath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      // 确保版本号始终写入
      const toSave = { ...settings, version: SETTINGS_VERSION }
      writeFileSync(this.filePath, JSON.stringify(toSave, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save settings:', error)
      throw new Error(`Failed to save settings to ${this.filePath}: ${getErrorMessage(error)}`)
    }
  }

  private commit(nextSettings: AppSettings): AppSettings {
    const previousSettings = this.settings
    this.settings = nextSettings
    try {
      this.save(nextSettings)
      return this.getSettings()
    } catch (error) {
      this.settings = previousSettings
      throw error
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }

  getFilePath(): string {
    return this.filePath
  }

  getAppearance(): AppSettings['appearance'] {
    return { ...this.settings.appearance }
  }

  getEditor(): AppSettings['editor'] {
    return { ...this.settings.editor }
  }

  getUpdater(): AppSettings['updater'] {
    return { ...this.settings.updater }
  }

  getTranslator(): AppSettings['translator'] {
    return { ...this.settings.translator }
  }

  updateAppearance(updates: Partial<AppSettings['appearance']>): AppSettings {
    return this.commit({
      ...this.settings,
      appearance: { ...this.settings.appearance, ...updates }
    })
  }

  updateEditor(updates: Partial<AppSettings['editor']>): AppSettings {
    return this.commit({
      ...this.settings,
      editor: { ...this.settings.editor, ...updates }
    })
  }

  updateUpdater(updates: Partial<AppSettings['updater']>): AppSettings {
    return this.commit({
      ...this.settings,
      updater: { ...this.settings.updater, ...updates }
    })
  }

  updateWindow(updates: Partial<AppSettings['window']>): AppSettings {
    return this.commit({
      ...this.settings,
      window: { ...this.settings.window, ...updates }
    })
  }

  updateTranslator(updates: Partial<AppSettings['translator']>): AppSettings {
    return this.commit({
      ...this.settings,
      translator: { ...this.settings.translator, ...updates }
    })
  }

  updateNpmRegistry(npmRegistry: string): AppSettings {
    return this.commit({ ...this.settings, npmRegistry })
  }

  updateMavenSearchUrl(mavenSearchUrl: string): AppSettings {
    return this.commit({ ...this.settings, mavenSearchUrl })
  }

  updateProxy(updates: Partial<AppSettings['proxy']>): AppSettings {
    return this.commit({
      ...this.settings,
      proxy: { ...this.settings.proxy, ...updates }
    })
  }

  updateShortcuts(updates: Partial<AppSettings['shortcuts']>): AppSettings {
    return this.commit({
      ...this.settings,
      shortcuts: { ...this.settings.shortcuts, ...updates }
    })
  }

  updateFavorites(toolId: string): AppSettings {
    const favorites = this.settings.favorites.includes(toolId)
      ? this.settings.favorites.filter((id) => id !== toolId)
      : [...this.settings.favorites, toolId]
    return this.commit({ ...this.settings, favorites })
  }

  resetToDefaults(): AppSettings {
    return this.commit({ ...DEFAULT_SETTINGS })
  }
}

// ────────────────────────────────────────────────────────────────
// Factory & Singleton Export
// ────────────────────────────────────────────────────────────────

/**
 * 工厂函数：创建 SettingsStore 实例（支持 DI）
 */
export function createSettingsStore(userDataPath?: string): ISettingsStore {
  return new SettingsStore(userDataPath)
}

/**
 * 默认单例实例（向后兼容）
 */
export const settingsStore = createSettingsStore()
