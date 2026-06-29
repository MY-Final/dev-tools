import { useState, useCallback, useEffect } from 'react'
import { Clipboard, Copy, Check, Trash2, Download, Clock, FileText, Image } from 'lucide-react'
import '../styles/clipboard-manager.css'

interface HistoryItem {
  id: number
  text: string
  timestamp: number
  isImage: boolean
  imageDataUrl?: string
  imageType?: string
}

export default function ClipboardManager(): React.JSX.Element {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [readError, setReadError] = useState('')

  // Read clipboard
  const readClipboard = useCallback(async () => {
    setIsReading(true)
    setReadError('')
    try {
      const items = await navigator.clipboard.read()
      if (items.length === 0) {
        setReadError('剪贴板为空')
        return
      }

      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const text = await blob.text()
          if (text.trim()) {
            setHistory((prev) => {
              if (prev.length > 0 && prev[0].text === text) return prev
              return [{ id: Date.now(), text, timestamp: Date.now(), isImage: false }, ...prev].slice(0, 50)
            })
          }
        }
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          setHistory((prev) => {
            if (prev.length > 0 && prev[0].isImage && prev[0].imageDataUrl === dataUrl) return prev
            return [
              { id: Date.now(), text: '', timestamp: Date.now(), isImage: true, imageDataUrl: dataUrl, imageType },
              ...prev
            ].slice(0, 50)
          })
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setReadError('需要剪贴板读取权限。请在弹窗中点击「允许」或使用系统快捷键后重试。')
      } else {
        setReadError(err instanceof Error ? err.message : '读取剪贴板失败')
      }
    } finally {
      setIsReading(false)
    }
  }, [])

  // Ctrl+Shift+V shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        readClipboard()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readClipboard])

  const copyItem = useCallback(async (item: HistoryItem) => {
    try {
      if (item.isImage && item.imageDataUrl) {
        const resp = await fetch(item.imageDataUrl)
        const blob = await resp.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ [item.imageType || blob.type]: blob })
        ])
      } else {
        await navigator.clipboard.writeText(item.text)
      }
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const deleteItem = useCallback((id: number) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setHistory([])
  }, [])

  const exportHistory = useCallback(() => {
    const text = history
      .filter((item) => !item.isImage)
      .map(
        (item) =>
          `[${new Date(item.timestamp).toLocaleString()}] ${item.text}`
      )
      .join('\n---\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clipboard-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [history])

  return (
    <div className="clm-page">
      <div className="clm-card">
        <div className="clm-header">
          <h2 className="clm-title">Clipboard Manager</h2>
          <p className="clm-subtitle">剪贴板历史记录</p>
        </div>

        <div className="clm-toolbar">
          <button className="clm-read-btn" onClick={readClipboard} disabled={isReading}>
            <Clipboard size={14} />
            {isReading ? '读取中...' : '读取剪贴板'}
          </button>
          <span className="clm-hint">Ctrl+Shift+V</span>
          {history.length > 0 && (
            <>
              <button className="clm-export-btn" onClick={exportHistory} title="导出历史">
                <Download size={14} />
              </button>
              <button className="clm-clear-btn" onClick={clearAll} title="清空全部">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {readError && <div className="clm-error">{readError}</div>}

        {history.length === 0 && !readError && (
          <div className="clm-empty">
            <Clipboard size={48} className="clm-empty-icon" />
            <p className="clm-empty-text">暂无历史记录</p>
            <p className="clm-empty-hint">点击「读取剪贴板」或按 Ctrl+Shift+V 开始收集</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="clm-list">
            <div className="clm-list-header">
              <span className="clm-list-count">{history.length} 条记录</span>
            </div>
            {history.map((item) => (
              <div key={item.id} className="clm-item">
                <div className="clm-item-header">
                  <div className="clm-item-time">
                    <Clock size={12} />
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="clm-item-actions">
                    <button
                      className="clm-item-copy"
                      onClick={() => copyItem(item)}
                      title="复制"
                    >
                      {copiedId === item.id ? (
                        <Check size={12} />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                    <button
                      className="clm-item-delete"
                      onClick={() => deleteItem(item.id)}
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {item.isImage ? (
                  <div className="clm-item-image-wrap">
                    <Image size={14} className="clm-item-icon" />
                    <img
                      src={item.imageDataUrl}
                      alt="Clipboard"
                      className="clm-item-image"
                    />
                  </div>
                ) : (
                  <div className="clm-item-content">
                    <FileText size={14} className="clm-item-icon" />
                    <pre className="clm-item-text">{item.text}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
