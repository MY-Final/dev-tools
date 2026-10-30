import { useState, useCallback } from 'react'
import { Copy, Check, ArrowLeftRight, RotateCcw } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'

type Mode = 'component' | 'full'
type Direction = 'encode' | 'decode'

const SAMPLES = [
  'https://example.com/search?q=hello world&lang=zh',
  'name=张三&age=25&city=北京',
  'key=value&special=!@#$%^&*()'
]

/** 统一转换入口：表单格式只影响「参数编码」模式，+ 与空格互转。 */
function transform(
  value: string,
  mode: Mode,
  form: boolean,
  direction: Direction
): { output: string; error: string } {
  try {
    if (direction === 'encode') {
      const encoded = mode === 'component' ? encodeURIComponent(value) : encodeURI(value)
      return {
        output: mode === 'component' && form ? encoded.replace(/%20/g, '+') : encoded,
        error: ''
      }
    }
    // 先还原 +，再解码：%2B 仍会正确得到字面量 +。
    const prepared = mode === 'component' && form ? value.replace(/\+/g, ' ') : value
    const decoded = mode === 'component' ? decodeURIComponent(prepared) : decodeURI(prepared)
    return { output: decoded, error: '' }
  } catch {
    return {
      output: '',
      error:
        direction === 'encode'
          ? '编码失败：输入包含无法编码的字符（如孤立代理项）'
          : '解码失败：存在无效的百分号编码（如 %ZZ 或截断的 %E4）'
    }
  }
}

export default function URLCodec(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<Mode>('component')
  const [form, setForm] = useState(false)
  const [lastAction, setLastAction] = useState<Direction | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(
    (direction: Direction, value: string = input) => {
      if (!value.trim()) return
      const result = transform(value, mode, form, direction)
      setOutput(result.output)
      setError(result.error)
      setLastAction(direction)
    },
    [input, mode, form]
  )

  const encode = useCallback(() => run('encode'), [run])
  const decode = useCallback(() => run('decode'), [run])

  const resetResult = useCallback(() => {
    setOutput('')
    setError('')
    setLastAction(null)
  }, [])

  const changeMode = useCallback(
    (next: Mode) => {
      if (next === mode) return
      setMode(next)
      resetResult()
    },
    [mode, resetResult]
  )

  const toggleForm = useCallback(() => {
    setForm((prev) => !prev)
    resetResult()
  }, [resetResult])

  // 交换后按相反方向立即重算，方便做一次编码/解码往返。
  const swap = useCallback(() => {
    if (!output) return
    const nextInput = output
    setInput(nextInput)
    resetResult()
    if (lastAction) {
      const next: Direction = lastAction === 'encode' ? 'decode' : 'encode'
      const result = transform(nextInput, mode, form, next)
      setOutput(result.output)
      setError(result.error)
      setLastAction(next)
    }
  }, [output, lastAction, mode, form, resetResult])

  const clear = useCallback(() => {
    setInput('')
    resetResult()
  }, [resetResult])

  const copyOutput = useCallback(async () => {
    if (!output) return
    const ok = await copyText(output)
    if (!ok) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [output])

  const loadSample = useCallback(
    (sample: string) => {
      setInput(sample)
      resetResult()
    },
    [resetResult]
  )

  const hint =
    mode === 'full'
      ? 'encodeURI — 保留 URL 结构字符（: / ? # & =），适用于完整链接'
      : form
        ? '表单格式 — 空格编码为 +，解码时 + 视为空格（application/x-www-form-urlencoded）'
        : 'encodeURIComponent — 编码所有特殊字符，适用于查询参数'

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
              onClick={() => changeMode('component')}
              aria-pressed={mode === 'component'}
            >
              参数编码
            </button>
            <button
              type="button"
              className={`tool-seg ${mode === 'full' ? 'active' : ''}`}
              onClick={() => changeMode('full')}
              aria-pressed={mode === 'full'}
            >
              完整 URL
            </button>
          </div>
          {mode === 'component' && (
            <label className="urlc-form-toggle">
              <input type="checkbox" checked={form} onChange={toggleForm} />
              <span>表单格式</span>
            </label>
          )}
          <span className="urlc-hint">{hint}</span>
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
            <button
              type="button"
              className="tool-btn tool-btn--primary"
              onClick={encode}
              disabled={!input.trim()}
            >
              编码
            </button>
            <button
              type="button"
              className="tool-btn tool-btn--outline"
              onClick={decode}
              disabled={!input.trim()}
            >
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
                title="结果移回输入，并按相反方向转换"
                aria-label="结果移回输入并反向转换"
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
            <pre className="urlc-output-text" aria-live="polite">
              {output}
            </pre>
          ) : (
            <div className="urlc-empty">选择模式并输入内容，点击「编码」或「解码」查看结果。</div>
          )}
        </section>
      </div>
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
