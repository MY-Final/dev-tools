import { useState, useMemo } from 'react'
import { Search, Zap, Layers, ArrowRight, Star } from 'lucide-react'
import { tools } from '@renderer/tools/registry'
import type { ToolItem } from '@renderer/types/tool'
import { useSettings } from '@renderer/lib/contexts'
import '../styles/home.css'

// ── Category accent colors ─────────────────────────────────────

const CATEGORY_ACCENTS: Record<string, string> = {
  '换算工具': 'accent-blue',
  '网络工具': 'accent-green',
  '系统工具': 'accent-purple',
  '编码/加密': 'accent-orange',
  '开发工具': 'accent-cyan',
  '文本工具': 'accent-pink',
  '备忘录': 'accent-yellow',
  '资源搜索': 'accent-teal'
}

// ── Tag accent colors ──────────────────────────────────────────

const TAG_ACCENTS: Record<string, string> = {
  '前端': 'tag-blue',
  '后端': 'tag-green',
  '运维': 'tag-orange',
  '通用': 'tag-purple'
}

// ── All available tags (derived from tools) ────────────────────

const ALL_TAGS = ['前端', '后端', '运维', '通用']

interface HomeProps {
  onSelectTool: (id: string) => void
}

export default function Home({ onSelectTool }: HomeProps): React.JSX.Element {
  const { settings, updateFavorites } = useSettings()
  const favorites = settings.favorites
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const filteredTools = useMemo(() => {
    let result = tools

    // Tag filter
    if (activeTag) {
      result = result.filter((t) => t.tags?.includes(activeTag))
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    }

    return result
  }, [search, activeTag])

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
      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero-glow" />
        <div className="home-hero-content">
          <div className="home-hero-badge">
            <Zap size={12} />
            <span>{totalTools}+ 开发工具</span>
          </div>
          <h1 className="home-hero-title">
            开发者的
            <span className="home-hero-highlight"> 瑞士军刀</span>
          </h1>
          <p className="home-hero-subtitle">
            一站式开发工具箱 — 格式化、编码、转换、生成、调试，应有尽有
          </p>

          {/* Stats */}
          <div className="home-stats">
            <div className="home-stat">
              <span className="home-stat-value">{totalTools}</span>
              <span className="home-stat-label">工具总数</span>
            </div>
            <div className="home-stat-divider" />
            <div className="home-stat">
              <span className="home-stat-value">{totalCategories}</span>
              <span className="home-stat-label">分类</span>
            </div>
            <div className="home-stat-divider" />
            <div className="home-stat">
              <span className="home-stat-value">{totalTools - tools.filter(t => t.category === '备忘录').length}</span>
              <span className="home-stat-label">功能工具</span>
            </div>
          </div>

          {/* Search */}
          <div className="home-search-wrap">
            <Search size={18} className="home-search-icon" />
            <input
              className="home-search-input"
              type="text"
              placeholder="搜索工具..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <span className="home-search-result">
                {filteredTools.length} 个结果
              </span>
            )}
          </div>

          {/* Tag filter */}
          <div className="home-tags">
            {ALL_TAGS.map((tag) => {
              const count = tools.filter((t) => t.tags?.includes(tag)).length
              const isActive = activeTag === tag
              return (
                <button
                  key={tag}
                  className={`home-tag ${TAG_ACCENTS[tag] || ''} ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTag(isActive ? null : tag)}
                >
                  <span className="home-tag-label">{tag}</span>
                  <span className="home-tag-count">{count}</span>
                </button>
              )
            })}
            {activeTag && (
              <button className="home-tag-clear" onClick={() => setActiveTag(null)}>
                清除筛选
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tool grid */}
      <section className="home-tools-section">
        {[...categories.entries()].map(
          ([category, { tools: categoryTools }]) => {
            const accentClass = CATEGORY_ACCENTS[category] || ''
            return (
              <div key={category} className="home-category">
                <div className="home-category-header">
                  <h3 className="home-category-title">{category}</h3>
                  <span className="home-category-count">{categoryTools.length}</span>
                </div>
                <div className="home-tool-grid">
                  {categoryTools.map((t) => {
                    const Icon = t.icon
                    return (
                      <button
                        key={t.id}
                        className={`home-tool-card ${accentClass}`}
                        onClick={() => onSelectTool(t.id)}
                      >
                        <div className="home-tool-icon">
                          <Icon size={18} />
                        </div>
                        <div className="home-tool-body">
                          <span className="home-tool-name">{t.name}</span>
                          <span className="home-tool-desc">{t.desc}</span>
                        </div>
                        <ArrowRight size={14} className="home-tool-arrow" />
                        <button
                          className={`home-tool-star ${favorites.includes(t.id) ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateFavorites(t.id)
                          }}
                          title={favorites.includes(t.id) ? '取消收藏' : '收藏'}
                        >
                          <Star size={14} fill={favorites.includes(t.id) ? 'currentColor' : 'none'} />
                        </button>
                        {t.isNew && <span className="home-tool-badge">NEW</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          }
        )}

        {filteredTools.length === 0 && (
          <div className="home-empty">
            <Layers size={32} className="home-empty-icon" />
            <span>没有找到匹配的工具</span>
          </div>
        )}
      </section>
    </div>
  )
}
