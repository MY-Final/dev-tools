import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface WindowState {
  bounds: Partial<Rectangle> & { width: number; height: number }
  maximized: boolean
}

const DEFAULT_STATE: WindowState = {
  bounds: { width: 1100, height: 750 },
  maximized: false
}

const MIN_VISIBLE = 120
const SAVE_DEBOUNCE_MS = 400

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** 保存的位置可能来自已拔掉的显示器：至少要有一块屏能看到一角 */
function intersectsAnyDisplay(
  bounds: Partial<Rectangle> & { width: number; height: number }
): boolean {
  const candidate = {
    x: bounds.x ?? 0,
    y: bounds.y ?? 0,
    width: bounds.width,
    height: bounds.height
  }

  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapX =
      Math.min(candidate.x + candidate.width, workArea.x + workArea.width) -
      Math.max(candidate.x, workArea.x)
    const overlapY =
      Math.min(candidate.y + candidate.height, workArea.y + workArea.height) -
      Math.max(candidate.y, workArea.y)
    return overlapX >= MIN_VISIBLE && overlapY >= MIN_VISIBLE
  })
}

/**
 * 读取上次的窗口位置与尺寸。读不到、格式不对、或落在已断开的显示器上时
 * 一律退回默认尺寸并由系统居中，避免窗口开在屏幕外。
 */
export function loadWindowState(): WindowState {
  try {
    const path = statePath()
    if (!existsSync(path)) return DEFAULT_STATE

    const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (!isRecord(raw) || !isRecord(raw.bounds)) return DEFAULT_STATE

    const width = readFinite(raw.bounds.width)
    const height = readFinite(raw.bounds.height)
    if (!width || !height) return DEFAULT_STATE

    const x = readFinite(raw.bounds.x)
    const y = readFinite(raw.bounds.y)
    const bounds: WindowState['bounds'] = {
      width: Math.max(width, 480),
      height: Math.max(height, 360),
      ...(x !== undefined && y !== undefined ? { x, y } : {})
    }

    return {
      bounds: intersectsAnyDisplay(bounds)
        ? bounds
        : { width: bounds.width, height: bounds.height },
      maximized: raw.maximized === true
    }
  } catch {
    return DEFAULT_STATE
  }
}

/** 拖动/缩放后节流落盘；最大化时记录还原尺寸，否则恢复出来会是整屏 */
export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null

  const save = (): void => {
    if (win.isDestroyed()) return
    const maximized = win.isMaximized()
    const state: WindowState = {
      bounds: maximized ? win.getNormalBounds() : win.getBounds(),
      maximized
    }

    try {
      writeFileSync(statePath(), JSON.stringify(state))
    } catch {
      // 窗口位置丢了不影响使用，不值得打断关闭流程
    }
  }

  const scheduleSave = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, SAVE_DEBOUNCE_MS)
  }

  win.on('resize', scheduleSave)
  win.on('move', scheduleSave)
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    save()
  })
}
