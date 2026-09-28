import { app, shell, BrowserWindow, Menu, globalShortcut, Tray, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initUpdater, checkForUpdates, shouldAutoCheck } from './updater'
import { registerSettingsHandlers } from './settings-ipc'
import { registerMavenHandlers } from './maven-ipc'
import { registerUpdaterHandlers } from './updater-ipc'
import { registerEnvHandlers } from './env-ipc'
import { registerTranslatorHandlers } from './translator-ipc'
import { registerNpmHandlers } from './npm-ipc'
import { registerDockerHandlers } from './docker-ipc'
import { registerWsProxyHandlers, cleanupWsProxyConnections } from './ws-proxy-ipc'
import { registerTodoHandlers } from './todos-ipc'
import { settingsStore } from './settings'
import { configureIpcSecurity, isTrustedRendererUrl } from './ipc-security'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const APP_USER_MODEL_ID = 'com.electron.app'
const COMMAND_PALETTE_SHORTCUT = 'CommandOrControl+K'

interface ShortcutRegistrationResult {
  shortcut: string
  registered: boolean
  error?: string
}

function registerCommandPaletteShortcut(): ShortcutRegistrationResult {
  try {
    const registered = globalShortcut.register(COMMAND_PALETTE_SHORTCUT, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('command-palette:toggle')
      }
    })

    const result: ShortcutRegistrationResult = {
      shortcut: COMMAND_PALETTE_SHORTCUT,
      registered
    }

    if (!registered) {
      result.error = 'The shortcut is already in use or unavailable'
      console.error(`Failed to register global shortcut ${COMMAND_PALETTE_SHORTCUT}`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:shortcut-status', result)
      }
    }

    return result
  } catch (error) {
    const result: ShortcutRegistrationResult = {
      shortcut: COMMAND_PALETTE_SHORTCUT,
      registered: false,
      error: error instanceof Error ? error.message : String(error)
    }
    console.error(`Failed to register global shortcut ${COMMAND_PALETTE_SHORTCUT}:`, error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:shortcut-status', result)
    }
    return result
  }
}

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const protocol = new URL(rawUrl).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function openExternalUrl(rawUrl: string): void {
  if (!isAllowedExternalUrl(rawUrl)) return
  void shell.openExternal(rawUrl).catch((error: unknown) => {
    console.error('Failed to open external URL:', error)
  })
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function ensureTray(): void {
  if (tray) return
  tray = new Tray(icon)
  tray.setToolTip('dev-tools')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 dev-tools', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showMainWindow)
}

function notifySettingsChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', settingsStore.getSettings())
  }
}

function handleWindowClose(event: Electron.Event): void {
  if (isQuitting) return

  const behavior = settingsStore.getSettings().window.closeBehavior

  if (behavior === 'exit') {
    isQuitting = true
    app.quit()
    return
  }

  if (behavior === 'minimize-to-tray') {
    event.preventDefault()
    ensureTray()
    mainWindow?.hide()
    return
  }

  event.preventDefault()
  const choice = dialog.showMessageBoxSync(mainWindow!, {
    type: 'question',
    title: '关闭 dev-tools',
    message: '关闭窗口时你希望怎么处理？',
    detail: '这个提示只会出现一次，之后可以在设置页修改。',
    buttons: ['最小化到托盘', '退出应用', '取消'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })

  if (choice === 0) {
    settingsStore.updateWindow({ closeBehavior: 'minimize-to-tray' })
    notifySettingsChanged()
    ensureTray()
    mainWindow?.hide()
    return
  }

  if (choice === 1) {
    settingsStore.updateWindow({ closeBehavior: 'exit' })
    notifySettingsChanged()
    isQuitting = true
    app.quit()
  }
}

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('close', handleWindowClose)
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  const preventUntrustedNavigation = (event: Electron.Event, url: string): void => {
    if (!isTrustedRendererUrl(url)) event.preventDefault()
  }

  win.webContents.on('will-navigate', preventUntrustedNavigation)
  win.webContents.on('will-redirect', preventUntrustedNavigation)

  win.webContents.setWindowOpenHandler((details) => {
    openExternalUrl(details.url)
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

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Disable default menu (Alt key)
  Menu.setApplicationMenu(null)

  configureIpcSecurity({
    getMainWindow: () => mainWindow,
    devOrigin: is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined,
    rendererEntryPath: join(__dirname, '../renderer/index.html')
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

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

  // Register WebSocket proxy handlers
  registerWsProxyHandlers(() => mainWindow)

  // Register todo handlers
  registerTodoHandlers()

  createWindow()

  // Initialize updater with the created window
  initUpdater(() => mainWindow)

  // Register global shortcut: Ctrl+K opens command palette
  const shortcutResult = registerCommandPaletteShortcut()
  if (!shortcutResult.registered) {
    console.error('Command palette global shortcut is unavailable')
  }

  // Auto-check for updates if enabled
  if (shouldAutoCheck()) {
    checkForUpdates()
  }

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up WebSocket connections before quitting
app.on('will-quit', () => {
  cleanupWsProxyConnections()
  globalShortcut.unregisterAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
