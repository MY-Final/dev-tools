import { useState, useCallback, useRef, useEffect } from 'react'
import { Radio, Plug, PlugZap, Send, Trash2, Copy, Check, Plus, X, KeyRound, Code } from 'lucide-react'
import '../styles/websocket-tester.css'

interface LogEntry {
  type: 'sent' | 'received' | 'system' | 'error'
  timestamp: string
  message: string
}

interface KeyValuePair {
  key: string
  value: string
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function buildUrl(base: string, params: KeyValuePair[]): string {
  const filtered = params.filter((p) => p.key.trim())
  if (filtered.length === 0) return base.trim()
  const searchParams = new URLSearchParams()
  for (const p of filtered) {
    searchParams.append(p.key.trim(), p.value)
  }
  const separator = base.includes('?') ? '&' : '?'
  return base.trim() + separator + searchParams.toString()
}

export default function WebSocketTester(): React.JSX.Element {
  const [url, setUrl] = useState('ws://localhost:8080')
  const [subprotocol, setSubprotocol] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [params, setParams] = useState<KeyValuePair[]>([
    { key: 'token', value: '' }
  ])
  const [connected, setConnected] = useState(false)
  const [inputMsg, setInputMsg] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copiedIdx, setCopiedIdx] = useState(-1)
  const wsRef = useRef<WebSocket | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const updateParam = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setParams((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }, [])

  const addParam = useCallback(() => {
    setParams((prev) => [...prev, { key: '', value: '' }])
  }, [])

  const removeParam = useCallback((index: number) => {
    setParams((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleConnect = useCallback(() => {
    if (!url.trim()) return
    setLogs([])

    const finalUrl = buildUrl(url, params)
    const protocols = subprotocol.trim() ? subprotocol.trim().split(',').map((s) => s.trim()).filter(Boolean) : undefined

    try {
      const ws = protocols && protocols.length > 0
        ? new WebSocket(finalUrl, protocols)
        : new WebSocket(finalUrl)

      addLog({ type: 'system', timestamp: getTimestamp(), message: `正在连接 ${finalUrl}` })
      if (protocols && protocols.length > 0) {
        addLog({ type: 'system', timestamp: getTimestamp(), message: `子协议: ${protocols.join(', ')}` })
      }
      if (params.some((p) => p.key.trim())) {
        const qs = params.filter((p) => p.key.trim()).map((p) => `${p.key}=${p.value || '(空)'}`).join(', ')
        addLog({ type: 'system', timestamp: getTimestamp(), message: `查询参数: ${qs}` })
      }

      ws.onopen = () => {
        setConnected(true)
        addLog({ type: 'system', timestamp: getTimestamp(), message: '连接成功' })
      }
      ws.onclose = (event) => {
        setConnected(false)
        const reason = event.code > 0
          ? `关闭代码=${event.code} 原因="${event.reason || '无'}"`
          : '连接已关闭'
        addLog({ type: 'system', timestamp: getTimestamp(), message: reason })
      }
      ws.onerror = () => {
        addLog({ type: 'error', timestamp: getTimestamp(), message: '连接错误 — 请检查 URL/网络/认证参数' })
      }
      ws.onmessage = (event) => {
        const raw = event.data
        const text = typeof raw === 'string' ? raw : '[Binary: ' + raw.size + ' bytes]'
        addLog({ type: 'received', timestamp: getTimestamp(), message: text })
      }
      wsRef.current = ws
    } catch (err) {
      addLog({ type: 'error', timestamp: getTimestamp(), message: `连接失败: ${(err as Error).message}` })
    }
  }, [url, params, subprotocol, addLog])

  const handleDisconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  const handleSend = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !inputMsg.trim()) return
    wsRef.current.send(inputMsg.trim())
    addLog({ type: 'sent', timestamp: getTimestamp(), message: inputMsg.trim() })
    setInputMsg('')
  }, [inputMsg, addLog])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const copyLog = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(-1), 1500)
    })
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  return (
    <div className="wst-page">
      {/* URL Bar */}
      <div className="wst-url-bar">
        <input
          className="wst-url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://localhost:8080"
          disabled={connected}
        />
        {!connected ? (
          <button className="wst-btn wst-btn-connect" onClick={handleConnect}>
            <Plug size={14} /> 连接
          </button>
        ) : (
          <button className="wst-btn wst-btn-disconnect" onClick={handleDisconnect}>
            <PlugZap size={14} /> 断开
          </button>
        )}
      </div>

      {/* Auth toggle */}
      <button
        className={`wst-auth-toggle ${showAuth ? 'expanded' : ''}`}
        onClick={() => setShowAuth((prev) => !prev)}
      >
        <KeyRound size={14} />
        <span>认证参数</span>
        <span className="wst-auth-hint">Token / 子协议 / 查询参数</span>
      </button>

      {/* Auth panel */}
      {showAuth && (
        <div className="wst-auth-panel">
          {/* Subprotocol */}
          <div className="wst-auth-row">
            <Code size={14} className="wst-auth-row-icon" />
            <span className="wst-auth-row-label">子协议</span>
            <input
              className="wst-auth-input"
              type="text"
              value={subprotocol}
              onChange={(e) => setSubprotocol(e.target.value)}
              placeholder="多个用逗号分隔，如 chat, superchat"
              disabled={connected}
            />
          </div>

          {/* Query params */}
          <div className="wst-auth-header">
            <span className="wst-auth-row-label">查询参数</span>
            <button className="wst-btn wst-btn-param-add" onClick={addParam}>
              <Plus size={12} /> 添加
            </button>
          </div>
          {params.map((p, idx) => (
            <div key={idx} className="wst-param-row">
              <input
                className="wst-param-key"
                type="text"
                value={p.key}
                onChange={(e) => updateParam(idx, 'key', e.target.value)}
                placeholder="参数名 (如 token)"
                disabled={connected}
              />
              <span className="wst-param-eq">=</span>
              <input
                className="wst-param-val"
                type={p.key.toLowerCase().includes('token') || p.key.toLowerCase().includes('key') || p.key.toLowerCase().includes('secret') ? 'password' : 'text'}
                value={p.value}
                onChange={(e) => updateParam(idx, 'value', e.target.value)}
                placeholder="值"
                disabled={connected}
              />
              <button className="wst-btn-remove" onClick={() => removeParam(idx)} disabled={connected}>
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="wst-auth-note">
            认证参数会自动拼接到 URL 上。连接后可在日志中查看完整请求信息。
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`wst-status ${connected ? 'connected' : 'disconnected'}`}>
        <span className="wst-status-dot" />
        {connected ? '已连接' : '未连接'}
        {connected && wsRef.current && (
          <span className="wst-status-protocol">
            子协议: {wsRef.current.protocol || '无'}
          </span>
        )}
      </div>

      {/* Send area */}
      <div className="wst-send-area">
        <div className="wst-send-row">
          <input
            className="wst-send-input"
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入要发送的消息..."
            disabled={!connected}
          />
          <button className="wst-btn wst-btn-send" onClick={handleSend} disabled={!connected}>
            <Send size={14} /> 发送
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="wst-log-header">
        <span className="wst-log-title">消息日志</span>
        <button className="wst-btn wst-btn-clear" onClick={clearLogs}>
          <Trash2 size={12} /> 清空
        </button>
      </div>
      <div className="wst-log-list">
        {logs.length === 0 && (
          <div className="wst-log-empty">
            <Radio size={32} className="wst-empty-icon" />
            <span>暂无消息</span>
          </div>
        )}
        {logs.map((entry, idx) => (
          <div key={idx} className={`wst-log-item wst-log-${entry.type}`}>
            <span className="wst-log-time">{entry.timestamp}</span>
            <span className="wst-log-badge">{entry.type === 'sent' ? '发送' : entry.type === 'received' ? '接收' : entry.type === 'error' ? '错误' : '系统'}</span>
            <span className="wst-log-msg">{entry.message}</span>
            <button className="wst-log-copy" onClick={() => copyLog(entry.message, idx)} title="复制">
              {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
