import { useState, useEffect, useCallback, useRef, useMemo, useId, Fragment } from 'react'
import { supportsWeb, tools } from '@renderer/tools/registry'
import type { ToolItem as RegistryToolItem } from '@renderer/types/tool'
import { isWebRuntime } from '@renderer/lib/platform'
import { useSettings } from '@renderer/lib/contexts'
import { scoreToolQuery, type SearchableTool } from '@renderer/lib/tool-search'
import { buildPaletteCommands, type PaletteCommand } from '@renderer/lib/palette-commands'
import StatusMessage from '@renderer/components/StatusMessage'

interface ToolItem {
  id: string
  name: string
  desc: string
  icon: RegistryToolItem['icon']
  category: string
  platforms: RegistryToolItem['platforms']
  usage?: string
  tags?: string[]
}

const ALL_TOOLS = tools as unknown as ToolItem[]

/** 命令与工具同池：空查询时命令在前，有查询时按相关度混排。 */
type PaletteItem =
  | { kind: 'tool'; tool: ToolItem }
  | { kind: 'command'; command: PaletteCommand }

const IS_MAC = navigator.platform.includes('Mac')
const ENTER_MOD = IS_MAC ? '⌘' : 'Ctrl'

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

/** 工具转成搜索视图：带上 id，让「timestamp」「base64」这类 id 碎片可命中 */
function toolAsSearchable(tool: ToolItem): SearchableTool {
  return {
    name: tool.name,
    desc: tool.desc,
    category: tool.category,
    usage: tool.usage,
    tags: tool.tags,
    id: tool.id
  }
}

/** 命令转成搜索视图：别名走 keywords（权重高于分类），快捷键也可被搜到 */
function commandAsSearchable(command: PaletteCommand): SearchableTool {
  return {
    name: command.name,
    desc: command.desc,
    category: '命令',
    usage: command.shortcut,
    tags: command.keywords
  }
}

export default function CommandPalette({ onNavigate }: Props): React.JSX.Element {
  const { settings, updateAppearance, updateFavorites, clearRecentTools } = useSettings()
  const webRuntime = isWebRuntime()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [actionMessage, setActionMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  const id = useId()
  const listboxId = `${id}-listbox`
  const hintId = `${id}-hint`

  // 命令列表随主题、最近使用数量、快捷键配置重建
  const commands = useMemo(
    () =>
      buildPaletteCommands({
        theme: settings.appearance.theme,
        recentCount: settings.recentTools.length,
        shortcuts: settings.shortcuts,
        onToggleTheme: () => {
          void updateAppearance({
            theme: settings.appearance.theme === 'dark' ? 'light' : 'dark'
          })
        },
        onToggleSidebar: () => {
          void updateAppearance({ sidebarCollapsed: !settings.appearance.sidebarCollapsed })
        },
        onNavigate,
        onClearRecent: () => {
          void clearRecentTools()
        }
      }),
    [
      settings.appearance.theme,
      settings.appearance.sidebarCollapsed,
      settings.recentTools.length,
      settings.shortcuts,
      updateAppearance,
      clearRecentTools,
      onNavigate
    ]
  )

  const openPalette = useCallback(() => {
    setQuery('')
    setSelectedIndex(0)
    setActionMessage('')
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

  // 空查询时把最近使用排在最前（工具段），按 Enter 即可回到上次的工具
  const orderedTools = useMemo(() => {
    const byId = new Map(ALL_TOOLS.map((tool) => [tool.id, tool]))
    const recent = settings.recentTools
      .map((id) => byId.get(id))
      .filter((tool): tool is ToolItem => Boolean(tool))
    const recentIds = new Set(recent.map((tool) => tool.id))
    return [...recent, ...ALL_TOOLS.filter((tool) => !recentIds.has(tool.id))]
  }, [settings.recentTools])

  // 命令 + 工具统一条目：空查询=命令在前、工具按最近优先；
  // 有查询=同池按相关度排序，同分时命令优先，其次收藏与本地使用次数
  const items = useMemo<PaletteItem[]>(() => {
    const commandItems: PaletteItem[] = commands.map((command) => ({ kind: 'command', command }))
    const toolItems: PaletteItem[] = orderedTools.map((tool) => ({ kind: 'tool', tool }))

    if (!query.trim()) return [...commandItems, ...toolItems]

    return [...commandItems, ...toolItems]
      .map((item) => ({
        item,
        score: scoreToolQuery(
          item.kind === 'command' ? commandAsSearchable(item.command) : toolAsSearchable(item.tool),
          query
        )
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score
        if (a.item.kind !== b.item.kind) return a.item.kind === 'command' ? -1 : 1
        if (a.item.kind === 'tool' && b.item.kind === 'tool') {
          const aFavorite = settings.favorites.includes(a.item.tool.id) ? 1 : 0
          const bFavorite = settings.favorites.includes(b.item.tool.id) ? 1 : 0
          if (aFavorite !== bFavorite) return bFavorite - aFavorite
          const usageDelta =
            (settings.toolUsage[b.item.tool.id] ?? 0) - (settings.toolUsage[a.item.tool.id] ?? 0)
          if (usageDelta !== 0) return usageDelta
        }
        const aName = a.item.kind === 'tool' ? a.item.tool.name : a.item.command.name
        const bName = b.item.kind === 'tool' ? b.item.tool.name : b.item.command.name
        return aName.localeCompare(bName)
      })
      .map((entry) => entry.item)
  }, [commands, orderedTools, query, settings.favorites, settings.toolUsage])

  const maxIndex = Math.max(items.length - 1, 0)
  const activeIndex = Math.min(selectedIndex, maxIndex)
  const activeItem = items[activeIndex]
  const activeOptionId = activeItem
    ? `${listboxId}-option-${activeItem.kind === 'tool' ? activeItem.tool.id : activeItem.command.id}`
    : undefined

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, items, open])

  const activateItem = useCallback(
    (item: PaletteItem): void => {
      if (item.kind === 'command') {
        item.command.run()
      } else {
        onNavigate(item.tool.id)
      }
      setOpen(false)
    },
    [onNavigate]
  )

  // Ctrl/Cmd+Enter 的次要动作：切换收藏。面板保持打开，方便连续操作
  const toggleFavorite = useCallback(
    (toolId: string): void => {
      const tool = ALL_TOOLS.find((entry) => entry.id === toolId)
      const wasFavorite = settings.favorites.includes(toolId)
      void updateFavorites(toolId)
      setActionMessage(tool ? `${wasFavorite ? '已取消收藏' : '已收藏'} ${tool.name}` : '')
    },
    [settings.favorites, updateFavorites]
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
        case 'Enter': {
          event.preventDefault()
          const item = items[activeIndex]
          if (!item) break
          if (event.ctrlKey || event.metaKey) {
            // 次要动作只有工具有：切换收藏
            if (item.kind === 'tool') toggleFavorite(item.tool.id)
          } else {
            activateItem(item)
          }
          break
        }
        case 'Escape':
          event.preventDefault()
          setOpen(false)
          break
      }
    },
    [activeIndex, items, maxIndex, activateItem, toggleFavorite]
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

  const resultAnnouncement = items.length === 0 ? '没有匹配结果' : `${items.length} 个结果`
  const grouped = !query.trim()

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
              setActionMessage('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索工具或命令..."
            role="combobox"
            aria-label="搜索工具或命令"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-describedby={hintId}
          />
        </div>

        <StatusMessage srOnly>{actionMessage || resultAnnouncement}</StatusMessage>

        <div id={listboxId} className="cmd-palette-list" role="listbox" aria-label="搜索结果">
          {items.length === 0 ? (
            <div className="cmd-palette-empty">无匹配结果</div>
          ) : (
            items.map((item, index) => {
              const isTool = item.kind === 'tool'
              const name = isTool ? item.tool.name : item.command.name
              const desc = isTool ? item.tool.desc : item.command.desc
              const Icon = isTool ? item.tool.icon : item.command.icon
              const active = index === activeIndex
              // 空查询按「命令 / 工具」分组；搜索结果是混排的，不加标签
              const showLabel = grouped && (index === 0 || items[index - 1].kind !== item.kind)
              const favorite = isTool && settings.favorites.includes(item.tool.id)

              return (
                <Fragment key={isTool ? item.tool.id : `command:${item.command.id}`}>
                  {showLabel && (
                    <div className="cmd-palette-group-label" role="presentation">
                      {isTool ? '工具' : '命令'}
                    </div>
                  )}
                  <div
                    ref={(element) => {
                      optionRefs.current[index] = element
                    }}
                    id={`${listboxId}-option-${isTool ? item.tool.id : item.command.id}`}
                    className={`cmd-palette-item ${active ? 'selected' : ''}`}
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    onClick={() => activateItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="cmd-palette-item-main">
                      <span className="cmd-palette-item-name">
                        <Icon size={14} className="cmd-palette-item-icon" />
                        {name}
                      </span>
                      <span className="cmd-palette-item-desc">{desc}</span>
                    </div>
                    {active ? (
                      <span className="cmd-palette-item-actions">
                        <kbd>Enter</kbd>
                        {isTool ? '打开' : '执行'}
                        {isTool && (
                          <>
                            <kbd>{ENTER_MOD}+Enter</kbd>
                            {favorite ? '取消收藏' : '收藏'}
                          </>
                        )}
                      </span>
                    ) : (
                      <>
                        {isTool && webRuntime && !supportsWeb(item.tool) && (
                          <span className="platform-badge" title="该工具需要下载桌面版">
                            桌面端
                          </span>
                        )}
                        <span className="cmd-palette-item-category">
                          {isTool ? item.tool.category : (item.command.shortcut ?? '命令')}
                        </span>
                      </>
                    )}
                  </div>
                </Fragment>
              )
            })
          )}
        </div>

        <div id={hintId} className="cmd-palette-footer">
          <span className="cmd-palette-hint">
            <kbd>↑↓</kbd> 导航 <kbd>Enter</kbd> 打开/执行 <kbd>{ENTER_MOD}+Enter</kbd> 收藏{' '}
            <kbd>Esc</kbd> 关闭
          </span>
          <span className="cmd-palette-shortcut-hint">
            <kbd>{ENTER_MOD}+K</kbd> 打开
          </span>
        </div>
      </div>
    </div>
  )
}
