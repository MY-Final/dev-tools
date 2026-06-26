import { useState, useCallback, useRef, useEffect } from 'react'
import { Keyboard, Trash2 } from 'lucide-react'

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
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: globalThis.KeyboardEvent) => {
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

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const focusArea = useCallback(() => {
    containerRef.current?.focus()
    setFocused(true)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrentKey(null)
  }, [])

  const displayKey = currentKey ? SPECIAL_KEYS[currentKey.key] || currentKey.key : ''

  return (
    <div className="kt-page">
      <div className="kt-card">
        <div className="kt-header">
          <h2 className="kt-title">Keyboard Event Tester</h2>
          <p className="kt-subtitle">实时查看键盘按键的 JavaScript KeyboardEvent 信息</p>
        </div>

        <div
          ref={containerRef}
          className={`kt-press-area ${focused ? 'focused' : ''}`}
          tabIndex={0}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={focusArea}
        >
          {currentKey ? (
            <div className="kt-current-key">
              <span className="kt-key-display">{displayKey}</span>
              <span className="kt-key-name">{formatCombination(currentKey)}</span>
            </div>
          ) : (
            <div className="kt-placeholder">
              <Keyboard size={32} />
              <span>按下任意键...</span>
            </div>
          )}
        </div>

        {currentKey && (
          <>
            <div className="kt-section">
              <span className="kt-section-label">KeyboardEvent</span>
              <div className="kt-props">
                <div className="kt-prop">
                  <span className="kt-prop-name">key</span>
                  <code className="kt-prop-value">{currentKey.key}</code>
                </div>
                <div className="kt-prop">
                  <span className="kt-prop-name">code</span>
                  <code className="kt-prop-value">{currentKey.code}</code>
                </div>
                <div className="kt-prop">
                  <span className="kt-prop-name">keyCode</span>
                  <code className="kt-prop-value">{currentKey.keyCode}</code>
                </div>
                <div className="kt-prop">
                  <span className="kt-prop-name">which</span>
                  <code className="kt-prop-value">{currentKey.which}</code>
                </div>
                <div className="kt-prop">
                  <span className="kt-prop-name">location</span>
                  <code className="kt-prop-value">
                    {currentKey.location} ({LOCATION_LABELS[currentKey.location] || 'Unknown'})
                  </code>
                </div>
              </div>
            </div>

            <div className="kt-section">
              <span className="kt-section-label">Modifier Keys</span>
              <div className="kt-modifiers">
                <div className={`kt-mod ${currentKey.ctrlKey ? 'active' : ''}`}>
                  <span className="kt-mod-name">Ctrl</span>
                  <span className="kt-mod-status">{currentKey.ctrlKey ? '✓' : '✗'}</span>
                </div>
                <div className={`kt-mod ${currentKey.shiftKey ? 'active' : ''}`}>
                  <span className="kt-mod-name">Shift</span>
                  <span className="kt-mod-status">{currentKey.shiftKey ? '✓' : '✗'}</span>
                </div>
                <div className={`kt-mod ${currentKey.altKey ? 'active' : ''}`}>
                  <span className="kt-mod-name">Alt</span>
                  <span className="kt-mod-status">{currentKey.altKey ? '✓' : '✗'}</span>
                </div>
                <div className={`kt-mod ${currentKey.metaKey ? 'active' : ''}`}>
                  <span className="kt-mod-name">Meta</span>
                  <span className="kt-mod-status">{currentKey.metaKey ? '✓' : '✗'}</span>
                </div>
              </div>
            </div>

            <div className="kt-section">
              <span className="kt-section-label">JSON</span>
              <pre className="kt-json">
                {JSON.stringify(
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
                )}
              </pre>
            </div>
          </>
        )}

        {history.length > 0 && (
          <div className="kt-section">
            <div className="kt-history-header">
              <span className="kt-section-label">历史记录</span>
              <button className="kt-clear-btn" onClick={clearHistory}>
                <Trash2 size={13} />
                清空
              </button>
            </div>
            <div className="kt-history">
              {history.map((e, i) => (
                <div key={e.timestamp + i} className="kt-history-item">
                  <span className="kt-history-time">{formatTime(e.timestamp)}</span>
                  <span className="kt-history-key">{formatCombination(e)}</span>
                  <span className="kt-history-code">{e.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
