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
  Lock,
  Search,
  Star
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

// 分类图标映射
const categoryIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  换算工具: Calculator,
  网络工具: Globe,
  系统工具: Monitor,
  '编码/加密': Lock,
  开发工具: Wrench,
  文本工具: FileText,
  备忘录: BookMarked,
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
      className={cn('nav-icon-btn', active && 'active', collapsed && 'collapsed')}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryEntries = useMemo(
    () => [...toolsByCategory.entries()],
    [toolsByCategory]
  )

  // 收藏工具列表（按收藏顺序，过滤掉已不存在的工具）
  const favoriteTools = useMemo(
    () => favorites.map((id) => tools.find((t) => t.id === id)).filter(Boolean) as typeof tools,
    [favorites]
  )

  const navigateToTool = useCallback(
    (toolId: string): void => {
      onNavigate(toolId)
    },
    [onNavigate]
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

  // 侧边栏收起时悬浮显示分类工具菜单
  const [flyoutCategory, setFlyoutCategory] = useState<{ name: string; top: number } | null>(null)
  const flyoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFlyoutTimer = useCallback((): void => {
    if (flyoutTimerRef.current !== null) {
      clearTimeout(flyoutTimerRef.current)
      flyoutTimerRef.current = null
    }
  }, [])

  const handleCategoryMouseEnter = useCallback(
    (category: string, e: React.MouseEvent<HTMLDivElement>): void => {
      clearFlyoutTimer()
      const rect = e.currentTarget.getBoundingClientRect()
      setFlyoutCategory({ name: category, top: rect.top })
    },
    [clearFlyoutTimer]
  )

  const handleFlyoutClose = useCallback((): void => {
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutCategory(null)
      flyoutTimerRef.current = null
    }, 200)
  }, [])

  const handleFlyoutEnter = useCallback((): void => {
    clearFlyoutTimer()
  }, [clearFlyoutTimer])

  // unmount 时清理 flyout 定时器
  useEffect(() => {
    return () => clearFlyoutTimer()
  }, [clearFlyoutTimer])

  const flyoutData = flyoutCategory
    ? flyoutCategory.name === '__favorites__'
      ? (['收藏', favoriteTools] as [string, typeof tools])
      : categoryEntries.find(([name]) => name === flyoutCategory.name) ?? null
    : null

  const flyoutTop = flyoutCategory ? flyoutCategory.top : 0

  return (
    <aside className={cn('sidebar', collapsed && 'sidebar-collapsed')}>
      <div className="sidebar-scroll">
        {/* 首页 */}
        <div className="nav-group">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={currentPage === item.id}
              collapsed={collapsed}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>

        {!collapsed && (
          <button className="sidebar-search" type="button" onClick={openCommandPalette}>
            <Search size={14} className="sidebar-search-icon" />
            <span className="sidebar-search-input">快速搜索...</span>
            <kbd className="sidebar-search-kbd">Ctrl K</kbd>
          </button>
        )}

        {/* 收藏 */}
        {favoriteTools.length > 0 && (
          <div className="nav-group">
            {!collapsed && (
              <div className="nav-category-header nav-favorites-header">
                <Star size={14} className="nav-category-icon nav-favorites-icon" />
                <span className="nav-category-label">收藏</span>
                <span className="nav-category-count">{favoriteTools.length}</span>
              </div>
            )}
            {collapsed && (
              <div
                className="nav-category-collapsed nav-favorites-collapsed"
                title="收藏"
                onMouseEnter={(e) => handleCategoryMouseEnter('__favorites__', e)}
                onMouseLeave={handleFlyoutClose}
              >
                <Star size={14} />
              </div>
            )}
            {!collapsed &&
              favoriteTools.map((tool) => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.id}
                    className={cn(
                      'nav-icon-btn',
                      currentPage === tool.id && 'active',
                      collapsed && 'collapsed'
                    )}
                    onClick={() => navigateToTool(tool.id)}
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
        {categoryEntries.map(([category, categoryTools]) => {
          const CategoryIcon = categoryIcons[category] || categoryIcons.__default
          const isCategoryCollapsed = collapsedCategories[category] ?? false

          return (
            <div key={category} className="nav-group">
              {/* 分类标题（仅展开时显示） */}
              {!collapsed && (
                <button className="nav-category-header" onClick={() => toggleCategory(category)}>
                  <CategoryIcon size={14} className="nav-category-icon" />
                  <span className="nav-category-label">{category}</span>
                  <ChevronDown
                    size={12}
                    className={`nav-category-arrow ${isCategoryCollapsed ? 'collapsed' : ''}`}
                  />
                </button>
              )}

              {/* 收起时显示分类图标 + 悬浮弹出菜单 */}
              {collapsed && (
                <div
                  className="nav-category-collapsed"
                  title={category}
                  onMouseEnter={(e) => handleCategoryMouseEnter(category, e)}
                  onMouseLeave={handleFlyoutClose}
                >
                  <CategoryIcon size={14} />
                </div>
              )}

              {/* 工具列表 — 收起侧边栏时不显示工具按钮 */}
              {!collapsed && !isCategoryCollapsed &&
                categoryTools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      className={cn(
                        'nav-icon-btn',
                        currentPage === tool.id && 'active',
                        collapsed && 'collapsed'
                      )}
                      onClick={() => navigateToTool(tool.id)}
                    >
                      <Icon size={18} className="nav-icon" />
                      {!collapsed && (
                        <div className="nav-label-wrapper">
                          <span className="nav-label">{tool.name}</span>
                          {showShortDesc && <span className="nav-desc">{tool.shortDesc}</span>}
                        </div>
                      )}
                      {collapsed && <span className="nav-tooltip">{tool.name}</span>}
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>

      <div className="sidebar-bottom">
        <button
          className={cn('nav-icon-btn', collapsed && 'collapsed')}
          onClick={handleToggleTheme}
          title={collapsed ? (theme === 'dark' ? '浅色模式' : '深色模式') : undefined}
        >
          {theme === 'dark' ? (
            <Sun size={18} className="nav-icon" />
          ) : (
            <Moon size={18} className="nav-icon" />
          )}
          {!collapsed && (
            <span className="nav-label">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
          )}
          {collapsed && (
            <span className="nav-tooltip">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
          )}
        </button>
        {bottomItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={currentPage === item.id}
            collapsed={collapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}
        <button
          className={cn('nav-icon-btn', collapsed && 'collapsed')}
          onClick={onToggleCollapse}
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? (
            <ChevronsRight size={18} className="nav-icon" />
          ) : (
            <ChevronsLeft size={18} className="nav-icon" />
          )}
          {!collapsed && <span className="nav-label">收起</span>}
          {collapsed && <span className="nav-tooltip">展开</span>}
        </button>
      </div>

      {/* 收起时悬停弹出的分类工具菜单（fixed 避免被 overflow:hidden 裁剪） */}
      {collapsed && flyoutData && (
        <div
          className="nav-flyout"
          style={{ top: flyoutTop }}
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleFlyoutClose}
        >
          <div className="nav-flyout-header">
            {(() => {
              const Icon = categoryIcons[flyoutData[0]] || categoryIcons.__default
              return <Icon size={14} />
            })()}
            <span>{flyoutData[0]}</span>
          </div>
          {flyoutData[1].map((tool) => {
            const ToolIcon = tool.icon
            return (
              <button
                key={tool.id}
                className={cn('nav-flyout-item', currentPage === tool.id && 'active')}
                onClick={() => {
                  onNavigate(tool.id)
                  setFlyoutCategory(null)
                }}
              >
                <ToolIcon size={16} />
                <span className="nav-flyout-label">{tool.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
