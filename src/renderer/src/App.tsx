import { useState, useCallback, useEffect, Suspense } from 'react'
import { Download, FileText } from 'lucide-react'
import Sidebar from '@renderer/components/Sidebar'
import CommandPalette from '@renderer/components/CommandPalette'
import ToolHelp from '@renderer/components/ToolHelp'
import ElectronOnlyPage from '@renderer/components/ElectronOnlyPage'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import Home from '@renderer/pages/Home'
import About from '@renderer/pages/About'
import SettingsPage from '@renderer/pages/SettingsPage'
import Dialog from '@renderer/components/ui/dialog'
import { getPageComponent } from '@renderer/pages/registry'
import { getTool, supportsWeb } from '@renderer/tools/registry'
import { SettingsProvider, useSettings } from '@renderer/lib/contexts'
import { UpdaterProvider, useUpdater } from '@renderer/lib/updater-context'
import { isWebRuntime } from '@renderer/lib/platform'
import { matchShortcut } from '@renderer/lib/shortcuts'

function UpdatePrompt(): React.JSX.Element {
  const { status, isAvailable, releaseNotes, releaseDate, downloadUpdate } = useUpdater()
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  if (!isAvailable || status.type !== 'available' || dismissedVersion === status.version) {
    return <></>
  }

  const formatReleaseDate = (date?: string): string => {
    if (!date) return ''
    try {
      return new Date(date).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return date
    }
  }

  const dismiss = (): void => setDismissedVersion(status.version)

  return (
    <Dialog
      open
      onClose={dismiss}
      title={
        <>
          <FileText size={16} aria-hidden="true" />
          发现新版本 {status.version}
        </>
      }
      footer={
        <>
          <button className="settings-btn settings-btn-secondary" onClick={dismiss}>
            稍后
          </button>
          <button className="settings-btn settings-btn-primary" onClick={downloadUpdate}>
            <Download size={14} aria-hidden="true" />
            下载更新
          </button>
        </>
      }
    >
      {releaseDate && (
        <div className="settings-modal-date">发布日期：{formatReleaseDate(releaseDate)}</div>
      )}
      {releaseNotes ? (
        <div className="settings-modal-notes" dangerouslySetInnerHTML={{ __html: releaseNotes }} />
      ) : (
        <div className="settings-modal-empty">发现新版本，可选择立即下载更新。</div>
      )}
    </Dialog>
  )
}

function AppContent(): React.JSX.Element {
  const { settings, updateAppearance, recordRecentTool } = useSettings()
  const [currentPage, setCurrentPage] = useState('home')
  const shortcuts = settings.shortcuts

  // 记录最近使用（仅记录当前运行环境下可用的工具）
  const navigate = useCallback(
    (page: string): void => {
      setCurrentPage(page)
      const tool = getTool(page)
      if (tool && (!isWebRuntime() || supportsWeb(tool))) {
        void recordRecentTool(page)
      }
    },
    [recordRecentTool]
  )

  // 应用主题
  useEffect(() => {
    const theme = settings.appearance.theme
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [settings.appearance.theme])

  // 应用字体大小
  useEffect(() => {
    const fontSize = settings.appearance.fontSize
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [settings.appearance.fontSize])

  const handleToggleCollapse = useCallback(() => {
    updateAppearance({ sidebarCollapsed: !settings.appearance.sidebarCollapsed })
  }, [settings.appearance.sidebarCollapsed, updateAppearance])

  // 全局快捷键（从设置中读取）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // 在输入框中不处理快捷键
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // 切换侧边栏
      if (matchShortcut(shortcuts.toggleSidebar, e)) {
        e.preventDefault()
        updateAppearance({ sidebarCollapsed: !settings.appearance.sidebarCollapsed })
        return
      }

      // 打开设置
      if (matchShortcut(shortcuts.openSettings, e)) {
        e.preventDefault()
        setCurrentPage('settings')
        return
      }

      // 返回首页（非输入框中，且没有弹层正在处理 Esc）
      const hasOpenDialog = document.querySelector('[role="dialog"]') !== null
      if (
        matchShortcut(shortcuts.goHome, e) &&
        !isInput &&
        !hasOpenDialog &&
        currentPage !== 'home'
      ) {
        setCurrentPage('home')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, settings.appearance.sidebarCollapsed, currentPage, updateAppearance])

  // ── Render ──────────────────────────────────────────────────
  const renderPage = (): React.JSX.Element => {
    // Special pages
    if (currentPage === 'home') return <Home onSelectTool={navigate} />
    if (currentPage === 'about') return <About />
    if (currentPage === 'settings') return <SettingsPage onSelectTool={navigate} />

    // Tool pages via registry
    const PageComponent = getPageComponent(currentPage)
    if (PageComponent) {
      const tool = getTool(currentPage)
      const page = (
        <div className="tool-shell">
          <section className="tool-shell-main">
            <ToolHelp toolId={currentPage} />
            <PageComponent />
          </section>
        </div>
      )

      return (
        <ErrorBoundary>
          <Suspense fallback={<div className="page-loading">Loading…</div>}>
            {tool && !supportsWeb(tool) ? (
              <ElectronOnlyPage toolName={tool.name}>{page}</ElectronOnlyPage>
            ) : (
              page
            )}
          </Suspense>
        </ErrorBoundary>
      )
    }

    // Fallback
    return <Home onSelectTool={navigate} />
  }

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
        collapsed={settings.appearance.sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <main id="main-content" className="main-content" tabIndex={-1}>
        {renderPage()}
      </main>
      <CommandPalette currentPage={currentPage} onNavigate={navigate} />
      <UpdatePrompt />
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <SettingsProvider>
      <UpdaterProvider>
        <AppContent />
      </UpdaterProvider>
    </SettingsProvider>
  )
}

export default App
