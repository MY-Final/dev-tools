import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import StatusMessage from '@renderer/components/StatusMessage'
import { useSettings, type AppSettings } from '@renderer/lib/contexts'
import shortcutHelpData from '@renderer/lib/shortcut-help-data.json'

interface FixedShortcutItem {
  keys: string[]
  label: string
}

interface CustomizableShortcutItem {
  id: keyof AppSettings['shortcuts']
  label: string
}

interface ShortcutHelpData {
  customizable: {
    title: string
    hint?: string
    items: CustomizableShortcutItem[]
  }
  fixed: {
    title: string
    hint?: string
    items: FixedShortcutItem[]
  }
}

interface ShortcutHelpGroup {
  title: string
  hint?: string
  items: FixedShortcutItem[]
}

const HELP_DATA = shortcutHelpData as ShortcutHelpData
const IS_MAC = navigator.platform.includes('Mac')

/** 键位显示与命令面板 footer 一致：平台修饰键 + 紧凑写法 */
function formatKeys(shortcut: string): string {
  return shortcut.replace(/Ctrl/g, IS_MAC ? '⌘' : 'Ctrl').replace(/Meta/g, '⌘')
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/** 快捷键帮助浮层：`?` 打开，`Esc` 关闭，行为与命令面板一致。 */
export default function ShortcutHelp(): React.JSX.Element {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  // `?` 打开帮助。输入框里不拦截（打问号时不该弹层），
  // 已有其他弹层（命令面板等）时也让位给当前弹层
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '?' || event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }

      if (open || document.querySelector('[role="dialog"]')) return

      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Esc 关闭；Ctrl/Cmd+K 让位给命令面板，避免两层浮层叠在一起
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // 打开时保存焦点、关闭时还原——与命令面板同一套行为
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

    const timer = window.setTimeout(() => panelRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const handleFocusTrap = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return

    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((element) => element.offsetParent !== null)

    if (focusable.length === 0) {
      event.preventDefault()
      panelRef.current.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (!focusable.includes(active as HTMLElement)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
      return
    }

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  if (!open) return <></>

  const groups: ShortcutHelpGroup[] = [
    {
      title: HELP_DATA.customizable.title,
      hint: HELP_DATA.customizable.hint,
      items: HELP_DATA.customizable.items.map((item) => ({
        label: item.label,
        keys: [formatKeys(settings.shortcuts[item.id])]
      }))
    },
    {
      title: HELP_DATA.fixed.title,
      hint: HELP_DATA.fixed.hint,
      items: HELP_DATA.fixed.items.map((item) => ({
        label: item.label,
        keys: item.keys.map((key) => formatKeys(key))
      }))
    }
  ]

  return (
    <div className="shortcut-help-overlay" onClick={() => setOpen(false)}>
      <div
        ref={panelRef}
        className="shortcut-help"
        role="dialog"
        aria-modal="true"
        aria-label="键盘快捷键"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleFocusTrap}
      >
        <div className="shortcut-help-head">
          <h2 className="shortcut-help-title">键盘快捷键</h2>
          <button
            type="button"
            className="shortcut-help-close"
            onClick={() => setOpen(false)}
            aria-label="关闭快捷键帮助"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <StatusMessage srOnly>快捷键帮助已打开，按 Esc 关闭</StatusMessage>

        <div className="shortcut-help-body">
          {groups.map((group) => (
            <section className="shortcut-help-group" key={group.title} aria-label={group.title}>
              <div className="shortcut-help-group-head">
                <h3 className="shortcut-help-group-title">{group.title}</h3>
                {group.hint && <span className="shortcut-help-group-hint">{group.hint}</span>}
              </div>
              <dl className="shortcut-help-list">
                {group.items.map((row) => (
                  <div className="shortcut-help-row" key={row.label}>
                    <dt className="shortcut-help-label">{row.label}</dt>
                    <dd className="shortcut-help-keys">
                      {row.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="shortcut-help-footer">
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
          <span>
            <kbd>?</kbd> 打开帮助
          </span>
        </div>
      </div>
    </div>
  )
}
