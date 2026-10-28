/** True when the renderer is running inside a browser instead of Electron. */
export function isWebRuntime(): boolean {
  try {
    return window.electron?.process?.platform === 'web'
  } catch {
    return false
  }
}
