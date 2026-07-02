import { ipcMain } from 'electron'

export function registerEnvHandlers(): void {
  ipcMain.handle('env:get-vars', () => {
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v
    }
    return env
  })
}
