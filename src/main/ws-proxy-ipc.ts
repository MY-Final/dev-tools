import { ipcMain, BrowserWindow } from 'electron'
import WebSocket from 'ws'

let wsProxyIdCounter = 0
const wsProxyConnections = new Map<number, WebSocket>()

function sendToWindow(win: BrowserWindow | null, channel: string, data: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

export function registerWsProxyHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('ws-proxy:connect', (_event, opts: { url: string; headers?: Record<string, string>; protocols?: string[] }) => {
    const id = ++wsProxyIdCounter
    try {
      const ws = opts.protocols && opts.protocols.length > 0
        ? new WebSocket(opts.url, opts.protocols, { headers: opts.headers })
        : new WebSocket(opts.url, { headers: opts.headers })

      ws.onopen = () => {
        sendToWindow(getMainWindow(), 'ws-proxy:open', { id })
      }
      ws.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : '[Binary]'
        sendToWindow(getMainWindow(), 'ws-proxy:message', { id, data })
      }
      ws.onclose = (event) => {
        wsProxyConnections.delete(id)
        sendToWindow(getMainWindow(), 'ws-proxy:close', { id, code: event.code, reason: event.reason || '' })
      }
      ws.onerror = () => {
        sendToWindow(getMainWindow(), 'ws-proxy:error', { id, error: '连接错误' })
      }

      wsProxyConnections.set(id, ws)
      return { id }
    } catch (err) {
      return { id: -1, error: (err as Error).message }
    }
  })

  ipcMain.handle('ws-proxy:send', (_event, opts: { id: number; message: string }) => {
    const ws = wsProxyConnections.get(opts.id)
    if (!ws || ws.readyState !== WebSocket.OPEN) return { error: '连接未打开' }
    try {
      ws.send(opts.message)
      return { ok: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('ws-proxy:disconnect', (_event, id: number) => {
    const ws = wsProxyConnections.get(id)
    if (ws) {
      ws.close()
      wsProxyConnections.delete(id)
    }
    return { ok: true }
  })
}
