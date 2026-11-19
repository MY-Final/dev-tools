import { useState, useCallback, useEffect, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { Download, FileText } from 'lucide-react'
import Sidebar from '@renderer/components/Sidebar'
import CommandPalette from '@renderer/components/CommandPalette'
import ShortcutHelp from '@renderer/components/ShortcutHelp'
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

// View Transitions：Chromium 111+（Electron 39 必然支持）。
// 运行时缺失、「减少动态」偏好、或文档不可见（窗口最小化/后台标签页）时
// 不启动过渡——隐藏文档下 Chromium 会把过渡挂起不执行，直切反而更可靠。
function supportsViewTransition(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if (document.visibilityState !== 'visible') return false
  return 'startViewTransition' in document
}

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
      // 同一页面重复导航不触发过渡：内容没变，淡一下反而是闪烁
      if (page === currentPage) return

      const commit = (): void => {
        setCurrentPage(page)
        // main-content 是跨页面复用的滚动容器，不重置的话
        // 新工具会停留在上一个页面的滚动位置
        document.getElementById('main-content')?.scrollTo({ top: 0 })
        const tool = getTool(page)
        if (tool && (!isWebRuntime() || supportsWeb(tool))) {
          void recordRecentTool(page)
        }
      }

      // 支持的运行时用视图过渡换内容（仅内容区纯淡化，见 base.css）；
      // flushSync 保证新 DOM 在快照前就位，lazy 页面未就绪时落到 Loading
      if (supportsViewTransition()) {
        let applied = false
        const transition = document.startViewTransition(() => {
          applied = true
          flushSync(commit)
        })
        // 三条 promise 都要有人接管：过渡被跳过时（元素被移除、渲染机会
        // 丢失等）Chromium 会 reject，没人 catch 就是一条 Uncaught (in promise)
        transition.ready.catch(() => {})
        transition.finished.catch(() => {})
        // 跳过过渡时 update callback 不会执行，导航会静默丢失，补一次直切。
        // callback 是异步调用的（实测 ~74ms），不能同步检查 applied
        transition.updateCallbackDone.catch(() => {
          if (!applied) commit()
        })
      } else {
        commit()
      }
    },
    [recordRecentTool, currentPage]
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
        navigate('settings')
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
        navigate('home')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, settings.appearance.sidebarCollapsed, currentPage, updateAppearance, navigate])

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
      <ShortcutHelp />
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
