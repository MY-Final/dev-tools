import { useState, useMemo } from 'react'
import { Search, Layers, Star, History, X } from 'lucide-react'
import { supportsWeb, tools } from '@renderer/tools/registry'
import type { ToolItem } from '@renderer/types/tool'
import { useSettings } from '@renderer/lib/contexts'
import { isWebRuntime } from '@renderer/lib/platform'
import { matchesToolQuery } from '@renderer/lib/tool-search'
import '../styles/home.css'

// ── Tags ──────────────────────────────────────────────────────

const ALL_TAGS = ['前端', '后端', '运维', '通用', '安全', '网络']

// ── Category tones ────────────────────────────────────────────
// 分类色只做标识，不参与交互；同一分类在首页与侧栏保持一致。

const CATEGORY_TONE: Record<string, number> = {
  换算工具: 1,
  网络工具: 2,
  系统工具: 3,
  '编码/加密': 4,
  开发工具: 5,
  文本工具: 6,
  速查表: 7,
  资源搜索: 8,
  备忘录: 9
}

// 首页卡片的方向键导航：按几何位置找最近的卡片，跨分类也能连续移动。
function handleGridKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
  const directions: Record<string, { x: number; y: number }> = {
    ArrowRight: { x: 1, y: 0 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowUp: { x: 0, y: -1 }
  }
  const direction = directions[event.key]
  if (!direction) return

  const target = event.target as HTMLElement
  if (!target.classList.contains('home-tool-card-main')) return
  const section = target.closest('.home-tools-section')
  if (!section) return

  const from = target.getBoundingClientRect()
  let best: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const card of section.querySelectorAll<HTMLElement>('.home-tool-card-main')) {
    if (card === target) continue
    const rect = card.getBoundingClientRect()
    const dx = rect.left - from.left
    const dy = rect.top - from.top
    const primary = dx * direction.x + dy * direction.y
    if (primary <= 2) continue
    const secondary = Math.abs(dx * direction.y - dy * direction.x)
    const score = primary + secondary * 2
    if (score < bestScore) {
      bestScore = score
      best = card
    }
  }

  if (!best) return
  event.preventDefault()
  best.focus({ preventScroll: true })
  best.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

interface ToolCardProps {
  tool: ToolItem
  favorite: boolean
  webRuntime: boolean
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}

function ToolCard({
  tool,
  favorite,
  webRuntime,
  onSelect,
  onToggleFavorite
}: ToolCardProps): React.JSX.Element {
  const Icon = tool.icon

  return (
    <div className="home-tool-card">
      <button type="button" className="home-tool-card-main" onClick={() => onSelect(tool.id)}>
        <span className="home-tool-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span className="home-tool-body">
          <span className="home-tool-title-row">
            <span className="home-tool-name">{tool.name}</span>
            {tool.isNew && <span className="home-tool-badge">新</span>}
            {webRuntime && !supportsWeb(tool) && (
              <span className="home-tool-badge" title="该工具需要下载桌面版">
                桌面端
              </span>
            )}
          </span>
          <span className="home-tool-desc">{tool.desc}</span>
        </span>
      </button>
      <button
        type="button"
        className={`home-tool-star ${favorite ? 'active' : ''}`}
        onClick={() => onToggleFavorite(tool.id)}
        title={favorite ? '取消收藏' : '收藏'}
        aria-pressed={favorite}
        aria-label={favorite ? `取消收藏${tool.name}` : `收藏${tool.name}`}
      >
        <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

interface HomeProps {
  onSelectTool: (id: string) => void
}

export default function Home({ onSelectTool }: HomeProps): React.JSX.Element {
  const { settings, updateFavorites, clearRecentTools } = useSettings()
  const favorites = settings.favorites
  const webRuntime = isWebRuntime()
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 最近使用：按运行环境过滤掉不可用的工具
  const recentTools = useMemo(() => {
    const resolved = settings.recentTools
      .map((id) => tools.find((t) => t.id === id))
      .filter((t): t is ToolItem => Boolean(t))
    return webRuntime ? resolved.filter((t) => supportsWeb(t)) : resolved
  }, [settings.recentTools, webRuntime])

  const filteredTools = useMemo(() => {
    let list = tools
    if (search.trim()) {
      list = list.filter((t) => matchesToolQuery(t, search))
    }
    if (selectedTag) {
      list = list.filter((t) => t.tags?.includes(selectedTag))
    }
    return list
  }, [search, selectedTag])

  const categories = useMemo(() => {
    const grouped: Map<string, { tools: ToolItem[]; icon: ToolItem['categoryIcon'] }> = new Map()
    for (const tool of filteredTools) {
      if (!grouped.has(tool.category)) {
        grouped.set(tool.category, { tools: [], icon: tool.categoryIcon })
      }
      grouped.get(tool.category)!.tools.push(tool)
    }
    return grouped
  }, [filteredTools])

  const totalTools = tools.length
  const totalCategories = new Set(tools.map((t) => t.category)).size

  return (
    <div className="home-page">
      <header className="home-masthead">
        <div className="home-masthead-row">
          <h1 className="home-title">Dev Tools</h1>
          <span className="home-meta">
            {totalTools} 个工具，{totalCategories} 个分类
          </span>
        </div>

        <div className="home-search-wrap">
          <Search size={16} className="home-search-icon" aria-hidden="true" />
          <input
            className="home-search-input"
            type="text"
            placeholder="搜索工具"
            aria-label="搜索工具"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <span className="home-search-result">{filteredTools.length} 个结果</span>
          ) : (
            <kbd className="home-search-kbd">Ctrl K</kbd>
          )}
        </div>

        <div className="home-tags" role="group" aria-label="按场景筛选">
          <button
            type="button"
            className={`home-tag ${selectedTag === null ? 'active' : ''}`}
            aria-pressed={selectedTag === null}
            onClick={() => setSelectedTag(null)}
          >
            全部
          </button>
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`home-tag ${selectedTag === tag ? 'active' : ''}`}
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      <section className="home-tools-section" onKeyDown={handleGridKeyDown}>
        {recentTools.length > 0 && !search.trim() && !selectedTag && (
          <div className="home-category home-recent">
            <div className="home-category-header">
              <span className="home-category-mark" aria-hidden="true" />
              <History size={14} className="home-recent-icon" aria-hidden="true" />
              <h2 className="home-category-title">最近使用</h2>
              <span className="home-category-count">{recentTools.length}</span>
              <button
                type="button"
                className="home-recent-clear"
                onClick={() => void clearRecentTools()}
                title="清空最近使用"
                aria-label="清空最近使用"
              >
                <X size={12} aria-hidden="true" />
                清空
              </button>
            </div>
            <div className="home-tool-grid">
              {recentTools.map((t) => (
                <ToolCard
                  key={t.id}
                  tool={t}
                  favorite={favorites.includes(t.id)}
                  webRuntime={webRuntime}
                  onSelect={onSelectTool}
                  onToggleFavorite={updateFavorites}
                />
              ))}
            </div>
          </div>
        )}

        {[...categories.entries()].map(([category, { tools: categoryTools }]) => {
          const tone = CATEGORY_TONE[category] ?? 1
          return (
            <div key={category} className={`home-category home-tone-${tone}`}>
              <div className="home-category-header">
                <span className="home-category-mark" aria-hidden="true" />
                <h2 className="home-category-title">{category}</h2>
                <span className="home-category-count">{categoryTools.length}</span>
              </div>
              <div className="home-tool-grid">
                {categoryTools.map((t) => (
                  <ToolCard
                    key={t.id}
                    tool={t}
                    favorite={favorites.includes(t.id)}
                    webRuntime={webRuntime}
                    onSelect={onSelectTool}
                    onToggleFavorite={updateFavorites}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {filteredTools.length === 0 && (
          <div className="home-empty">
            <Layers size={28} className="home-empty-icon" aria-hidden="true" />
            <span>没有找到匹配的工具</span>
            <button
              type="button"
              className="home-empty-reset"
              onClick={() => {
                setSearch('')
                setSelectedTag(null)
              }}
            >
              清除筛选
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
