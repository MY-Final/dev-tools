import { useState, useCallback, useRef, useEffect } from 'react'
import { Trash2, Copy, Check } from 'lucide-react'

interface MouseEventInfo {
  type: string
  button: number
  buttons: number
  clientX: number
  clientY: number
  screenX: number
  screenY: number
  pageX: number
  pageY: number
  movementX?: number
  movementY?: number
  deltaX?: number
  deltaY?: number
  deltaZ?: number
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  timestamp: number
}

interface Position {
  x: number
  y: number
}

const BUTTON_LABELS: Record<number, string> = {
  0: '左键',
  1: '中键',
  2: '右键',
  3: '后退',
  4: '前进'
}

// MouseEvent.buttons bitmask: left=bit0, right=bit1, middle=bit2
const BUTTON_TO_BIT: Record<number, number> = {
  0: 1,  // Left  → bit 0
  1: 4,  // Middle → bit 2
  2: 2,  // Right → bit 1
  3: 8,  // Back  → bit 3
  4: 16  // Forward → bit 4
}

function formatButton(btn: number): string {
  return BUTTON_LABELS[btn] || `Button ${btn}`
}

export default function MouseTester(): React.JSX.Element {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [lastEvent, setLastEvent] = useState<MouseEventInfo | null>(null)
  const [history, setHistory] = useState<MouseEventInfo[]>([])
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState(false)
  const areaRef = useRef<HTMLDivElement>(null)

  const addEvent = useCallback((type: string, e: React.MouseEvent | WheelEvent, info?: Partial<MouseEventInfo>) => {
    const eventInfo: MouseEventInfo = {
      type,
      button: 'button' in e ? e.button : -1,
      buttons: 'buttons' in e ? e.buttons : 0,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      pageX: e instanceof WheelEvent ? e.clientX : (e as React.MouseEvent).pageX || e.clientX,
      pageY: e instanceof WheelEvent ? e.clientY : (e as React.MouseEvent).pageY || e.clientY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      timestamp: Date.now(),
      ...info
    }

    if (e instanceof WheelEvent) {
      eventInfo.deltaX = e.deltaX
      eventInfo.deltaY = e.deltaY
      eventInfo.deltaZ = e.deltaZ
    }

    setLastEvent(eventInfo)
    setHistory((prev) => [eventInfo, ...prev].slice(0, 50))
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY })
    // Don't overwrite lastEvent with mousemove — too noisy
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent browser back/forward navigation for side buttons
    if (e.button === 3 || e.button === 4) {
      e.preventDefault()
    }
    addEvent('mousedown', e)
  }, [addEvent])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Prevent browser back/forward navigation for side buttons
    if (e.button === 3 || e.button === 4) {
      e.preventDefault()
    }
    // Record in history but don't overwrite button indicators (buttons=0 on mouseup)
    const eventInfo: MouseEventInfo = {
      type: 'mouseup',
      button: e.button,
      buttons: e.buttons,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      pageX: e.pageX || e.clientX,
      pageY: e.pageY || e.clientY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      timestamp: Date.now()
    }
    setHistory((prev) => [eventInfo, ...prev].slice(0, 50))
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    addEvent('contextmenu', e)
  }, [addEvent])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const wheelInfo: MouseEventInfo = {
      type: 'wheel',
      button: -1,
      buttons: 0,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      pageX: e.clientX,
      pageY: e.clientY,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      timestamp: Date.now()
    }
    setLastEvent(wheelInfo)
    setHistory((prev) => [wheelInfo, ...prev].slice(0, 50))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    setLastEvent(null)
  }, [])

  const copyEvent = useCallback(() => {
    if (!lastEvent) return
    const data = {
      type: lastEvent.type,
      button: lastEvent.button,
      buttons: lastEvent.buttons,
      clientX: lastEvent.clientX,
      clientY: lastEvent.clientY,
      screenX: lastEvent.screenX,
      screenY: lastEvent.screenY,
      ctrlKey: lastEvent.ctrlKey,
      shiftKey: lastEvent.shiftKey,
      altKey: lastEvent.altKey,
      metaKey: lastEvent.metaKey
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [lastEvent])

  useEffect(() => {
    focusArea()
  }, [])

  const focusArea = useCallback(() => {
    areaRef.current?.focus()
    setFocused(true)
  }, [])

  return (
    <div className="mt-page">
      <div className="mt-card">
        <div className="mt-header">
          <h2 className="mt-title">Mouse Event Tester</h2>
          <p className="mt-subtitle">实时查看鼠标事件的 JavaScript MouseEvent 信息</p>
        </div>

        {/* Click Area */}
        <div
          ref={areaRef}
          className={`mt-area ${focused ? 'focused' : ''}`}
          tabIndex={0}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={focusArea}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
        >
          <div className="mt-crosshair">
            <div className="mt-crosshair-h" />
            <div className="mt-crosshair-v" />
          </div>
          <div className="mt-position">
            <span className="mt-coord">{position.x}</span>
            <span className="mt-sep">,</span>
            <span className="mt-coord">{position.y}</span>
          </div>
          <span className="mt-hint">移动鼠标 · 点击 · 滚轮</span>
        </div>

        {lastEvent && (
          <>
            {/* Button State */}
            <div className="mt-section">
              <span className="mt-section-label">按键状态</span>
              <div className="mt-buttons">
                {[0, 1, 2, 3, 4].map((btn) => {
                  const pressed =
                    lastEvent.type !== 'wheel' &&
                    (lastEvent.buttons & BUTTON_TO_BIT[btn]) !== 0
                  return (
                    <div key={btn} className={`mt-btn ${pressed ? 'active' : ''}`}>
                      <span className="mt-btn-name">{BUTTON_LABELS[btn] || `B${btn}`}</span>
                      <span className="mt-btn-status">{pressed ? '●' : '○'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Event Detail */}
            <div className="mt-section">
              <div className="mt-section-hdr">
                <span className="mt-section-label">MouseEvent</span>
                <button className="mt-copy-btn" onClick={copyEvent}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? '已复制' : '复制 JSON'}
                </button>
              </div>
              <div className="mt-props">
                <div className="mt-prop">
                  <span className="mt-prop-name">type</span>
                  <code className="mt-prop-value">{lastEvent.type}</code>
                </div>
                <div className="mt-prop">
                  <span className="mt-prop-name">button</span>
                  <code className="mt-prop-value">{lastEvent.button} ({formatButton(lastEvent.button)})</code>
                </div>
                <div className="mt-prop">
                  <span className="mt-prop-name">buttons</span>
                  <code className="mt-prop-value">{lastEvent.buttons}</code>
                </div>
                <div className="mt-prop">
                  <span className="mt-prop-name">clientX / clientY</span>
                  <code className="mt-prop-value">{lastEvent.clientX}, {lastEvent.clientY}</code>
                </div>
                <div className="mt-prop">
                  <span className="mt-prop-name">screenX / screenY</span>
                  <code className="mt-prop-value">{lastEvent.screenX}, {lastEvent.screenY}</code>
                </div>
                <div className="mt-prop">
                  <span className="mt-prop-name">pageX / pageY</span>
                  <code className="mt-prop-value">{lastEvent.pageX}, {lastEvent.pageY}</code>
                </div>
                {lastEvent.movementX !== undefined && (
                  <div className="mt-prop">
                    <span className="mt-prop-name">movementX / Y</span>
                    <code className="mt-prop-value">{lastEvent.movementX}, {lastEvent.movementY}</code>
                  </div>
                )}
                {lastEvent.deltaY !== undefined && (
                  <div className="mt-prop">
                    <span className="mt-prop-name">deltaX / Y / Z</span>
                    <code className="mt-prop-value">{lastEvent.deltaX}, {lastEvent.deltaY}, {lastEvent.deltaZ}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Modifiers */}
            <div className="mt-section">
              <span className="mt-section-label">Modifier Keys</span>
              <div className="mt-modifiers">
                {(['ctrlKey', 'shiftKey', 'altKey', 'metaKey'] as const).map((mod) => (
                  <div key={mod} className={`mt-mod ${lastEvent[mod] ? 'active' : ''}`}>
                    <span className="mt-mod-name">{mod.replace('Key', '')}</span>
                    <span className="mt-mod-status">{lastEvent[mod] ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-section">
            <div className="mt-section-hdr">
              <span className="mt-section-label">事件历史 ({history.length})</span>
              <button className="mt-clear-btn" onClick={clearHistory}>
                <Trash2 size={13} />
                清空
              </button>
            </div>
            <div className="mt-history">
              {history.map((e, i) => (
                <div key={e.timestamp + i} className="mt-history-item">
                  <span className={`mt-history-type mt-type-${e.type}`}>{e.type}</span>
                  {e.type !== 'mousemove' && e.type !== 'wheel' && (
                    <span className="mt-history-btn-name">{formatButton(e.button)}</span>
                  )}
                  <span className="mt-history-coords">{e.clientX}, {e.clientY}</span>
                  {e.deltaY !== undefined && (
                    <span className="mt-history-delta">Δ{e.deltaY}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
