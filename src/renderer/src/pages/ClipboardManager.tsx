import { useState, useCallback, useEffect, useRef } from 'react'
import { Clipboard, Copy, Check, Trash2, Download, Clock, X } from 'lucide-react'
import Dialog from '../components/ui/dialog'
import '../styles/clipboard-manager.css'

interface HistoryItem {
  id: number
  text: string
  timestamp: number
  isImage: boolean
  imageDataUrl?: string
  imageType?: string
}

interface CopyFeedback {
  itemId: number
  kind: 'success' | 'error'
  message: string
}

export default function ClipboardManager(): React.JSX.Element {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const nextIdRef = useRef(0)
  const previewTriggerRef = useRef<HTMLElement | null>(null)
  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)

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
              const id = ++nextIdRef.current
              return [{ id, text, timestamp: Date.now(), isImage: false }, ...prev].slice(0, 50)
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
            const id = ++nextIdRef.current
            return [
              {
                id,
                text: '',
                timestamp: Date.now(),
                isImage: true,
                imageDataUrl: dataUrl,
                imageType
              },
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

  // 对话框打开时优先消费 Escape，避免同时触发 App 的返回首页全局快捷键。
  useEffect(() => {
    if (!confirmClearOpen && previewSrc === null) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (confirmClearOpen) {
        setConfirmClearOpen(false)
      } else {
        setPreviewSrc(null)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [confirmClearOpen, previewSrc])

  const copyItem = useCallback(async (item: HistoryItem) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }

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
      setCopyFeedback({ itemId: item.id, kind: 'success', message: '已复制到剪贴板' })
    } catch (err) {
      setCopyFeedback({
        itemId: item.id,
        kind: 'error',
        message:
          err instanceof Error ? `复制失败：${err.message}` : '复制失败，请检查剪贴板权限后重试。'
      })
    } finally {
      feedbackTimerRef.current = window.setTimeout(() => setCopyFeedback(null), 2400)
    }
  }, [])

  const deleteItem = useCallback((id: number) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setHistory([])
    setConfirmClearOpen(false)
    setCopyFeedback(null)
  }, [])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  const exportHistory = useCallback(() => {
    const text = history
      .filter((item) => !item.isImage)
      .map((item) => `[${new Date(item.timestamp).toLocaleString()}] ${item.text}`)
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
    <div className="clm-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Clipboard Manager</h2>
          <p className="tool-page-desc">收集剪贴板中的文本与图片，最多保留最近 50 条。</p>
        </div>
        <div className="tool-page-actions">
          <button
            type="button"
            className="tool-btn tool-btn--primary"
            onClick={readClipboard}
            disabled={isReading}
            aria-busy={isReading}
          >
            <Clipboard size={14} aria-hidden="true" />
            {isReading ? '读取中…' : '读取剪贴板'}
          </button>
          <kbd className="clm-kbd">Ctrl+Shift+V</kbd>
          {history.length > 0 && (
            <>
              <button
                type="button"
                className="tool-icon-btn"
                onClick={exportHistory}
                title="导出文本历史"
                aria-label="导出文本历史"
              >
                <Download size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                ref={clearButtonRef}
                className="tool-icon-btn clm-clear-btn"
                onClick={() => setConfirmClearOpen(true)}
                title="清空全部"
                aria-label="清空全部剪贴板历史"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      {readError && (
        <div className="clm-error" role="alert" aria-live="assertive">
          {readError}
        </div>
      )}

      {copyFeedback && (
        <div
          className={`clm-copy-feedback clm-copy-feedback--${copyFeedback.kind}`}
          role={copyFeedback.kind === 'error' ? 'alert' : 'status'}
          aria-live={copyFeedback.kind === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {copyFeedback.message}
        </div>
      )}

      <section className="tool-panel clm-panel">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">历史记录</h3>
          {history.length > 0 && (
            <span className="clm-list-count" role="status" aria-live="polite">
              {history.length} 条
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="clm-empty">
            <Clipboard size={28} className="clm-empty-icon" aria-hidden="true" />
            <p className="clm-empty-text">暂无历史记录</p>
            <p className="clm-empty-hint">点击「读取剪贴板」或按 Ctrl+Shift+V 开始收集</p>
          </div>
        ) : (
          <div className="clm-list">
            {history.map((item) => (
              <div key={item.id} className="clm-item">
                <div className="clm-item-main">
                  <div className="clm-item-meta">
                    <Clock size={11} aria-hidden="true" />
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    <span className="clm-item-kind">{item.isImage ? '图片' : '文本'}</span>
                  </div>
                  {item.isImage ? (
                    <button
                      type="button"
                      className="clm-image-button"
                      onClick={(event) => {
                        previewTriggerRef.current = event.currentTarget
                        setPreviewSrc(item.imageDataUrl ?? null)
                      }}
                      aria-label="预览这条剪贴板图片"
                    >
                      <img src={item.imageDataUrl} alt="剪贴板图片" className="clm-item-image" />
                    </button>
                  ) : (
                    <pre className="clm-item-text" title={item.text}>
                      {item.text}
                    </pre>
                  )}
                </div>
                <div className="clm-item-actions">
                  <button
                    type="button"
                    className="tool-icon-btn clm-item-copy"
                    onClick={() => copyItem(item)}
                    title={copyFeedback?.itemId === item.id ? copyFeedback.message : '复制'}
                    aria-label={
                      copyFeedback?.itemId === item.id ? copyFeedback.message : '复制这条记录'
                    }
                  >
                    {copyFeedback?.itemId === item.id && copyFeedback.kind === 'success' ? (
                      <Check size={13} aria-hidden="true" />
                    ) : copyFeedback?.itemId === item.id && copyFeedback.kind === 'error' ? (
                      <X size={13} aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="tool-icon-btn clm-item-delete"
                    onClick={() => deleteItem(item.id)}
                    title="删除"
                    aria-label="删除这条记录"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="清空剪贴板历史？"
        returnFocusRef={clearButtonRef}
        footer={
          <>
            <button
              type="button"
              className="clm-dialog-cancel"
              onClick={() => setConfirmClearOpen(false)}
            >
              取消
            </button>
            <button type="button" className="clm-dialog-confirm" onClick={clearAll}>
              确认清空
            </button>
          </>
        }
      >
        <p className="clm-dialog-text">
          这会移除当前列表中的 {history.length} 条记录，且无法撤销。
        </p>
      </Dialog>

      <Dialog
        open={previewSrc !== null}
        onClose={() => setPreviewSrc(null)}
        title="图片预览"
        className="clm-preview-dialog"
        returnFocusRef={previewTriggerRef}
      >
        {previewSrc && <img src={previewSrc} alt="剪贴板图片预览" className="clm-dialog-image" />}
      </Dialog>
    </div>
  )
}
