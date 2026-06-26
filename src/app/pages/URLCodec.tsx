import { useState, useCallback } from 'react'
import { Link2, Copy, Check, ArrowLeftRight, RotateCcw } from 'lucide-react'

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
    <div className="uc-page">
      <div className="uc-card">
        <div className="uc-header">
          <h2 className="uc-title">URL 编解码</h2>
          <p className="uc-subtitle">对 URL 或参数字符串进行编码与解码</p>
        </div>

        <div className="uc-mode-selector">
          <button
            className={`uc-mode-btn ${mode === 'component' ? 'active' : ''}`}
            onClick={() => setMode('component')}
          >
            参数编码
          </button>
          <button
            className={`uc-mode-btn ${mode === 'full' ? 'active' : ''}`}
            onClick={() => setMode('full')}
          >
            完整 URL
          </button>
        </div>

        <div className="uc-hint">
          {mode === 'component'
            ? 'encodeURIComponent — 编码所有特殊字符，适用于查询参数'
            : 'encodeURI — 保留 URL 结构字符（: / ? # & =），适用于完整链接'}
        </div>

        <div className="uc-input-area">
          <div className="uc-input-header">
            <span className="uc-input-label">输入</span>
            <div className="uc-samples">
              {SAMPLES.map((s, i) => (
                <button key={i} className="uc-sample-btn" onClick={() => loadSample(s)}>
                  示例 {i + 1}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="uc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要编码或解码的文本..."
            rows={4}
          />
        </div>

        <div className="uc-actions">
          <button className="uc-btn uc-btn-primary" onClick={encode}>
            <Link2 size={15} />
            编码
          </button>
          <button className="uc-btn uc-btn-secondary" onClick={decode}>
            <Link2 size={15} />
            解码
          </button>
          <button className="uc-btn uc-btn-ghost" onClick={swap} disabled={!output}>
            <ArrowLeftRight size={15} />
            互换
          </button>
          <button className="uc-btn uc-btn-ghost" onClick={clear}>
            <RotateCcw size={15} />
            清空
          </button>
        </div>

        {error && <div className="uc-error">{error}</div>}

        {output && (
          <div className="uc-output-area">
            <div className="uc-output-header">
              <span className="uc-output-label">输出</span>
              <button className="uc-copy-btn" onClick={copyOutput}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="uc-output-text">{output}</div>
          </div>
        )}
      </div>
    </div>
  )
}
