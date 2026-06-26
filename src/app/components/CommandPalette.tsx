import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { tools } from '@renderer/tools/registry'
import type { ToolItem as RegistryToolItem } from '@renderer/types/tool'

interface ToolItem {
  id: string
  name: string
  desc: string
  icon: RegistryToolItem['icon']
  category: string
}

const ALL_TOOLS = tools as unknown as ToolItem[]

interface Props {
  currentPage: string
  onNavigate: (page: string) => void
}

export default function CommandPalette({ onNavigate }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for Ctrl+K (handled locally below), no Electron IPC
  useEffect(() => {
    // No-op in web version — Ctrl+K is handled by the keydown listener
  }, [])

  // Also handle local Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_TOOLS
    const q = query.toLowerCase()
    return ALL_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    )
  }, [query])

  const handleSelect = useCallback(
    (tool: ToolItem) => {
      onNavigate(tool.id)
      setOpen(false)
    },
    [onNavigate]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex])
          }
          break
        case 'Escape':
          setOpen(false)
          break
      }
    },
    [filtered, selectedIndex, handleSelect]
  )

  if (!open) return <></>

  return (
    <div className="cmd-palette-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-palette-input-wrap">
          <span className="cmd-palette-prompt">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索工具..."
            autoFocus
          />
        </div>

        <div className="cmd-palette-list">
          {filtered.length === 0 ? (
            <div className="cmd-palette-empty">无匹配结果</div>
          ) : (
            filtered.map((tool, index) => (
              <div
                key={tool.id}
                className={`cmd-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(tool)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="cmd-palette-item-main">
                  <span className="cmd-palette-item-name">{tool.name}</span>
                  <span className="cmd-palette-item-desc">{tool.desc}</span>
                </div>
                <span className="cmd-palette-item-category">{tool.category}</span>
              </div>
            ))
          )}
        </div>

        <div className="cmd-palette-footer">
          <span className="cmd-palette-hint">
            <kbd>↑↓</kbd> 导航 <kbd>Enter</kbd> 选择 <kbd>Esc</kbd> 关闭
          </span>
          <span className="cmd-palette-shortcut-hint">
            <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K</kbd> 打开
          </span>
        </div>
      </div>
    </div>
  )
}
