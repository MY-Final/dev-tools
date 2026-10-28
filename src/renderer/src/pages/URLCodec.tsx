import { useState, useCallback } from 'react'
import { Copy, Check, ArrowLeftRight, RotateCcw } from 'lucide-react'

type Mode = 'component' | 'full'

const SAMPLES = [
  'https://example.com/search?q=hello world&lang=zh',
  'name=张三&age=25&city=北京',
  'key=value&special=!@#$%^&*()'
]

export default function URLCodec(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<Mode>('component')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const encode = useCallback(() => {
    if (!input.trim()) return
    setError('')
    try {
      const result = mode === 'component' ? encodeURIComponent(input) : encodeURI(input)
      setOutput(result)
    } catch {
      setError('编码失败')
    }
  }, [input, mode])

  const decode = useCallback(() => {
    if (!input.trim()) return
    setError('')
    try {
      const result = mode === 'component' ? decodeURIComponent(input) : decodeURI(input)
      setOutput(result)
    } catch {
      setError('解码失败：输入包含无效的编码序列')
    }
  }, [input, mode])

  const swap = useCallback(() => {
    if (output) {
      setInput(output)
      setOutput('')
    }
  }, [output])

  const clear = useCallback(() => {
    setInput('')
    setOutput('')
    setError('')
  }, [])

  const copyOutput = useCallback(async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback
    }
  }, [output])

  const loadSample = useCallback((sample: string) => {
    setInput(sample)
    setOutput('')
    setError('')
  }, [])

  return (
    <div className="urlc-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">URL 编解码</h2>
          <p className="tool-page-desc">
            对 URL 或参数字符串进行编码与解码，支持完整链接与查询参数两种模式。
          </p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn tool-btn--outline" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel urlc-toolbar">
        <div className="urlc-toolbar-row">
          <div className="tool-segmented">
            <button
              type="button"
              className={`tool-seg ${mode === 'component' ? 'active' : ''}`}
              onClick={() => setMode('component')}
              aria-pressed={mode === 'component'}
            >
              参数编码
            </button>
            <button
              type="button"
              className={`tool-seg ${mode === 'full' ? 'active' : ''}`}
              onClick={() => setMode('full')}
              aria-pressed={mode === 'full'}
            >
              完整 URL
            </button>
          </div>
          <span className="urlc-hint">
            {mode === 'component'
              ? 'encodeURIComponent — 编码所有特殊字符，适用于查询参数'
              : 'encodeURI — 保留 URL 结构字符（: / ? # & =），适用于完整链接'}
          </span>
        </div>
      </section>

      <div className="tool-split tool-split--even urlc-layout">
        <section className="tool-panel urlc-pane">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输入</h3>
            <div className="urlc-samples">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="urlc-sample-btn"
                  onClick={() => loadSample(s)}
                >
                  示例 {i + 1}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="urlc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要编码或解码的文本…"
            aria-label="要编码或解码的文本"
            spellCheck={false}
          />
          <div className="urlc-actions">
            <button type="button" className="tool-btn tool-btn--primary" onClick={encode}>
              编码
            </button>
            <button type="button" className="tool-btn tool-btn--outline" onClick={decode}>
              解码
            </button>
          </div>
        </section>

        <section className="tool-panel urlc-pane urlc-output-pane">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输出</h3>
            <div className="urlc-output-actions">
              <button
                type="button"
                className="tool-icon-btn"
                onClick={swap}
                disabled={!output}
                title="互换到输入"
                aria-label="互换到输入"
              >
                <ArrowLeftRight size={14} aria-hidden="true" />
              </button>
              <button type="button" className="tool-btn" onClick={copyOutput} disabled={!output}>
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="urlc-error" role="status">
              {error}
            </div>
          ) : output ? (
            <pre className="urlc-output-text">{output}</pre>
          ) : (
            <div className="urlc-empty">选择模式并输入内容，点击「编码」或「解码」查看结果。</div>
          )}
        </section>
      </div>
    </div>
  )
}
