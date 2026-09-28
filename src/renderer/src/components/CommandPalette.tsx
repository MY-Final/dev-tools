import { useState, useEffect, useCallback, useRef, useMemo, useId } from 'react'
import { tools } from '@renderer/tools/registry'
import type { ToolItem as RegistryToolItem } from '@renderer/types/tool'
import StatusMessage from '@renderer/components/StatusMessage'

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

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function CommandPalette({ onNavigate }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  const id = useId()
  const listboxId = `${id}-listbox`
  const hintId = `${id}-hint`

  const openPalette = useCallback(() => {
    setQuery('')
    setSelectedIndex(0)
    setOpen(true)
  }, [])

  const togglePalette = useCallback(() => {
    if (open) {
      setOpen(false)
      return
    }

    openPalette()
  }, [open, openPalette])

  // Listen for global shortcut from main process
  useEffect(() => {
    const handler = (): void => togglePalette()
    const cleanup = window.electron.ipcRenderer.on('command-palette:toggle', handler)
    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [togglePalette])

  useEffect(() => {
    const handler = (): void => openPalette()
    window.addEventListener('command-palette:open', handler)
    return () => window.removeEventListener('command-palette:open', handler)
  }, [openPalette])

  // Also handle local Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        togglePalette()
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, togglePalette])

  // Save focus when opened and restore it when closed
  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false
        const previousFocus = previousFocusRef.current
        previousFocusRef.current = null
        window.requestAnimationFrame(() => previousFocus?.focus())
      }

      return undefined
    }

    if (!wasOpenRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      wasOpenRef.current = true
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_TOOLS
    const normalizedQuery = query.toLowerCase()
    return ALL_TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(normalizedQuery) ||
        tool.desc.toLowerCase().includes(normalizedQuery) ||
        tool.category.toLowerCase().includes(normalizedQuery)
    )
  }, [query])

  const maxIndex = Math.max(filtered.length - 1, 0)
  const activeIndex = Math.min(selectedIndex, maxIndex)
  const activeOptionId =
    filtered.length > 0 ? `${listboxId}-option-${filtered[activeIndex].id}` : undefined

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filtered, open])

  const handleSelect = useCallback(
    (tool: ToolItem) => {
      onNavigate(tool.id)
      setOpen(false)
    },
    [onNavigate]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex(Math.min(activeIndex + 1, maxIndex))
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(Math.max(activeIndex - 1, 0))
          break
        case 'Home':
          event.preventDefault()
          setSelectedIndex(0)
          break
        case 'End':
          event.preventDefault()
          setSelectedIndex(maxIndex)
          break
        case 'Enter':
          event.preventDefault()
          if (filtered[activeIndex]) handleSelect(filtered[activeIndex])
          break
        case 'Escape':
          event.preventDefault()
          setOpen(false)
          break
      }
    },
    [activeIndex, filtered, handleSelect, maxIndex]
  )

  const handleFocusTrap = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !paletteRef.current) return

    const focusable = Array.from(
      paletteRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((element) => element.offsetParent !== null)

    if (focusable.length === 0) {
      event.preventDefault()
      inputRef.current?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  if (!open) return <></>

  const resultAnnouncement =
    filtered.length === 0 ? '没有匹配结果' : `${filtered.length} 个工具结果`

  return (
    <div className="cmd-palette-overlay" onClick={() => setOpen(false)}>
      <div
        ref={paletteRef}
        className="cmd-palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleFocusTrap}
      >
        <div className="cmd-palette-input-wrap">
          <span className="cmd-palette-prompt" aria-hidden="true">
            {'>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索工具..."
            role="combobox"
            aria-label="搜索工具"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-describedby={hintId}
          />
        </div>

        <StatusMessage srOnly>{resultAnnouncement}</StatusMessage>

        <div id={listboxId} className="cmd-palette-list" role="listbox" aria-label="工具搜索结果">
          {filtered.length === 0 ? (
            <div className="cmd-palette-empty">无匹配结果</div>
          ) : (
            filtered.map((tool, index) => (
              <div
                key={tool.id}
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                id={`${listboxId}-option-${tool.id}`}
                className={`cmd-palette-item ${index === activeIndex ? 'selected' : ''}`}
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
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

        <div id={hintId} className="cmd-palette-footer">
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
