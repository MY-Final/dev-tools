import { useState, useCallback, useRef } from 'react'
import { Keyboard, Trash2, Copy, Check } from 'lucide-react'

interface KeyEvent {
  key: string
  code: string
  keyCode: number
  which: number
  location: number
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  timestamp: number
}

const LOCATION_LABELS: Record<number, string> = {
  0: 'Standard',
  1: 'Left',
  2: 'Right',
  3: 'Numpad'
}

const SPECIAL_KEYS: Record<string, string> = {
  Enter: '↵',
  Tab: '⇥',
  Space: '␣',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: '⌦',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Shift: '⇧',
  Control: '⌃',
  Alt: '⌥',
  Meta: '⌘'
}

function formatCombination(e: KeyEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')

  const keyName = SPECIAL_KEYS[e.key] || e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    parts.push(keyName)
  }

  return parts.join(' + ')
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export default function KeyboardTester(): React.JSX.Element {
  const [currentKey, setCurrentKey] = useState<KeyEvent | null>(null)
  const [history, setHistory] = useState<KeyEvent[]>([])
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') return
    e.preventDefault()

    const keyEvent: KeyEvent = {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: e.which,
      location: e.location,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      timestamp: Date.now()
    }

    setCurrentKey(keyEvent)
    setHistory((prev) => [keyEvent, ...prev].slice(0, 20))
  }, [])

  const focusArea = useCallback(() => {
    containerRef.current?.focus()
    setFocused(true)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrentKey(null)
  }, [])

  const copyJson = useCallback(async () => {
    if (!currentKey) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentKey, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [currentKey])

  const displayKey = currentKey ? SPECIAL_KEYS[currentKey.key] || currentKey.key : ''

  return (
    <div className="kt-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Keyboard Event Tester</h2>
          <p className="tool-page-desc">
            聚焦按键区域后按下任意键，查看 KeyboardEvent 属性与组合键。
          </p>
        </div>
      </header>

      <div className="tool-split kt-layout">
        <section className="tool-panel kt-main">
          <div
            ref={containerRef}
            className={`kt-press-area ${focused ? 'focused' : ''}`}
            tabIndex={0}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={focusArea}
            onKeyDown={handleKeyDown}
            aria-label="按键测试区域，聚焦后按任意键"
          >
            {currentKey ? (
              <div className="kt-current-key">
                <span className="kt-key-display">{displayKey}</span>
                <span className="kt-key-name">{formatCombination(currentKey)}</span>
              </div>
            ) : (
              <div className="kt-placeholder">
                <Keyboard size={30} aria-hidden="true" />
                <span>按下任意键开始</span>
              </div>
            )}
            <span className="kt-stage-hint">
              {focused ? '已聚焦 · Tab 可切换焦点' : '点击此处获取键盘焦点'}
            </span>
          </div>

          <div className="kt-modifiers">
            {(
              [
                ['Ctrl', currentKey?.ctrlKey],
                ['Shift', currentKey?.shiftKey],
                ['Alt', currentKey?.altKey],
                ['Meta', currentKey?.metaKey]
              ] as const
            ).map(([name, active]) => (
              <div key={name} className={`kt-mod ${active ? 'active' : ''}`}>
                <span className="kt-mod-name">{name}</span>
                <span className="kt-mod-status">{active ? 'on' : '—'}</span>
              </div>
            ))}
          </div>

          <div className="kt-props">
            <div className="kt-prop">
              <span className="kt-prop-name">key</span>
              <code className="kt-prop-value">{currentKey ? currentKey.key : '—'}</code>
            </div>
            <div className="kt-prop">
              <span className="kt-prop-name">code</span>
              <code className="kt-prop-value">{currentKey ? currentKey.code : '—'}</code>
            </div>
            <div className="kt-prop">
              <span className="kt-prop-name">keyCode</span>
              <code className="kt-prop-value">{currentKey ? currentKey.keyCode : '—'}</code>
            </div>
            <div className="kt-prop">
              <span className="kt-prop-name">which</span>
              <code className="kt-prop-value">{currentKey ? currentKey.which : '—'}</code>
            </div>
            <div className="kt-prop">
              <span className="kt-prop-name">location</span>
              <code className="kt-prop-value">
                {currentKey
                  ? `${currentKey.location} (${LOCATION_LABELS[currentKey.location] || 'Unknown'})`
                  : '—'}
              </code>
            </div>
          </div>
        </section>

        <div className="kt-side">
          <section className="tool-panel kt-json-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">JSON</h3>
              <button type="button" className="tool-btn" onClick={copyJson} disabled={!currentKey}>
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <pre className="kt-json">
              {currentKey
                ? JSON.stringify(
                    {
                      key: currentKey.key,
                      code: currentKey.code,
                      keyCode: currentKey.keyCode,
                      which: currentKey.which,
                      location: currentKey.location,
                      ctrlKey: currentKey.ctrlKey,
                      shiftKey: currentKey.shiftKey,
                      altKey: currentKey.altKey,
                      metaKey: currentKey.metaKey
                    },
                    null,
                    2
                  )
                : '// 按键后显示事件 JSON'}
            </pre>
          </section>

          <section className="tool-panel kt-history-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">历史记录</h3>
              {history.length > 0 && (
                <button type="button" className="tool-btn" onClick={clearHistory}>
                  <Trash2 size={13} aria-hidden="true" />
                  清空
                </button>
              )}
            </div>
            {history.length > 0 ? (
              <div className="kt-history">
                {history.map((e, i) => (
                  <div key={e.timestamp + i} className="kt-history-item">
                    <span className="kt-history-time">{formatTime(e.timestamp)}</span>
                    <span className="kt-history-key">{formatCombination(e)}</span>
                    <span className="kt-history-code">{e.code}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="kt-empty">最近 20 次按键会显示在这里。</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
