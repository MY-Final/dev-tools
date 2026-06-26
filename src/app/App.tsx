import { useState, useCallback, useEffect, Suspense } from 'react'
import Sidebar from '@renderer/components/Sidebar'
import CommandPalette from '@renderer/components/CommandPalette'
import Home from '@renderer/pages/Home'
import About from '@renderer/pages/About'
import SettingsPage from '@renderer/pages/SettingsPage'
import { getPageComponent } from '@renderer/pages/registry'
import { SettingsProvider, useSettings } from '@renderer/lib/contexts'
import { UpdaterProvider } from '@renderer/lib/updater-context'

function AppContent(): React.JSX.Element {
  const { settings, updateAppearance } = useSettings()
  const [currentPage, setCurrentPage] = useState('home')

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
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <PageComponent />
        </Suspense>
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
