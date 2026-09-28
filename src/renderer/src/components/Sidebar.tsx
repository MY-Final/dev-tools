import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Home,
  Settings,
  Info,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Calculator,
  Globe,
  Wrench,
  Monitor,
  FileText,
  BookMarked,
  ListTodo,
  Lock,
  Search,
  Star,
  Menu,
  X
} from 'lucide-react'
import { tools } from '@renderer/tools/registry'
import { cn } from '@renderer/lib/utils'
import { useSettings } from '@renderer/lib/contexts'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

type ViewportMode = 'mobile' | 'tablet' | 'desktop'

function getViewportMode(): ViewportMode {
  if (window.innerWidth < 768) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

// 分类图标映射
const categoryIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  换算工具: Calculator,
  网络工具: Globe,
  系统工具: Monitor,
  '编码/加密': Lock,
  开发工具: Wrench,
  文本工具: FileText,
  速查表: BookMarked,
  备忘录: ListTodo,
  资源搜索: Search,
  __default: Wrench
}

const navItems = [{ id: 'home', label: '首页', icon: Home }]

const bottomItems = [
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'about', label: '关于', icon: Info }
]

function NavButton({
  item,
  active,
  collapsed,
  onClick
}: {
  item: {
    id: string
    label: string
    icon: React.ComponentType<{ size?: number; className?: string }>
  }
  active: boolean
  collapsed: boolean
  onClick: () => void
}): React.JSX.Element {
  const Icon = item.icon
  return (
    <button
      type="button"
      className={cn('nav-icon-btn', active && 'active', collapsed && 'collapsed')}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={18} className="nav-icon" />
      {!collapsed && <span className="nav-label">{item.label}</span>}
      {collapsed && <span className="nav-tooltip">{item.label}</span>}
    </button>
  )
}

export default function Sidebar({
  currentPage,
  onNavigate,
  collapsed,
  onToggleCollapse
}: SidebarProps): React.JSX.Element {
  const { settings, updateAppearance } = useSettings()
  const theme = settings.appearance.theme
  const showShortDesc = settings.appearance.showSidebarShortDesc
  const favorites = settings.favorites

  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => getViewportMode())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tabletCollapsed, setTabletCollapsed] = useState(true)
  const viewportModeRef = useRef<ViewportMode>(viewportMode)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const flyoutTriggerRef = useRef<HTMLButtonElement | null>(null)

  const effectiveCollapsed =
    viewportMode === 'desktop' ? collapsed : viewportMode === 'tablet' ? tabletCollapsed : false

  const handleToggleTheme = (): void => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    updateAppearance({ theme: newTheme })
  }

  // 按分类组织工具（tools 为静态导入，不变）
  const toolsByCategory = useMemo(() => {
    const grouped: Map<string, typeof tools> = new Map()
    for (const tool of tools) {
      const category = tool.category || '其他'
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(tool)
    }
    return grouped
  }, [])

  const categoryEntries = useMemo(() => [...toolsByCategory.entries()], [toolsByCategory])

  // 收藏工具列表（按收藏顺序，过滤掉已不存在的工具）
  const favoriteTools = useMemo(
    () => favorites.map((id) => tools.find((t) => t.id === id)).filter(Boolean) as typeof tools,
    [favorites]
  )

  const handleNavigate = useCallback(
    (page: string): void => {
      onNavigate(page)
      if (viewportMode === 'mobile') {
        setMobileOpen(false)
        window.requestAnimationFrame(() => mobileToggleRef.current?.focus())
      }
    },
    [onNavigate, viewportMode]
  )

  const navigateToTool = useCallback(
    (toolId: string): void => {
      handleNavigate(toolId)
    },
    [handleNavigate]
  )

  const openCommandPalette = useCallback((): void => {
    window.dispatchEvent(new Event('command-palette:open'))
  }, [])

  // 默认只展开第一个分类，其余折叠
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    const entries = [...toolsByCategory.entries()]
    const state: Record<string, boolean> = {}
    entries.forEach(([category], index) => {
      if (index > 0) state[category] = true
    })
    return state
  })

  const toggleCategory = (category: string): void => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // 收起侧边栏时显示分类工具菜单
  const [flyoutCategory, setFlyoutCategory] = useState<{ name: string; top: number } | null>(null)
  const flyoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFlyoutTimer = useCallback((): void => {
    if (flyoutTimerRef.current !== null) {
      clearTimeout(flyoutTimerRef.current)
      flyoutTimerRef.current = null
    }
  }, [])

  const closeMobile = useCallback((restoreFocus = true): void => {
    setMobileOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileToggleRef.current?.focus())
    }
  }, [])

  const handleToggleCollapse = useCallback((): void => {
    if (viewportMode === 'mobile') {
      closeMobile()
      return
    }

    if (viewportMode === 'tablet') {
      setTabletCollapsed((value) => !value)
      return
    }

    onToggleCollapse()
  }, [closeMobile, onToggleCollapse, viewportMode])

  const handleCategoryMouseEnter = useCallback(
    (category: string, e: React.MouseEvent<HTMLButtonElement>): void => {
      clearFlyoutTimer()
      const rect = e.currentTarget.getBoundingClientRect()
      setFlyoutCategory({ name: category, top: rect.top })
    },
    [clearFlyoutTimer]
  )

  const handleCategoryClick = useCallback(
    (category: string, e: React.MouseEvent<HTMLButtonElement>): void => {
      clearFlyoutTimer()
      flyoutTriggerRef.current = e.currentTarget
      const rect = e.currentTarget.getBoundingClientRect()
      setFlyoutCategory({ name: category, top: rect.top })
    },
    [clearFlyoutTimer]
  )

  const handleCategoryKeyDown = useCallback(
    (category: string, e: React.KeyboardEvent<HTMLButtonElement>): void => {
      if (e.key !== 'ArrowDown') return
      e.preventDefault()
      clearFlyoutTimer()
      flyoutTriggerRef.current = e.currentTarget
      const rect = e.currentTarget.getBoundingClientRect()
      setFlyoutCategory({ name: category, top: rect.top })
      window.requestAnimationFrame(() => {
        flyoutRef.current?.querySelector<HTMLButtonElement>('.nav-flyout-item')?.focus()
      })
    },
    [clearFlyoutTimer]
  )

  const handleFlyoutKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setFlyoutCategory(null)
      flyoutTriggerRef.current?.focus()
      return
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.nav-flyout-item')]
    if (items.length === 0) return

    e.preventDefault()
    const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex =
      e.key === 'ArrowDown'
        ? (activeIndex + 1) % items.length
        : (activeIndex - 1 + items.length) % items.length
    items[nextIndex].focus()
  }, [])

  const handleFlyoutClose = useCallback((): void => {
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutCategory(null)
      flyoutTimerRef.current = null
    }, 200)
  }, [])

  const handleFlyoutEnter = useCallback((): void => {
    clearFlyoutTimer()
  }, [clearFlyoutTimer])

  useEffect(() => {
    const handleResize = (): void => {
      const nextMode = getViewportMode()
      if (nextMode === viewportModeRef.current) return

      viewportModeRef.current = nextMode
      setViewportMode(nextMode)
      setMobileOpen(false)
      setTabletCollapsed(true)
      setFlyoutCategory(null)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (viewportMode !== 'mobile' || !mobileOpen) return
    mobileCloseRef.current?.focus()
  }, [mobileOpen, viewportMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return

      if (flyoutCategory) {
        setFlyoutCategory(null)
        flyoutTriggerRef.current?.focus()
        return
      }

      if (mobileOpen) {
        closeMobile()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeMobile, flyoutCategory, mobileOpen])

  useEffect(() => {
    if (!flyoutCategory) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (flyoutRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.nav-category-collapsed')) return
      setFlyoutCategory(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [flyoutCategory])

  // unmount 时清理 flyout 定时器
  useEffect(() => {
    return () => clearFlyoutTimer()
  }, [clearFlyoutTimer])

  const flyoutData = flyoutCategory
    ? flyoutCategory.name === '__favorites__'
      ? (['收藏', favoriteTools] as [string, typeof tools])
      : (categoryEntries.find(([name]) => name === flyoutCategory.name) ?? null)
    : null

  const flyoutTop = flyoutCategory ? flyoutCategory.top : 0
  const sidebarId = 'app-sidebar'

  return (
    <>
      <button
        ref={mobileToggleRef}
        type="button"
        className="sidebar-mobile-toggle"
        aria-label="打开导航菜单"
        aria-controls={sidebarId}
        aria-expanded={viewportMode === 'mobile' && mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>

      {viewportMode === 'mobile' && mobileOpen && (
        <button
          type="button"
          className="sidebar-mobile-backdrop"
          aria-label="关闭导航菜单"
          tabIndex={-1}
          onClick={() => closeMobile()}
        />
      )}

      <aside
        ref={sidebarRef}
        id={sidebarId}
        className={cn(
          'sidebar',
          effectiveCollapsed && 'sidebar-collapsed',
          viewportMode === 'mobile' && mobileOpen && 'sidebar-mobile-open'
        )}
        aria-label="主导航"
        aria-hidden={viewportMode === 'mobile' && !mobileOpen}
      >
        <div className="sidebar-mobile-header">
          <span className="sidebar-mobile-title">导航</span>
          <button
            ref={mobileCloseRef}
            type="button"
            className="sidebar-mobile-close"
            aria-label="关闭导航菜单"
            onClick={() => closeMobile()}
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-scroll">
          {/* 首页 */}
          <div className="nav-group">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={currentPage === item.id}
                collapsed={effectiveCollapsed}
                onClick={() => handleNavigate(item.id)}
              />
            ))}
          </div>

          {!effectiveCollapsed && (
            <button className="sidebar-search" type="button" onClick={openCommandPalette}>
              <Search size={14} className="sidebar-search-icon" />
              <span className="sidebar-search-input">快速搜索...</span>
              <kbd className="sidebar-search-kbd">Ctrl K</kbd>
            </button>
          )}

          {/* 收藏 */}
          {favoriteTools.length > 0 && (
            <div className="nav-group">
              {!effectiveCollapsed && (
                <div className="nav-category-header nav-favorites-header">
                  <Star size={14} className="nav-category-icon nav-favorites-icon" />
                  <span className="nav-category-label">收藏</span>
                  <span className="nav-category-count">{favoriteTools.length}</span>
                </div>
              )}
              {effectiveCollapsed && (
                <button
                  type="button"
                  className="nav-category-collapsed nav-favorites-collapsed"
                  title="收藏"
                  aria-label="收藏工具"
                  aria-expanded={flyoutCategory?.name === '__favorites__'}
                  aria-controls="sidebar-flyout"
                  onClick={(e) => handleCategoryClick('__favorites__', e)}
                  onMouseEnter={(e) => handleCategoryMouseEnter('__favorites__', e)}
                  onMouseLeave={handleFlyoutClose}
                  onKeyDown={(e) => handleCategoryKeyDown('__favorites__', e)}
                >
                  <Star size={14} />
                </button>
              )}
              {!effectiveCollapsed &&
                favoriteTools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={cn(
                        'nav-icon-btn',
                        currentPage === tool.id && 'active',
                        effectiveCollapsed && 'collapsed'
                      )}
                      onClick={() => navigateToTool(tool.id)}
                      aria-current={currentPage === tool.id ? 'page' : undefined}
                    >
                      <Icon size={18} className="nav-icon" />
                      <div className="nav-label-wrapper">
                        <span className="nav-label">{tool.name}</span>
                        {showShortDesc && <span className="nav-desc">{tool.shortDesc}</span>}
                      </div>
                    </button>
                  )
                })}
            </div>
          )}

          {/* 工具分类 */}
          {categoryEntries.map(([category, categoryTools], categoryIndex) => {
            const CategoryIcon = categoryIcons[category] || categoryIcons.__default
            const isCategoryCollapsed = collapsedCategories[category] ?? false
            const categoryToolsId = `sidebar-category-tools-${categoryIndex}`

            return (
              <div key={category} className="nav-group">
                {/* 分类标题（仅展开时显示） */}
                {!effectiveCollapsed && (
                  <button
                    type="button"
                    className="nav-category-header"
                    onClick={() => toggleCategory(category)}
                    aria-expanded={!isCategoryCollapsed}
                    aria-controls={categoryToolsId}
                  >
                    <CategoryIcon size={14} className="nav-category-icon" />
                    <span className="nav-category-label">{category}</span>
                    <ChevronDown
                      size={12}
                      className={`nav-category-arrow ${isCategoryCollapsed ? 'collapsed' : ''}`}
                    />
                  </button>
                )}

                {/* 收起时显示分类图标 + 点击/键盘弹出菜单 */}
                {effectiveCollapsed && (
                  <button
                    type="button"
                    className="nav-category-collapsed"
                    title={category}
                    aria-label={`${category}分类`}
                    aria-expanded={flyoutCategory?.name === category}
                    aria-controls="sidebar-flyout"
                    onClick={(e) => handleCategoryClick(category, e)}
                    onMouseEnter={(e) => handleCategoryMouseEnter(category, e)}
                    onMouseLeave={handleFlyoutClose}
                    onKeyDown={(e) => handleCategoryKeyDown(category, e)}
                  >
                    <CategoryIcon size={14} />
                  </button>
                )}

                {/* 工具列表 — 收起侧边栏时不显示工具按钮 */}
                {!effectiveCollapsed && !isCategoryCollapsed && (
                  <div id={categoryToolsId} className="nav-category-tools">
                    {categoryTools.map((tool) => {
                      const Icon = tool.icon
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          className={cn('nav-icon-btn', currentPage === tool.id && 'active')}
                          onClick={() => navigateToTool(tool.id)}
                          aria-current={currentPage === tool.id ? 'page' : undefined}
                        >
                          <Icon size={18} className="nav-icon" />
                          <div className="nav-label-wrapper">
                            <span className="nav-label">{tool.name}</span>
                            {showShortDesc && <span className="nav-desc">{tool.shortDesc}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={cn('nav-icon-btn', effectiveCollapsed && 'collapsed')}
            onClick={handleToggleTheme}
            title={effectiveCollapsed ? (theme === 'dark' ? '浅色模式' : '深色模式') : undefined}
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? (
              <Sun size={18} className="nav-icon" />
            ) : (
              <Moon size={18} className="nav-icon" />
            )}
            {!effectiveCollapsed && (
              <span className="nav-label">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
            )}
            {effectiveCollapsed && (
              <span className="nav-tooltip">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
            )}
          </button>
          {bottomItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={currentPage === item.id}
              collapsed={effectiveCollapsed}
              onClick={() => handleNavigate(item.id)}
            />
          ))}
          <button
            type="button"
            className={cn('nav-icon-btn', effectiveCollapsed && 'collapsed')}
            onClick={handleToggleCollapse}
            title={viewportMode === 'mobile' ? '关闭菜单' : effectiveCollapsed ? '展开' : '收起'}
            aria-label={
              viewportMode === 'mobile'
                ? '关闭导航菜单'
                : effectiveCollapsed
                  ? '展开侧栏'
                  : '收起侧栏'
            }
          >
            {effectiveCollapsed ? (
              <ChevronsRight size={18} className="nav-icon" />
            ) : (
              <ChevronsLeft size={18} className="nav-icon" />
            )}
            {!effectiveCollapsed && (
              <span className="nav-label">{viewportMode === 'mobile' ? '关闭菜单' : '收起'}</span>
            )}
            {effectiveCollapsed && <span className="nav-tooltip">展开</span>}
          </button>
        </div>

        {/* 收起时点击/悬停弹出的分类工具菜单 */}
        {effectiveCollapsed && flyoutData && (
          <div
            ref={flyoutRef}
            id="sidebar-flyout"
            className="nav-flyout"
            style={{ top: flyoutTop }}
            onMouseEnter={handleFlyoutEnter}
            onMouseLeave={handleFlyoutClose}
            onKeyDown={handleFlyoutKeyDown}
          >
            <div className="nav-flyout-header">
              {(() => {
                const Icon =
                  flyoutData[0] === '收藏'
                    ? Star
                    : categoryIcons[flyoutData[0]] || categoryIcons.__default
                return <Icon size={14} />
              })()}
              <span>{flyoutData[0]}</span>
            </div>
            {flyoutData[1].map((tool) => {
              const ToolIcon = tool.icon
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={cn('nav-flyout-item', currentPage === tool.id && 'active')}
                  onClick={() => {
                    handleNavigate(tool.id)
                    setFlyoutCategory(null)
                  }}
                  aria-current={currentPage === tool.id ? 'page' : undefined}
                >
                  <ToolIcon size={16} />
                  <span className="nav-flyout-label">{tool.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </aside>
    </>
  )
}
