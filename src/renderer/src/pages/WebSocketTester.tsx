import { useState, useCallback, useRef, useEffect } from 'react'
import { Radio, Plug, PlugZap, Send, Trash2, Copy, Check, ServerCrash } from 'lucide-react'
import '../styles/websocket-tester.css'

interface LogEntry {
  type: 'sent' | 'received' | 'system' | 'error'
  timestamp: string
  message: string
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export default function WebSocketTester(): React.JSX.Element {
  const [url, setUrl] = useState('ws://localhost:8080')
  const [connected, setConnected] = useState(false)
  const [inputMsg, setInputMsg] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copiedIdx, setCopiedIdx] = useState(-1)
  const wsRef = useRef<WebSocket | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const handleConnect = useCallback(() => {
    if (!url.trim()) return
    setLogs([])
    try {
      const ws = new WebSocket(url.trim())
      ws.onopen = () => {
        setConnected(true)
        addLog({ type: 'system', timestamp: getTimestamp(), message: `已连接到 ${url.trim()}` })
      }
      ws.onclose = () => {
        setConnected(false)
        addLog({ type: 'system', timestamp: getTimestamp(), message: '连接已关闭' })
      }
      ws.onerror = () => {
        addLog({ type: 'error', timestamp: getTimestamp(), message: '连接错误' })
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
  }, [url, addLog])

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

      {/* Status */}
      <div className={`wst-status ${connected ? 'connected' : 'disconnected'}`}>
        <span className="wst-status-dot" />
        {connected ? '已连接' : '未连接'}
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
