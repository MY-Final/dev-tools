import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Search } from 'lucide-react'

export interface CheatSheetCommand {
  command: string
  description: string
  example: string
  params?: { flag: string; desc: string }[]
}

export interface CheatSheetCategory {
  id: string
  label: string
  icon: string
  commands: CheatSheetCommand[]
}

interface Props {
  title: string
  subtitle: string
  categories: CheatSheetCategory[]
  searchPlaceholder?: string
}

export default function CheatSheet({
  title,
  subtitle,
  categories,
  searchPlaceholder
}: Props): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const query = search.toLowerCase()
    return categories
      .map((category) => ({
        ...category,
        commands: category.commands.filter(
          (cmd) =>
            cmd.command.toLowerCase().includes(query) ||
            cmd.description.toLowerCase().includes(query) ||
            cmd.example.toLowerCase().includes(query)
        )
      }))
      .filter((category) => category.commands.length > 0)
  }, [search, categories])

  const copyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(command)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const toggleExpand = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])

  return (
    <div className="cs-page">
      <div className="cs-card">
        <div className="cs-header">
          <h2 className="cs-title">{title}</h2>
          <p className="cs-subtitle">{subtitle}</p>
        </div>

        <div className="cs-search">
          <Search size={16} />
          <input
            type="text"
            className="cs-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? '搜索命令...'}
          />
        </div>

        <div className="cs-content">
          {filteredCategories.map((category) => (
            <div key={category.id} className="cs-category">
              <div className="cs-category-header">
                <span className="cs-category-icon">{category.icon}</span>
                <span className="cs-category-label">{category.label}</span>
                <span className="cs-category-count">{category.commands.length}</span>
              </div>
              <div className="cs-commands">
                {category.commands.map((cmd) => {
                  const cmdKey = `${category.id}:${cmd.command}`
                  return (
                    <div key={cmdKey} className="cs-command-wrapper">
                      <div
                        className={`cs-command ${expandedKey === cmdKey ? 'expanded' : ''}`}
                        onClick={() => toggleExpand(cmdKey)}
                      >
                        <code className="cs-command-text">{cmd.command}</code>
                        <span className="cs-command-desc">{cmd.description}</span>
                        <button
                          className="cs-copy-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyCommand(cmd.example)
                          }}
                        >
                          {copied === cmd.example ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                      {expandedKey === cmdKey && (
                        <div className="cs-command-details">
                          {cmd.params && cmd.params.length > 0 && (
                            <div className="cs-detail-section">
                              <span className="cs-detail-label">参数</span>
                              <div className="cs-params">
                                {cmd.params.map((param) => (
                                  <div key={param.flag} className="cs-param">
                                    <code className="cs-param-flag">{param.flag}</code>
                                    <span className="cs-param-desc">{param.desc}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="cs-detail-section">
                            <span className="cs-detail-label">示例</span>
                            <div className="cs-detail-code">
                              <code>{cmd.example}</code>
                              <button
                                className="cs-copy-btn"
                                onClick={() => copyCommand(cmd.example)}
                              >
                                {copied === cmd.example ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {filteredCategories.length === 0 && <div className="cs-empty">未找到匹配的命令</div>}
      </div>
    </div>
  )
}
