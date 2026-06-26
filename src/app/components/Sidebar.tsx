import { useState, useMemo } from 'react'
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
  Lock
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
  __default: Wrench
}

// 分类默认折叠状态
const defaultCollapsedCategories: Record<string, boolean> = {}

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

  const handleToggleTheme = (): void => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    updateAppearance({ theme: newTheme })
  }
  // 按分类组织工具
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

  const categoryEntries = useMemo(
    () => [...toolsByCategory.entries()],
    [toolsByCategory]
  )

  // 分类折叠状态
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(
    defaultCollapsedCategories
  )

  const toggleCategory = (category: string): void => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

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

              {/* 收起时显示分类图标 */}
              {collapsed && (
                <div className="nav-category-collapsed" title={category}>
                  <CategoryIcon size={14} />
                </div>
              )}

              {/* 工具列表 */}
              {(!isCategoryCollapsed || collapsed) &&
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
                      onClick={() => onNavigate(tool.id)}
                      title={collapsed ? tool.name : undefined}
                    >
                      <Icon size={18} className="nav-icon" />
                      {!collapsed && <span className="nav-label">{tool.name}</span>}
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
    </aside>
  )
}
