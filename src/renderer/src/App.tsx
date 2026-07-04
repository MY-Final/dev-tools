import { useState, useCallback, useEffect, Suspense } from 'react'
import { Download, FileText, X } from 'lucide-react'
import Sidebar from '@renderer/components/Sidebar'
import CommandPalette from '@renderer/components/CommandPalette'
import ToolHelp from '@renderer/components/ToolHelp'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import Home from '@renderer/pages/Home'
import About from '@renderer/pages/About'
import SettingsPage from '@renderer/pages/SettingsPage'
import { getPageComponent } from '@renderer/pages/registry'
import { SettingsProvider, useSettings } from '@renderer/lib/contexts'
import { UpdaterProvider, useUpdater } from '@renderer/lib/updater-context'
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

  return (
    <div className="settings-overlay" onClick={() => setDismissedVersion(status.version)}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3 className="settings-modal-title">
            <FileText size={16} />
            发现新版本 {status.version}
          </h3>
          <button className="settings-modal-close" onClick={() => setDismissedVersion(status.version)}>
            <X size={16} />
          </button>
        </div>
        <div className="settings-modal-body">
          {releaseDate && <div className="settings-modal-date">发布日期：{formatReleaseDate(releaseDate)}</div>}
          {releaseNotes ? (
            <div className="settings-modal-notes" dangerouslySetInnerHTML={{ __html: releaseNotes }} />
          ) : (
            <div className="settings-modal-empty">发现新版本，可选择立即下载更新。</div>
          )}
        </div>
        <div className="settings-modal-footer">
          <button className="settings-btn settings-btn-secondary" onClick={() => setDismissedVersion(status.version)}>
            稍后
          </button>
          <button className="settings-btn settings-btn-primary" onClick={downloadUpdate}>
            <Download size={14} />
            下载更新
          </button>
        </div>
      </div>
    </div>
  )
}

function AppContent(): React.JSX.Element {
  const { settings, updateAppearance } = useSettings()
  const [currentPage, setCurrentPage] = useState('home')
  const shortcuts = settings.shortcuts

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

      // 返回首页（非输入框中）
      if (matchShortcut(shortcuts.goHome, e) && !isInput && currentPage !== 'home') {
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
    if (currentPage === 'home') return <Home onSelectTool={setCurrentPage} />
    if (currentPage === 'about') return <About />
    if (currentPage === 'settings') return <SettingsPage />

    // Tool pages via registry
    const PageComponent = getPageComponent(currentPage)
    if (PageComponent) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<div className="page-loading">Loading…</div>}>
            <div className="tool-shell">
              <section className="tool-shell-main">
                <ToolHelp toolId={currentPage} />
                <PageComponent />
              </section>
            </div>
          </Suspense>
        </ErrorBoundary>
      )
    }

    // Fallback
    return <Home onSelectTool={setCurrentPage} />
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={settings.appearance.sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <main className="main-content">{renderPage()}</main>
      <CommandPalette currentPage={currentPage} onNavigate={setCurrentPage} />
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
