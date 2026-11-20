import { nativeTheme, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { settingsStore } from './settings'

/** 与渲染进程 .titlebar 的高度保持一致（见 styles/titlebar.css） */
export const TITLEBAR_HEIGHT = 34

interface ChromeColors {
  background: string
  symbols: string
}

// 取自渲染进程的设计令牌（base.css），系统绘制的那部分按钮也得跟着主题走
const CHROME_COLORS: Record<'dark' | 'light', ChromeColors> = {
  dark: { background: '#1a1a18', symbols: '#b4b0a5' },
  light: { background: '#f6f6f4', symbols: '#55534d' }
}

function resolveTheme(): 'dark' | 'light' {
  const { theme } = settingsStore.getAppearance()
  if (theme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return theme
}

export function getChromeColors(): ChromeColors {
  return CHROME_COLORS[resolveTheme()]
}

/**
 * 各平台的窗口外观：
 * - Windows：隐藏原生标题栏，用 titleBarOverlay 保留系统的最小化/最大化/关闭（含贴靠布局）
 * - macOS：hiddenInset，红绿灯内嵌到自绘标题栏左侧
 * - Linux：保持原生窗框——overlay 在不同桌面环境下表现不一致，不值得为此冒险
 */
export function getTitleBarOptions(): BrowserWindowConstructorOptions {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset' }
  }

  if (process.platform === 'win32') {
    const colors = getChromeColors()
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: colors.background,
        symbolColor: colors.symbols,
        height: TITLEBAR_HEIGHT
      }
    }
  }

  return {}
}

/**
 * 主题切换后同步窗口底色与系统按钮颜色。
 * 只在启用 overlay 的 Windows 上有效，其余平台仅更新底色。
 */
export function applyWindowChrome(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return

  const colors = getChromeColors()
  win.setBackgroundColor(colors.background)

  if (process.platform !== 'win32') return

  try {
    win.setTitleBarOverlay({
      color: colors.background,
      symbolColor: colors.symbols,
      height: TITLEBAR_HEIGHT
    })
  } catch {
    // 窗口未启用 overlay 时调用会抛错，忽略即可
  }
}

/** 跟随系统深浅色：只有主题设为 system 时才有实际效果 */
export function watchSystemTheme(getWindow: () => BrowserWindow | null): void {
  nativeTheme.on('updated', () => applyWindowChrome(getWindow()))
}
