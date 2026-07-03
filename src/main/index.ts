import { app, shell, BrowserWindow, ipcMain, Menu, globalShortcut } from 'electron'
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

  // Register WebSocket proxy handlers
  registerWsProxyHandlers(() => mainWindow)

  // Register todo handlers
  registerTodoHandlers()

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

// Clean up WebSocket connections before quitting
app.on('will-quit', () => {
  cleanupWsProxyConnections()
  globalShortcut.unregisterAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
