import { useState, useMemo } from 'react'
import { Search, Layers, Star } from 'lucide-react'
import { tools } from '@renderer/tools/registry'
import type { ToolItem } from '@renderer/types/tool'
import { useSettings } from '@renderer/lib/contexts'
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

interface HomeProps {
  onSelectTool: (id: string) => void
}

export default function Home({ onSelectTool }: HomeProps): React.JSX.Element {
  const { settings, updateFavorites } = useSettings()
  const favorites = settings.favorites
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const filteredTools = useMemo(() => {
    let list = tools
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
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

      <section className="home-tools-section">
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
                {categoryTools.map((t) => {
                  const Icon = t.icon
                  const isFavorite = favorites.includes(t.id)
                  return (
                    <div key={t.id} className="home-tool-card">
                      <button
                        type="button"
                        className="home-tool-card-main"
                        onClick={() => onSelectTool(t.id)}
                      >
                        <span className="home-tool-icon" aria-hidden="true">
                          <Icon size={17} />
                        </span>
                        <span className="home-tool-body">
                          <span className="home-tool-title-row">
                            <span className="home-tool-name">{t.name}</span>
                            {t.isNew && <span className="home-tool-badge">新</span>}
                          </span>
                          <span className="home-tool-desc">{t.desc}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`home-tool-star ${isFavorite ? 'active' : ''}`}
                        onClick={() => updateFavorites(t.id)}
                        title={isFavorite ? '取消收藏' : '收藏'}
                        aria-pressed={isFavorite}
                        aria-label={isFavorite ? `取消收藏${t.name}` : `收藏${t.name}`}
                      >
                        <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  )
                })}
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
