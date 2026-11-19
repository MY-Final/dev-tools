import type React from 'react'
import { Home, Info, Moon, PanelLeft, Settings, Sun, Trash2 } from 'lucide-react'

/**
 * 命令面板里的「命令」——不跳转工具页，直接执行一个应用操作。
 * 与工具同池参与搜索，空查询时排在工具前面。
 */
export interface PaletteCommand {
  id: string
  name: string
  desc: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** 搜索别名：英文关键词 + 中文口语说法 */
  keywords: string[]
  /** 展示用快捷键，与设置里的全局快捷键保持一致 */
  shortcut?: string
  run: () => void
}

export interface PaletteCommandDeps {
  theme: 'light' | 'dark' | 'system'
  recentCount: number
  shortcuts: { toggleSidebar: string; openSettings: string; goHome: string }
  onToggleTheme: () => void
  onToggleSidebar: () => void
  onNavigate: (page: string) => void
  onClearRecent: () => void
}

/**
 * 构建当前上下文下可用的命令。主题命令的文案/图标随当前主题变化；
 * 「清空最近使用」只在有记录时出现，避免列出空操作。
 */
export function buildPaletteCommands(deps: PaletteCommandDeps): PaletteCommand[] {
  const isDark = deps.theme === 'dark'
  const commands: PaletteCommand[] = [
    {
      id: 'toggle-theme',
      name: isDark ? '切换到浅色模式' : '切换到深色模式',
      desc: '切换界面主题',
      icon: isDark ? Sun : Moon,
      keywords: ['theme', 'dark', 'light', 'night', '主题', '深色', '浅色', '夜间', '白天'],
      run: deps.onToggleTheme
    },
    {
      id: 'toggle-sidebar',
      name: '切换侧边栏',
      desc: '展开或收起导航栏',
      icon: PanelLeft,
      keywords: ['sidebar', '侧边栏', '侧栏', '导航', '折叠', '展开'],
      shortcut: deps.shortcuts.toggleSidebar,
      run: deps.onToggleSidebar
    },
    {
      id: 'go-home',
      name: '返回首页',
      desc: '回到工具总览',
      icon: Home,
      keywords: ['home', 'index', '首页', '主页', '总览'],
      shortcut: deps.shortcuts.goHome,
      run: () => deps.onNavigate('home')
    },
    {
      id: 'open-settings',
      name: '打开设置',
      desc: '外观、编辑器、快捷键等偏好',
      icon: Settings,
      keywords: ['settings', 'preferences', 'config', '设置', '偏好', '选项', '配置'],
      shortcut: deps.shortcuts.openSettings,
      run: () => deps.onNavigate('settings')
    },
    {
      id: 'open-about',
      name: '关于 Dev Tools',
      desc: '版本信息与更新',
      icon: Info,
      keywords: ['about', 'version', 'update', '关于', '版本', '更新'],
      run: () => deps.onNavigate('about')
    }
  ]

  if (deps.recentCount > 0) {
    commands.push({
      id: 'clear-recent',
      name: '清空最近使用',
      desc: `移除侧栏中的 ${deps.recentCount} 条记录`,
      icon: Trash2,
      keywords: ['recent', 'clear', 'history', '最近', '清空', '记录', '历史'],
      run: deps.onClearRecent
    })
  }

  return commands
}
