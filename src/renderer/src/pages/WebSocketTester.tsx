import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Radio, Plug, PlugZap, Send, Trash2, Copy, Check,
  Plus, X, KeyRound, Code, Shield, List, SendHorizonal
} from 'lucide-react'
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

type ConnectionMode = 'browser' | 'proxy'

function getTimestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function buildUrl(base: string, params: KeyValuePair[], username: string, password: string): string {
  let url = base.trim()
  // Basic Auth
  if (username) {
    const protocolEnd = url.indexOf('://')
    if (protocolEnd !== -1) {
      const auth = encodeURIComponent(username) + ':' + encodeURIComponent(password)
      url = url.slice(0, protocolEnd + 3) + auth + '@' + url.slice(protocolEnd + 3)
    }
  }
  // Query params
  const filtered = params.filter((p) => p.key.trim())
  if (filtered.length === 0) return url
  const searchParams = new URLSearchParams()
  for (const p of filtered) {
    searchParams.append(p.key.trim(), p.value)
  }
  const separator = url.includes('?') ? '&' : '?'
  return url + separator + searchParams.toString()
}

export default function WebSocketTester(): React.JSX.Element {
  const [url, setUrl] = useState('ws://localhost:8080')
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('browser')
  const [subprotocol, setSubprotocol] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [params, setParams] = useState<KeyValuePair[]>([
    { key: 'token', value: '' }
  ])
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: 'Authorization', value: 'Bearer ' }
  ])
  const [autoAuthMsg, setAutoAuthMsg] = useState('')
  const [connected, setConnected] = useState(false)
  const [proxyId, setProxyId] = useState<number | null>(null)
  const [inputMsg, setInputMsg] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copiedIdx, setCopiedIdx] = useState(-1)
  const wsRef = useRef<WebSocket | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const autoAuthedRef = useRef(false)
  const proxyIdRef = useRef<number | null>(null)

  // Keep proxyIdRef in sync
  proxyIdRef.current = proxyId

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Proxy event listeners
  useEffect(() => {
    if (connectionMode !== 'proxy') return
    const cleanups: (() => void)[] = []
    cleanups.push(window.wsProxy.onOpen(({ id }) => {
      if (id !== proxyIdRef.current) return
      setConnected(true)
      addLog({ type: 'system', timestamp: getTimestamp(), message: '连接成功' })
      sendAutoAuth()
    }))
    cleanups.push(window.wsProxy.onMessage(({ id, data: msg }) => {
      if (id !== proxyIdRef.current) return
      addLog({ type: 'received', timestamp: getTimestamp(), message: msg })
    }))
    cleanups.push(window.wsProxy.onClose(({ id, code, reason }) => {
      if (id !== proxyIdRef.current) return
      setConnected(false)
      setProxyId(null)
      addLog({ type: 'system', timestamp: getTimestamp(), message: `关闭: 代码=${code} 原因="${reason || '无'}"` })
    }))
    cleanups.push(window.wsProxy.onError(({ id, error }) => {
      if (id !== proxyIdRef.current) return
      addLog({ type: 'error', timestamp: getTimestamp(), message: `代理连接错误: ${error}` })
    }))
    return () => cleanups.forEach((fn) => fn())
  }, [connectionMode, sendAutoAuth, addLog])

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const sendAutoAuth = useCallback(() => {
    if (!autoAuthMsg.trim() || autoAuthedRef.current) return
    autoAuthedRef.current = true
    const msg = autoAuthMsg.trim()
    if (connectionMode === 'proxy' && proxyId) {
      window.wsProxy.send({ id: proxyId, message: msg })
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg)
    }
    addLog({ type: 'sent', timestamp: getTimestamp(), message: msg })
    addLog({ type: 'system', timestamp: getTimestamp(), message: '已发送认证消息' })
  }, [autoAuthMsg, connectionMode, proxyId, addLog])

  const updateParam = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setParams((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: val }; return next })
  }, [])
  const addParam = useCallback(() => setParams((prev) => [...prev, { key: '', value: '' }]), [])
  const removeParam = useCallback((index: number) => setParams((prev) => prev.filter((_, i) => i !== index)), [])

  const updateHeader = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setHeaders((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: val }; return next })
  }, [])
  const addHeader = useCallback(() => setHeaders((prev) => [...prev, { key: '', value: '' }]), [])
  const removeHeader = useCallback((index: number) => setHeaders((prev) => prev.filter((_, i) => i !== index)), [])

  const handleConnect = useCallback(async () => {
    if (!url.trim()) return
    setLogs([])
    autoAuthedRef.current = false

    const finalUrl = buildUrl(url, params, username, password)
    const protocols = subprotocol.trim() ? subprotocol.trim().split(',').map((s) => s.trim()).filter(Boolean) : undefined

    // Log connection info
    addLog({ type: 'system', timestamp: getTimestamp(), message: `模式: ${connectionMode === 'proxy' ? '主进程代理 (支持自定义请求头)' : '浏览器'}` })
    addLog({ type: 'system', timestamp: getTimestamp(), message: `正在连接 ${finalUrl}` })
    if (protocols && protocols.length > 0) {
      addLog({ type: 'system', timestamp: getTimestamp(), message: `子协议: ${protocols.join(', ')}` })
    }
    if (params.some((p) => p.key.trim())) {
      const qs = params.filter((p) => p.key.trim()).map((p) => `${p.key}=${p.value || '(空)'}`).join(', ')
      addLog({ type: 'system', timestamp: getTimestamp(), message: `查询参数: ${qs}` })
    }
    if (connectionMode === 'proxy') {
      const activeHeaders = headers.filter((h) => h.key.trim())
      if (activeHeaders.length > 0) {
        addLog({ type: 'system', timestamp: getTimestamp(), message: `自定义请求头: ${activeHeaders.length} 个` })
      }
    }
    if (autoAuthMsg.trim()) {
      addLog({ type: 'system', timestamp: getTimestamp(), message: `连接后将自动发送认证消息` })
    }

    if (connectionMode === 'proxy') {
      // Use main process proxy
      const activeHeaders: Record<string, string> = {}
      for (const h of headers.filter((h) => h.key.trim())) {
        activeHeaders[h.key.trim()] = h.value
      }
      const result = await window.wsProxy.connect({
        url: finalUrl,
        headers: Object.keys(activeHeaders).length > 0 ? activeHeaders : undefined,
        protocols
      })
      if (result.error) {
        addLog({ type: 'error', timestamp: getTimestamp(), message: `连接失败: ${result.error}` })
        return
      }
      setProxyId(result.id)
    } else {
      // Use browser WebSocket API
      try {
        const ws = protocols && protocols.length > 0
          ? new WebSocket(finalUrl, protocols)
          : new WebSocket(finalUrl)

        ws.onopen = () => {
          setConnected(true)
          addLog({ type: 'system', timestamp: getTimestamp(), message: '连接成功' })
          sendAutoAuth()
        }
        ws.onclose = (event) => {
          setConnected(false)
          addLog({ type: 'system', timestamp: getTimestamp(), message: `关闭: 代码=${event.code} 原因="${event.reason || '无'}"` })
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
    }
  }, [url, params, subprotocol, username, password, headers, autoAuthMsg, connectionMode, addLog, sendAutoAuth])

  const handleDisconnect = useCallback(() => {
    if (connectionMode === 'proxy' && proxyId) {
      window.wsProxy.disconnect(proxyId)
      setProxyId(null)
    } else if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [connectionMode, proxyId])

  const handleSend = useCallback(() => {
    if (!inputMsg.trim()) return
    if (connectionMode === 'proxy' && proxyId) {
      window.wsProxy.send({ id: proxyId, message: inputMsg.trim() })
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(inputMsg.trim())
    } else {
      return
    }
    addLog({ type: 'sent', timestamp: getTimestamp(), message: inputMsg.trim() })
    setInputMsg('')
  }, [inputMsg, connectionMode, proxyId, addLog])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const copyLog = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx); setTimeout(() => setCopiedIdx(-1), 1500)
    })
  }, [])
  const clearLogs = useCallback(() => setLogs([]), [])

  const isConnected = connected

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
          disabled={isConnected}
        />
        {!isConnected ? (
          <button className="wst-btn wst-btn-connect" onClick={handleConnect}>
            <Plug size={14} /> 连接
          </button>
        ) : (
          <button className="wst-btn wst-btn-disconnect" onClick={handleDisconnect}>
            <PlugZap size={14} /> 断开
          </button>
        )}
      </div>

      {/* Mode switch */}
      <div className="wst-mode-bar">
        <button
          className={`wst-mode-btn ${connectionMode === 'browser' ? 'active' : ''}`}
          onClick={() => setConnectionMode('browser')}
          disabled={isConnected}
        >
          <Radio size={12} /> 浏览器连接
        </button>
        <button
          className={`wst-mode-btn ${connectionMode === 'proxy' ? 'active' : ''}`}
          onClick={() => setConnectionMode('proxy')}
          disabled={isConnected}
        >
          <Shield size={12} /> 主进程代理 <span className="wst-mode-badge">支持请求头</span>
        </button>
      </div>

      {/* Auth toggle */}
      <button
        className={`wst-auth-toggle ${showAuth ? 'expanded' : ''}`}
        onClick={() => setShowAuth((prev) => !prev)}
      >
        <KeyRound size={14} />
        <span>认证参数</span>
        <span className="wst-auth-hint">Basic Auth / 请求头 / Token / 子协议 / 自动消息</span>
      </button>

      {/* Auth panel */}
      {showAuth && (
        <div className="wst-auth-panel">
          {/* Basic Auth */}
          <div className="wst-auth-section-title">Basic Auth</div>
          <div className="wst-auth-row">
            <input
              className="wst-auth-input wst-auth-input-short"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              disabled={isConnected}
            />
            <input
              className="wst-auth-input wst-auth-input-short"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              disabled={isConnected}
            />
          </div>

          {/* Subprotocol */}
          <div className="wst-auth-section-title">子协议 (Subprotocol)</div>
          <div className="wst-auth-row">
            <Code size={14} className="wst-auth-row-icon" />
            <input
              className="wst-auth-input"
              type="text"
              value={subprotocol}
              onChange={(e) => setSubprotocol(e.target.value)}
              placeholder="多个用逗号分隔，如 chat, superchat"
              disabled={isConnected}
            />
          </div>

          {/* Query params */}
          <div className="wst-auth-section-title">
            <span>查询参数</span>
            <button className="wst-btn-sm" onClick={addParam}><Plus size={12} /> 添加</button>
          </div>
          {params.map((p, idx) => (
            <div key={idx} className="wst-param-row">
              <input className="wst-param-key" type="text" value={p.key} onChange={(e) => updateParam(idx, 'key', e.target.value)} placeholder="参数名" disabled={isConnected} />
              <span className="wst-param-eq">=</span>
              <input className="wst-param-val" type={p.key.toLowerCase().includes('token') || p.key.toLowerCase().includes('key') || p.key.toLowerCase().includes('secret') ? 'password' : 'text'} value={p.value} onChange={(e) => updateParam(idx, 'value', e.target.value)} placeholder="值" disabled={isConnected} />
              <button className="wst-btn-remove" onClick={() => removeParam(idx)}><X size={12} /></button>
            </div>
          ))}

          {/* Custom Headers (proxy mode only) */}
          {connectionMode === 'proxy' && (
            <>
              <div className="wst-auth-section-title">
                <span>自定义请求头 <span className="wst-auth-note-inline">(代理模式)</span></span>
                <button className="wst-btn-sm" onClick={addHeader}><Plus size={12} /> 添加</button>
              </div>
              {headers.map((h, idx) => (
                <div key={idx} className="wst-param-row">
                  <input className="wst-param-key" type="text" value={h.key} onChange={(e) => updateHeader(idx, 'key', e.target.value)} placeholder="Header 名" disabled={isConnected} />
                  <span className="wst-param-eq">:</span>
                  <input className="wst-param-val" type="text" value={h.value} onChange={(e) => updateHeader(idx, 'value', e.target.value)} placeholder="Header 值" disabled={isConnected} />
                  <button className="wst-btn-remove" onClick={() => removeHeader(idx)}><X size={12} /></button>
                </div>
              ))}
            </>
          )}

          {/* Auto-auth message */}
          <div className="wst-auth-section-title">自动认证消息 (连接后发送)</div>
          <div className="wst-auth-row">
            <SendHorizonal size={14} className="wst-auth-row-icon" />
            <input
              className="wst-auth-input"
              type="text"
              value={autoAuthMsg}
              onChange={(e) => setAutoAuthMsg(e.target.value)}
              placeholder='如 {"type":"auth","token":"xxx"}'
            />
          </div>

          <div className="wst-auth-footer">
            {connectionMode === 'browser'
              ? '浏览器模式下不支持设置自定义请求头。如需自定义 Header，请切换到「主进程代理」模式。'
              : '主进程代理支持任意自定义请求头，使用 Node.js WebSocket 建立连接。'}
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`wst-status ${isConnected ? 'connected' : 'disconnected'}`}>
        <span className="wst-status-dot" />
        <span>{isConnected ? '已连接' : '未连接'}</span>
        {isConnected && connectionMode === 'proxy' && (
          <span className="wst-status-protocol">代理模式</span>
        )}
        {isConnected && connectionMode === 'browser' && wsRef.current && (
          <span className="wst-status-protocol">子协议: {wsRef.current.protocol || '无'}</span>
        )}
      </div>

      {/* Send area */}
      <div className="wst-send-area">
        <div className="wst-send-row">
          <input className="wst-send-input" type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入要发送的消息..." disabled={!isConnected} />
          <button className="wst-btn wst-btn-send" onClick={handleSend} disabled={!isConnected}>
            <Send size={14} /> 发送
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="wst-log-header">
        <span className="wst-log-title">消息日志</span>
        <button className="wst-btn wst-btn-clear" onClick={clearLogs}><Trash2 size={12} /> 清空</button>
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
