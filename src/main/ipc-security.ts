import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { normalize, resolve } from 'path'
import { fileURLToPath } from 'url'

interface IpcSecurityOptions {
  getMainWindow: () => BrowserWindow | null
  devOrigin?: string
  rendererEntryPath: string
}

let securityOptions: IpcSecurityOptions | null = null

function canonicalPath(filePath: string): string {
  const normalized = normalize(resolve(filePath))
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export function configureIpcSecurity(options: IpcSecurityOptions): void {
  securityOptions = options
}

export function isTrustedRendererUrl(rawUrl: string): boolean {
  if (!securityOptions) return false

  try {
    const target = new URL(rawUrl)

    if (securityOptions.devOrigin) {
      const devOrigin = new URL(securityOptions.devOrigin).origin
      return target.origin === devOrigin
    }

    if (target.protocol !== 'file:') return false
    return canonicalPath(fileURLToPath(target)) === canonicalPath(securityOptions.rendererEntryPath)
  } catch {
    return false
  }
}

function isTrustedIpcSender(event: IpcMainInvokeEvent): boolean {
  if (!securityOptions) return false

  const mainWindow = securityOptions.getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return false
  }

  if (event.sender.id !== mainWindow.webContents.id) return false

  const senderFrame = event.senderFrame
  if (!senderFrame || senderFrame.isDestroyed()) return false

  const topFrame = senderFrame.top
  if (!topFrame || topFrame.frameTreeNodeId !== senderFrame.frameTreeNodeId) return false

  return isTrustedRendererUrl(senderFrame.url)
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedIpcSender(event)) {
    throw new Error('Rejected IPC call from an untrusted renderer')
  }
}

type IpcHandler<Args extends unknown[], Result> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => Result | Promise<Result>

export function registerGuardedHandler<Args extends unknown[], Result>(
  channel: string,
  handler: IpcHandler<Args, Result>
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event)
    return handler(event, ...(args as Args))
  })
}
