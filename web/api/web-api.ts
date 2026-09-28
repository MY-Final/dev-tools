/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Web API compatibility layer.
 *
 * Provides fallback implementations of all Electron IPC-based APIs
 * (window.api, window.updater, window.maven, etc.) for running the
 * renderer in a plain browser / static host.
 *
 * Loaded by web/main.tsx BEFORE the common renderer bootstraps.
 */

import pkg from '../../package.json'
import {
  createDefaultSettings,
  normalizeSettings,
  TODOS_VERSION,
  type AppSettings,
  type CreateTodoInput,
  type SettingsAPI,
  type TodoItem,
  type TodosAPI,
  type UpdateStatus,
  type UpdateTodoInput,
  type UpdaterAPI
} from '../../src/shared/contracts'

// ── Helpers ──────────────────────────────────────────────────────

const SETTINGS_STORAGE_KEY = 'dev-tools-settings'
const TODOS_STORAGE_KEY = 'dev-tools-todos'

type SettingsListener = (settings: AppSettings) => void

const settingsListeners = new Set<SettingsListener>()
let settingsStorageListenerAttached = false

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return normalizeSettings(parsed)
    }
  } catch {
    /* ignore unavailable or corrupted storage */
  }
  return createDefaultSettings()
}

function notifySettingsListeners(settings: AppSettings): void {
  for (const listener of settingsListeners) {
    try {
      listener(settings)
    } catch {
      /* isolate consumer failures */
    }
  }
}

function handleSettingsStorage(event: StorageEvent): void {
  if (event.key !== SETTINGS_STORAGE_KEY) return
  notifySettingsListeners(loadSettings())
}

function ensureSettingsStorageListener(): void {
  if (settingsStorageListenerAttached) return
  window.addEventListener('storage', handleSettingsStorage)
  settingsStorageListenerAttached = true
}

function saveSettings(settings: AppSettings): void {
  const normalized = normalizeSettings(settings)
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    /* keep the in-memory result usable even if persistence is unavailable */
  }
  notifySettingsListeners(normalized)
}

// ── Type declarations (mirrors src/preload/index.d.ts) ───────────

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

// ── 1. Settings API (localStorage) ──────────────────────────────

const webSettingsAPI = {
  getSettings: (): Promise<AppSettings> => Promise.resolve(loadSettings()),

  getAppearance: (): Promise<AppSettings['appearance']> =>
    Promise.resolve(loadSettings().appearance),

  getEditor: (): Promise<AppSettings['editor']> => Promise.resolve(loadSettings().editor),

  async updateAppearance(updates: Partial<AppSettings['appearance']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.appearance = { ...settings.appearance, ...updates }
    saveSettings(settings)
    return settings
  },

  async updateEditor(updates: Partial<AppSettings['editor']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.editor = { ...settings.editor, ...updates }
    saveSettings(settings)
    return settings
  },

  async updateUpdater(updates: Partial<AppSettings['updater']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.updater = { ...settings.updater, ...updates }
    saveSettings(settings)
    return settings
  },

  async updateWindow(updates: Partial<AppSettings['window']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.window = { ...settings.window, ...updates }
    saveSettings(settings)
    return settings
  },

  async updateTranslator(updates: Partial<AppSettings['translator']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.translator = { ...settings.translator, ...updates }
    saveSettings(settings)
    return settings
  },

  getTranslator: (): Promise<AppSettings['translator']> =>
    Promise.resolve(loadSettings().translator),

  getNpmRegistry: (): Promise<string> => Promise.resolve(loadSettings().npmRegistry),

  async updateNpmRegistry(npmRegistry: string): Promise<AppSettings> {
    const settings = loadSettings()
    settings.npmRegistry = npmRegistry
    saveSettings(settings)
    return settings
  },

  getMavenSearchUrl: (): Promise<string> => Promise.resolve(loadSettings().mavenSearchUrl),

  async updateMavenSearchUrl(url: string): Promise<AppSettings> {
    const settings = loadSettings()
    settings.mavenSearchUrl = url
    saveSettings(settings)
    return settings
  },

  getProxy: (): Promise<AppSettings['proxy']> => Promise.resolve(loadSettings().proxy),

  async updateProxy(updates: Partial<AppSettings['proxy']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.proxy = { ...settings.proxy, ...updates }
    saveSettings(settings)
    return settings
  },

  async updateShortcuts(updates: Partial<AppSettings['shortcuts']>): Promise<AppSettings> {
    const settings = loadSettings()
    settings.shortcuts = { ...settings.shortcuts, ...updates }
    saveSettings(settings)
    return settings
  },

  async updateFavorites(toolId: string): Promise<AppSettings> {
    const settings = loadSettings()
    const index = settings.favorites.indexOf(toolId)
    settings.favorites = index >= 0
      ? settings.favorites.filter((id) => id !== toolId)
      : [...settings.favorites, toolId]
    saveSettings(settings)
    return settings
  },

  getSettingsPath: (): Promise<string> => Promise.resolve('localStorage'),

  onSettingsChanged(callback: (settings: AppSettings) => void): () => void {
    ensureSettingsStorageListener()
    settingsListeners.add(callback)
    return () => settingsListeners.delete(callback)
  },

  async resetToDefaults(): Promise<AppSettings> {
    const settings = createDefaultSettings()
    saveSettings(settings)
    return settings
  }
} satisfies SettingsAPI

// ── 2. Updater API (degraded — no auto-update in browser) ───────

const webUpdaterAPI = {
  checkForUpdates: (): Promise<UpdateStatus> => Promise.resolve({ type: 'not-available' }),
  downloadUpdate: (): Promise<void> => Promise.resolve(),
  quitAndInstall: (): Promise<void> => Promise.resolve(),
  getVersion: (): Promise<string> => Promise.resolve(pkg.version ?? '0.0.0'),
  onUpdateStatus: (_callback: (status: UpdateStatus) => void): (() => void) => () => {
    /* no updates in web mode */
  }
} satisfies UpdaterAPI

// ── 3. Maven API (direct fetch) ──────────────────────────────────

const MAVEN_DEFAULT_SEARCH = 'https://search.maven.org/solrsearch/select'

async function mavenFetch(
  params: URLSearchParams,
  retries = 2,
  customUrl?: string
): Promise<Response | null> {
  const baseUrl = customUrl || MAVEN_DEFAULT_SEARCH
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`${baseUrl}?${params}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
      if (res.status === 504 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    }
  }
  return null
}

const webMavenAPI = {
  async searchArtifacts(query: string, rows: number): Promise<unknown> {
    const params = new URLSearchParams({ q: query, rows: String(rows || 20), wt: 'json' })
    const stored = loadSettings()
    const res = await mavenFetch(params, 2, stored.mavenSearchUrl)
    if (!res) return { response: { docs: [] } }
    return res.json()
  },

  async getVersions(groupId: string, artifactId: string): Promise<unknown> {
    const params = new URLSearchParams({
      q: `g:${groupId} AND a:${artifactId}`,
      core: 'gav',
      rows: '15',
      wt: 'json'
    })
    const stored = loadSettings()
    const res = await mavenFetch(params, 1, stored.mavenSearchUrl)
    if (!res) return { response: { docs: [] } }
    return res.json()
  }
}

// ── 4. Env API (not available in browser) ────────────────────────

const webEnvAPI = {
  getEnvVars: (): Promise<Record<string, string>> => Promise.resolve({})
}

// ── 5. Translator API (direct fetch) ─────────────────────────────

const webTranslatorAPI = {
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ translation?: string; error?: string }> {
    try {
      const stored = loadSettings()
      const config = stored.translator
      if (!config.baseUrl || !config.apiKey) {
        return { error: '请先在设置中配置 AI 翻译的 Base URL 和 API Key' }
      }

      const baseUrl = config.baseUrl.replace(/\/$/, '')
      const systemPrompt = config.systemPrompt
        .replace(/\{sourceLang\}/g, sourceLang)
        .replace(/\{targetLang\}/g, targetLang)
      const temperature = config.temperature ?? 0.3
      const maxTokens = config.maxTokens ?? 4096

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        if (res.status === 401) return { error: 'API Key 无效 (401 Unauthorized)' }
        if (res.status === 404) return { error: 'Base URL 无效或路径不正确 (404 Not Found)' }
        if (res.status === 429) return { error: '请求过于频繁，请稍后再试 (429 Rate Limit)' }
        return { error: `API 请求失败 (${res.status}): ${errText.slice(0, 200)}` }
      }

      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) {
        return { error: 'API 响应格式异常，未获取到翻译结果' }
      }
      return { translation: content.trim() }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { error: '请求超时 (30s)，请检查网络或 Base URL' }
      }
      return { error: `网络请求失败: ${(err as Error).message}` }
    }
  },

  async testConnection(): Promise<{ success?: boolean; models?: string[]; error?: string }> {
    try {
      const stored = loadSettings()
      const config = stored.translator
      if (!config.baseUrl || !config.apiKey) {
        return { error: '请先配置 Base URL 和 API Key' }
      }

      const baseUrl = config.baseUrl.replace(/\/$/, '')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        const models = data?.data?.map((m: { id: string }) => m.id) || []
        return { success: true, models }
      }
      if (res.status === 401) return { error: 'API Key 无效 (401 Unauthorized)' }
      if (res.status === 404) return { error: 'Base URL 无效或路径不正确 (404 Not Found)' }
      return { error: `连接失败 (${res.status})` }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { error: '连接超时 (10s)，请检查网络' }
      }
      return { error: `连接失败: ${(err as Error).message}` }
    }
  }
}

// ── 6. npm API (direct fetch with mirrors) ───────────────────────

const DEFAULT_REGISTRIES = ['https://registry.npmjs.org', 'https://registry.npmmirror.com']

function getRegistries(): string[] {
  const stored = loadSettings()
  const custom = stored.npmRegistry
  if (custom?.trim()) return [custom.trim(), ...DEFAULT_REGISTRIES]
  return DEFAULT_REGISTRIES
}

async function fetchNpm(path: string): Promise<Response | null> {
  for (const base of getRegistries()) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${base}${path}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
    } catch {
      continue
    }
  }
  return null
}

const webNpmAPI = {
  async search(query: string, size?: number): Promise<NpmSearchResult[]> {
    try {
      const params = new URLSearchParams({ text: query, size: String(size || 20) })
      const res = await fetchNpm(`/-/v1/search?${params}`)
      if (!res) return []
      const data = await res.json()
      return (
        data?.objects?.map(
          (o: {
            package: {
              name: string
              version: string
              description: string
              keywords?: string[]
              publisher?: { username: string }
              links?: { npm: string }
              date: string
            }
          }) => ({
            name: o.package.name,
            version: o.package.version,
            description: o.package.description,
            keywords: o.package.keywords || [],
            publisher: o.package.publisher?.username || '',
            link: o.package.links?.npm || '',
            date: o.package.date
          })
        ) || []
      )
    } catch {
      return []
    }
  },

  async getPackage(name: string): Promise<NpmPackageDetail | null> {
    try {
      const res = await fetchNpm(`/${encodeURIComponent(name)}`)
      if (!res) return null
      const data = await res.json()
      return {
        name: data.name,
        description: data.description,
        license: data.license,
        homepage: data.homepage,
        repository: data.repository?.url || '',
        keywords: data.keywords || [],
        maintainers: (data.maintainers || []).map((m: { name: string }) => m.name),
        versions: Object.keys(data.versions || {}).sort((a, b) => {
          const ap = a.split('.').map(Number)
          const bp = b.split('.').map(Number)
          for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
            const av = ap[i] ?? 0
            const bv = bp[i] ?? 0
            if (av !== bv) return bv - av
          }
          return a.localeCompare(b)
        })
      }
    } catch {
      return null
    }
  }
}

// ── 7. Docker API (direct fetch) ─────────────────────────────────

const DOCKER_DEFAULT_REGISTRIES = [
  'https://index.docker.io/v1/search',
  'https://hub-mirror.c.163.com/v1/search'
]

function getDockerMirrors(): string[] {
  const stored = loadSettings()
  const custom = stored.npmRegistry
  if (custom?.trim()) {
    const base = custom.trim().replace(/\/+$/, '')
    return [`${base}/v1/search`, ...DOCKER_DEFAULT_REGISTRIES]
  }
  return DOCKER_DEFAULT_REGISTRIES
}

async function fetchDockerSearch(query: string, size: number): Promise<Response | null> {
  for (const base of getDockerMirrors()) {
    try {
      const params = new URLSearchParams({ q: query, n: String(size || 20) })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${base}?${params}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
    } catch {
      continue
    }
  }
  return null
}

const webDockerAPI = {
  async search(query: string, size?: number): Promise<DockerSearchResult[]> {
    try {
      const res = await fetchDockerSearch(query, size || 20)
      if (!res) return []
      const data = await res.json()
      return (
        (data.results || []).map(
          (r: {
            name: string
            description: string
            star_count: number
            pull_count: number
            is_automated: boolean
            is_official: boolean
          }) => ({
            name: r.name,
            description: r.description || '',
            stars: r.star_count || 0,
            pulls: r.pull_count || 0,
            isOfficial: r.is_official || false,
            isAutomated: r.is_automated || false,
            imageName: r.name
          })
        ) || []
      )
    } catch {
      return []
    }
  },

  async getTags(imageName: string): Promise<DockerTagResult[]> {
    try {
      const path = imageName.includes('/') ? imageName : 'library/' + imageName
      const res = await fetch(
        `https://hub.docker.com/v2/repositories/${path}/tags?page_size=50`
      )
      if (!res.ok) return []
      const data = await res.json()
      return (
        (data.results || []).map(
          (t: {
            name: string
            digest: string
            images: { size: number; architecture: string; os: string }[]
            last_updated: string
          }) => ({
            name: t.name,
            digest: t.digest || '',
            digestShort: t.digest ? t.digest.replace('sha256:', '').slice(0, 12) : '',
            size: t.images?.[0]?.size || 0,
            arch: t.images?.[0]?.architecture || '',
            os: t.images?.[0]?.os || '',
            lastUpdated: t.last_updated || ''
          })
        ) || []
      )
    } catch {
      return []
    }
  }
}

// ── 8. WebSocket Proxy API (native browser WebSocket) ────────────

let wsProxyIdCounter = 0
const wsProxyConnections = new Map<number, WebSocket>()
const wsProxyListeners = new Map<
  string,
  Set<(...args: unknown[]) => void>
>()

function emitWsEvent(event: string, data: unknown): void {
  const handlers = wsProxyListeners.get(event)
  if (handlers) {
    for (const fn of handlers) {
      try {
        ;(fn as (data: unknown) => void)(data)
      } catch {
        /* ignore */
      }
    }
  }
}

const webWsProxyAPI = {
  connect(opts: {
    url: string
    headers?: Record<string, string>
    protocols?: string[]
  }): Promise<{ id: number; error?: string }> {
    const id = ++wsProxyIdCounter
    try {
      // Browser WebSocket does not support custom headers or protocols array
      const ws = new WebSocket(opts.url)

      ws.onopen = () => {
        emitWsEvent('ws-proxy:open', { id })
      }
      ws.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : '[Binary]'
        emitWsEvent('ws-proxy:message', { id, data })
      }
      ws.onclose = (event) => {
        wsProxyConnections.delete(id)
        emitWsEvent('ws-proxy:close', { id, code: event.code, reason: event.reason || '' })
      }
      ws.onerror = () => {
        emitWsEvent('ws-proxy:error', { id, error: '连接错误' })
      }

      wsProxyConnections.set(id, ws)
      return Promise.resolve({ id })
    } catch (err) {
      return Promise.resolve({ id: -1, error: (err as Error).message })
    }
  },

  send(opts: { id: number; message: string }): Promise<{ ok?: boolean; error?: string }> {
    const ws = wsProxyConnections.get(opts.id)
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve({ error: '连接未打开' })
    try {
      ws.send(opts.message)
      return Promise.resolve({ ok: true })
    } catch (err) {
      return Promise.resolve({ error: (err as Error).message })
    }
  },

  disconnect(id: number): Promise<{ ok: boolean }> {
    const ws = wsProxyConnections.get(id)
    if (ws) {
      ws.close()
      wsProxyConnections.delete(id)
    }
    return Promise.resolve({ ok: true })
  },

  onOpen(callback: (data: { id: number }) => void): () => void {
    if (!wsProxyListeners.has('ws-proxy:open')) wsProxyListeners.set('ws-proxy:open', new Set())
    wsProxyListeners.get('ws-proxy:open')!.add(callback as (...args: unknown[]) => void)
    return () => {
      wsProxyListeners.get('ws-proxy:open')?.delete(callback as (...args: unknown[]) => void)
    }
  },

  onMessage(callback: (data: { id: number; data: string }) => void): () => void {
    if (!wsProxyListeners.has('ws-proxy:message')) wsProxyListeners.set('ws-proxy:message', new Set())
    wsProxyListeners.get('ws-proxy:message')!.add(callback as (...args: unknown[]) => void)
    return () => {
      wsProxyListeners.get('ws-proxy:message')?.delete(callback as (...args: unknown[]) => void)
    }
  },

  onClose(callback: (data: { id: number; code: number; reason: string }) => void): () => void {
    if (!wsProxyListeners.has('ws-proxy:close')) wsProxyListeners.set('ws-proxy:close', new Set())
    wsProxyListeners.get('ws-proxy:close')!.add(callback as (...args: unknown[]) => void)
    return () => {
      wsProxyListeners.get('ws-proxy:close')?.delete(callback as (...args: unknown[]) => void)
    }
  },

  onError(callback: (data: { id: number; error: string }) => void): () => void {
    if (!wsProxyListeners.has('ws-proxy:error')) wsProxyListeners.set('ws-proxy:error', new Set())
    wsProxyListeners.get('ws-proxy:error')!.add(callback as (...args: unknown[]) => void)
    return () => {
      wsProxyListeners.get('ws-proxy:error')?.delete(callback as (...args: unknown[]) => void)
    }
  }
}

// ── 9. Todo Notes API (localStorage) ─────────────────────────

interface TodosData {
  version: number
  items: TodoItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.note === 'string' &&
    typeof value.date === 'string' &&
    typeof value.completed === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function loadTodos(): TodosData {
  try {
    const raw = localStorage.getItem(TODOS_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isRecord(parsed) && Array.isArray(parsed.items)) {
        return {
          version: TODOS_VERSION,
          items: parsed.items.filter(isTodoItem)
        }
      }
    }
  } catch {
    /* ignore unavailable or corrupted storage */
  }
  return { version: TODOS_VERSION, items: [] }
}

function saveTodos(data: TodosData): void {
  try {
    localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* keep the in-memory operation usable if persistence is unavailable */
  }
}

function createTodoId(): string {
  const randomPart =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `todo_${Date.now()}_${randomPart}`
}

const webTodosAPI = {
  getItems(): Promise<TodoItem[]> {
    return Promise.resolve(
      [...loadTodos().items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    )
  },

  createItem(input: CreateTodoInput): Promise<TodoItem> {
    const title = input.title.trim()
    if (!title) throw new Error('Todo title is required')
    if (!isDateString(input.date)) throw new Error('Invalid todo date')

    const now = new Date().toISOString()
    const item: TodoItem = {
      id: createTodoId(),
      title,
      note: input.note?.trim() || '',
      date: input.date,
      completed: false,
      createdAt: now,
      updatedAt: now
    }

    const data = loadTodos()
    data.items = [...data.items, item]
    saveTodos(data)
    return Promise.resolve(item)
  },

  updateItem(id: string, updates: UpdateTodoInput): Promise<TodoItem | null> {
    const data = loadTodos()
    const itemIndex = data.items.findIndex((item) => item.id === id)
    if (itemIndex === -1) return Promise.resolve(null)

    const current = data.items[itemIndex]
    const nextTitle = updates.title === undefined ? current.title : updates.title.trim()
    const nextDate = updates.date ?? current.date

    if (!nextTitle) throw new Error('Todo title is required')
    if (!isDateString(nextDate)) throw new Error('Invalid todo date')

    const next: TodoItem = {
      ...current,
      ...updates,
      title: nextTitle,
      note: updates.note === undefined ? current.note : updates.note.trim(),
      date: nextDate,
      updatedAt: new Date().toISOString()
    }

    data.items = [...data.items.slice(0, itemIndex), next, ...data.items.slice(itemIndex + 1)]
    saveTodos(data)
    return Promise.resolve(next)
  },

  deleteItem(id: string): Promise<boolean> {
    const data = loadTodos()
    const nextItems = data.items.filter((item) => item.id !== id)
    const changed = nextItems.length !== data.items.length
    if (changed) {
      data.items = nextItems
      saveTodos(data)
    }
    return Promise.resolve(changed)
  },

  clearCompleted(date?: string): Promise<number> {
    if (date && !isDateString(date)) throw new Error('Invalid todo date')

    const data = loadTodos()
    const nextItems = data.items.filter((item) => {
      if (!item.completed) return true
      return date ? item.date !== date : false
    })
    const removed = data.items.length - nextItems.length
    if (removed > 0) {
      data.items = nextItems
      saveTodos(data)
    }
    return Promise.resolve(removed)
  }
} satisfies TodosAPI

// ── 10. Electron API mock (for Versions.tsx, CommandPalette.tsx) ──

const webElectronAPI = {
  ipcRenderer: {
    on(_channel: string, _listener: (...args: unknown[]) => void): () => void {
      // command-palette:toggle is never emitted in web mode
      return () => {
        /* noop */
      }
    },
    once(_channel: string, _listener: (...args: unknown[]) => void): () => void {
      return () => {
        /* noop */
      }
    },
    removeAllListeners(_channel: string): void {
      /* noop */
    },
    removeListener(_channel: string, _listener: (...args: unknown[]) => void) {
      /* noop */
    },
    send(_channel: string, ..._args: unknown[]): void {
      /* noop */
    },
    invoke(_channel: string, ..._args: unknown[]): Promise<unknown> {
      return Promise.resolve(undefined)
    },
    postMessage(_channel: string, _message: unknown, _transfer?: MessagePort[]): void {
      /* noop */
    },
    sendSync(_channel: string, ..._args: unknown[]): unknown {
      return undefined
    },
    sendTo(_webContentsId: number, _channel: string, ..._args: unknown[]): void {
      /* noop */
    },
    sendToHost(_channel: string, ..._args: unknown[]): void {
      /* noop */
    }
  },
  webFrame: {
    insertCSS(_css: string): string {
      return ''
    },
    setZoomFactor(_factor: number): void {
      /* noop */
    },
    setZoomLevel(_level: number): void {
      /* noop */
    }
  },
  webUtils: {
    getPathForFile(_file: File): string {
      return ''
    }
  },
  process: {
    platform: 'web',
    versions: {
      node: '0.0.0',
      chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '0.0.0',
      electron: '',
      app: pkg.version ?? '0.0.0'
    },
    env: {}
  }
}

// ── Bootstrap (inject into window) ───────────────────────────────

export function injectWebAPI(): void {
  const w = window as unknown as Record<string, unknown>
  w.electron = webElectronAPI
  w.api = webSettingsAPI
  w.updater = webUpdaterAPI
  w.maven = webMavenAPI
  w.env = webEnvAPI
  w.translator = webTranslatorAPI
  w.npm = webNpmAPI
  w.docker = webDockerAPI
  w.wsProxy = webWsProxyAPI
  w.todos = webTodosAPI
}
