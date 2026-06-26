import { app, shell, BrowserWindow, ipcMain, Menu, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { settingsStore, AppSettings } from './settings'
import {
  initUpdater,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getCurrentVersion,
  shouldAutoCheck
} from './updater'

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    return settingsStore.getSettings()
  })

  ipcMain.handle('settings:get-appearance', () => {
    return settingsStore.getAppearance()
  })

  ipcMain.handle('settings:get-editor', () => {
    return settingsStore.getEditor()
  })

  ipcMain.handle(
    'settings:update-appearance',
    (_event, updates: Partial<AppSettings['appearance']>) => {
      return settingsStore.updateAppearance(updates)
    }
  )

  ipcMain.handle('settings:update-editor', (_event, updates: Partial<AppSettings['editor']>) => {
    return settingsStore.updateEditor(updates)
  })

  ipcMain.handle('settings:reset', () => {
    return settingsStore.resetToDefaults()
  })

  ipcMain.handle('settings:update-updater', (_event, updates: Partial<AppSettings['updater']>) => {
    return settingsStore.updateUpdater(updates)
  })

  ipcMain.handle('settings:get-npm-registry', () => {
    return settingsStore.getSettings().npmRegistry
  })

  ipcMain.handle('settings:update-npm-registry', (_event, npmRegistry: string) => {
    return settingsStore.updateNpmRegistry(npmRegistry)
  })

  ipcMain.handle('settings:get-translator', () => {
    return settingsStore.getTranslator()
  })

  ipcMain.handle(
    'settings:update-translator',
    (_event, updates: Partial<AppSettings['translator']>) => {
      return settingsStore.updateTranslator(updates)
    }
  )
}

function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', () => {
    return checkForUpdates()
  })

  ipcMain.handle('updater:download', () => {
    return downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    return quitAndInstall()
  })

  ipcMain.handle('updater:get-version', () => {
    return getCurrentVersion()
  })
}

const MAVEN_SOURCES = [
  'https://search.maven.org/solrsearch/select',
  'https://maven.aliyun.com/repository/central'
]

async function mavenFetch(params: URLSearchParams): Promise<Response | null> {
  for (const source of MAVEN_SOURCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(`${source}?${params}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
    } catch {
      continue
    }
  }
  return null
}

function registerMavenHandlers(): void {
  ipcMain.handle('maven:search', async (_event, query: string, rows: number) => {
    const params = new URLSearchParams({ q: query, rows: String(rows || 20), wt: 'json' })
    const res = await mavenFetch(params)
    if (!res) return { response: { docs: [] } }
    return res.json()
  })

  ipcMain.handle('maven:versions', async (_event, groupId: string, artifactId: string) => {
    const params = new URLSearchParams({
      q: `g:${groupId} AND a:${artifactId}`,
      core: 'gav',
      rows: '15',
      wt: 'json'
    })
    const res = await mavenFetch(params)
    if (!res) return { response: { docs: [] } }
    return res.json()
  })

  ipcMain.handle('maven:popular', async () => {
    const seeds = [
      'spring-boot-starter-web',
      'spring-boot-starter-data-jpa',
      'lombok',
      'guava',
      'jackson-databind',
      'gson',
      'mybatis-spring-boot-starter',
      'mybatis-plus-boot-starter',
      'mysql-connector-j',
      'postgresql',
      'h2',
      'commons-lang3',
      'okhttp',
      'kafka-clients',
      'jjwt-api',
      'springdoc-openapi-starter-webmvc-ui',
      'mapstruct',
      'hutool-all',
      'fastjson2',
      'knife4j-openapi3-jakarta-spring-boot-starter',
      'aliyun-sdk-oss',
      'amqp-client',
      'jedis',
      'httpclient5'
    ]
    const results: unknown[] = []
    for (const seed of seeds) {
      try {
        const params = new URLSearchParams({ q: `a:${seed}`, rows: '1', wt: 'json' })
        const res = await mavenFetch(params)
        if (res) {
          const data = await res.json()
          if (data.response?.docs?.length > 0) {
            results.push(data.response.docs[0])
          }
        }
      } catch {
        // skip
      }
    }
    return results
  })
}

function registerEnvHandlers(): void {
  // Security: this exposes the full process.env to the renderer.
  // Acceptable for a local dev-tools desktop app, but any future
  // renderer page or injected script can call this channel.
  ipcMain.handle('env:get-vars', () => {
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v
    }
    return env
  })
}

function registerTranslatorHandlers(): void {
  ipcMain.handle(
    'translator:translate',
    async (_event, text: string, sourceLang: string, targetLang: string) => {
      const config = settingsStore.getTranslator()
      if (!config.baseUrl || !config.apiKey) {
        return { error: '请先在设置中配置 AI 翻译的 Base URL 和 API Key' }
      }

      const baseUrl = config.baseUrl.replace(/\/$/, '')
      const systemPrompt = config.systemPrompt
        .replace(/\{sourceLang\}/g, sourceLang)
        .replace(/\{targetLang\}/g, targetLang)
      const temperature = config.temperature ?? 0.3
      const maxTokens = config.maxTokens ?? 4096

      try {
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
    }
  )

  ipcMain.handle('translator:test-connection', async () => {
    const config = settingsStore.getTranslator()
    if (!config.baseUrl || !config.apiKey) {
      return { error: '请先配置 Base URL 和 API Key' }
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '')
    try {
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
  })
}

function registerNpmHandlers(): void {
  const DEFAULT_REGISTRIES = [
    'https://registry.npmjs.org',
    'https://registry.npmmirror.com'
  ]

  function getRegistries(): string[] {
    const custom = settingsStore.getSettings().npmRegistry
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
        continue // try next mirror
      }
    }
    return null
  }

  ipcMain.handle('npm:search', async (_event, query: string, size: number) => {
    try {
      const params = new URLSearchParams({ text: query, size: String(size || 20) })
      const res = await fetchNpm(`/-/v1/search?${params}`)
      if (!res) { console.warn('[npm] all mirrors failed for:', query); return [] }
      const data = await res.json()
      return data?.objects?.map((o: { package: { name: string; version: string; description: string; keywords?: string[]; publisher?: { username: string }; links?: { npm: string }; date: string } }) => ({
        name: o.package.name,
        version: o.package.version,
        description: o.package.description,
        keywords: o.package.keywords || [],
        publisher: o.package.publisher?.username || '',
        link: o.package.links?.npm || '',
        date: o.package.date
      })) || []
    } catch {
      return []
    }
  })

  ipcMain.handle('npm:package', async (_event, packageName: string) => {
    try {
      const res = await fetchNpm(`/${encodeURIComponent(packageName)}`)
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
            const av = ap[i] ?? 0; const bv = bp[i] ?? 0
            if (av !== bv) return bv - av
          }
          return a.localeCompare(b)
        })
      }
    } catch {
      return null
    }
  })
}

function registerDockerHandlers(): void {
  const DEFAULT_REGISTRIES = [
    'https://index.docker.io/v1/search',
    'https://hub-mirror.c.163.com/v1/search'
  ]

  function getMirrors(): string[] {
    const custom = settingsStore.getSettings().npmRegistry
    if (custom?.trim()) {
      const base = custom.trim().replace(/\/+$/, '')
      return [`${base}/v1/search`, ...DEFAULT_REGISTRIES]
    }
    return DEFAULT_REGISTRIES
  }

  async function fetchDockerSearch(query: string, size: number): Promise<Response | null> {
    for (const base of getMirrors()) {
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

  ipcMain.handle('docker:search', async (_event, query: string, size: number) => {
    try {
      const res = await fetchDockerSearch(query, size)
      if (!res) return []
      const data = await res.json()
      return (data.results || []).map((r: { name: string; description: string; star_count: number; pull_count: number; is_automated: boolean; is_official: boolean }) => ({
        name: r.name,
        description: r.description || '',
        stars: r.star_count || 0,
        pulls: r.pull_count || 0,
        isOfficial: r.is_official || false,
        isAutomated: r.is_automated || false,
        imageName: r.name
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('docker:tags', async (_event, imageName: string) => {
    try {
      const path = imageName.includes('/')
        ? imageName  // e.g. jupyter/datascience-notebook
        : 'library/' + imageName  // official image
      const res = await fetch(`https://hub.docker.com/v2/repositories/${path}/tags?page_size=50`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.results || []).map((t: { name: string; digest: string; images: { size: number; architecture: string; os: string }[]; last_updated: string }) => ({
        name: t.name,
        digest: t.digest || '',
        digestShort: t.digest ? t.digest.replace('sha256:', '').slice(0, 12) : '',
        size: t.images?.[0]?.size || 0,
        arch: t.images?.[0]?.architecture || '',
        os: t.images?.[0]?.os || '',
        lastUpdated: t.last_updated || ''
      }))
    } catch {
      return []
    }
  })
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    paintWhenInitiallyHidden: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
}

// ── Disable unused Chromium features (memory savings) ──────────

// These must be set before app.whenReady()
app.commandLine.appendSwitch('disable-features', [
  'SpellcheckService',        // No spellcheck needed
  'AutofillServerCommunication', // No form autofill
  'PasswordImport',           // No password manager
  'MediaRouter',              // No casting/streaming
  'TranslateUI',              // No translation
  'PreloadMediaEngagementData', // No media
  'InterestFeedContentSuggestions', // No content feed
  'AutofillEnableAccountWalletStorage', // No payment
].join(','))

app.commandLine.appendSwitch('disable-speech-api')     // No speech
app.commandLine.appendSwitch('disable-pdf-viewer')     // No PDF
app.commandLine.appendSwitch('disable-breakpad')       // No crash reporter
app.commandLine.appendSwitch('disable-hang-monitor')   // No hang monitor

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Disable default menu (Alt key)
  Menu.setApplicationMenu(null)

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Register settings IPC handlers
  registerSettingsHandlers()

  // Register updater IPC handlers
  registerUpdaterHandlers()

  // Register maven proxy handlers
  registerMavenHandlers()

  // Register env handlers
  registerEnvHandlers()

  // Register translator handlers
  registerTranslatorHandlers()

  // Register npm handlers
  registerNpmHandlers()

  // Register docker handlers
  registerDockerHandlers()

  createWindow()

  // Initialize updater with the created window
  if (mainWindow) {
    initUpdater(mainWindow)
  }

  // Register global shortcut: Ctrl+K opens command palette
  globalShortcut.register('CommandOrControl+K', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('command-palette:toggle')
    }
  })

  // Auto-check for updates if enabled
  if (shouldAutoCheck()) {
    checkForUpdates()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
