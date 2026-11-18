import { useState, useCallback, useMemo } from 'react'
import { Copy, Check, ArrowLeftRight, RotateCcw, Braces, AlertTriangle } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'

type Mode = 'encode' | 'decode'
type Variant = 'standard' | 'url'

function base64Encode(text: string, variant: Variant): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  let base64 = btoa(binary)
  if (variant === 'url') {
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return base64
}

function base64Decode(str: string, variant: Variant): string {
  let base64 = str
  if (variant === 'url') {
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  // fatal 模式避免把二进制数据静默显示成一串替换字符。
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('INVALID_UTF8')
  }
}

/** 结合“能解码且是可读 UTF-8”判断，避免把 hello、test 之类的普通单词误报为 Base64。 */
function looksLikeBase64(str: string): boolean {
  const cleaned = str.trim()
  if (cleaned.length < 8) return false
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(cleaned)) return false

  const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (normalized.length % 4 === 1) return false

  try {
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (!text.length) return false
    return ![...text].some((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code < 9 || (code > 13 && code < 32)
    })
  } catch {
    return false
  }
}

function tryFormatJSON(text: string): string | null {
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return null
  }
}

interface DecodeResult {
  output: string
  error: string
}

function computeOutput(input: string, mode: Mode, variant: Variant): DecodeResult {
  if (!input) return { output: '', error: '' }
  try {
    if (mode === 'encode') {
      return { output: base64Encode(input, variant), error: '' }
    }
    return { output: base64Decode(input, variant), error: '' }
  } catch (e) {
    const invalidUtf8 = e instanceof Error && e.message === 'INVALID_UTF8'
    return {
      output: '',
      error: invalidUtf8 ? '解码结果不是有效的 UTF-8 文本' : '无效的 Base64 字符串'
    }
  }
}

export default function Base64Codec(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('encode')
  const [variant, setVariant] = useState<Variant>('standard')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [formattedFor, setFormattedFor] = useState<string | null>(null)

  const { output, error } = useMemo(
    () => computeOutput(input, mode, variant),
    [input, mode, variant]
  )

  const isLikelyBase64 = useMemo(() => looksLikeBase64(input), [input])

  const formattedJSON = useMemo(() => {
    if (mode === 'decode' && output) return tryFormatJSON(output)
    return null
  }, [mode, output])

  // 记住“格式化视图是为哪份输出打开的”：输出变化后自动回到原始结果，无需副作用。
  const showFormatted = formattedFor !== null && formattedFor === output
  const displayedOutput = showFormatted && formattedJSON ? formattedJSON : output

  const copyOutput = useCallback(async () => {
    if (!displayedOutput) return
    const ok = await copyText(displayedOutput)
    if (!ok) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [displayedOutput])

  const swap = useCallback(() => {
    if (displayedOutput) {
      setInput(displayedOutput)
      setMode(mode === 'encode' ? 'decode' : 'encode')
    }
  }, [displayedOutput, mode])

  const clear = useCallback(() => {
    setInput('')
  }, [])

  const toggleFormatted = useCallback(() => {
    setFormattedFor((prev) => (prev === output ? null : output))
  }, [output])

  const switchToDecode = useCallback(() => {
    setMode('decode')
  }, [])

  return (
    <div className="b64-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Base64 Codec</h2>
          <p className="tool-page-desc">Base64 编码与解码，支持 Unicode 文本与 Base64URL 变体。</p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn tool-btn--outline" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel b64-toolbar">
        <div className="b64-toolbar-row">
          <div className="tool-segmented">
            <button
              type="button"
              className={`tool-seg ${mode === 'encode' ? 'active' : ''}`}
              onClick={() => setMode('encode')}
              aria-pressed={mode === 'encode'}
            >
              编码
            </button>
            <button
              type="button"
              className={`tool-seg ${mode === 'decode' ? 'active' : ''}`}
              onClick={() => setMode('decode')}
              aria-pressed={mode === 'decode'}
            >
              解码
            </button>
          </div>
          <div className="tool-segmented">
            <button
              type="button"
              className={`tool-seg ${variant === 'standard' ? 'active' : ''}`}
              onClick={() => setVariant('standard')}
              aria-pressed={variant === 'standard'}
            >
              Standard
            </button>
            <button
              type="button"
              className={`tool-seg ${variant === 'url' ? 'active' : ''}`}
              onClick={() => setVariant('url')}
              aria-pressed={variant === 'url'}
            >
              URL
            </button>
          </div>
          <span className="b64-toolbar-note">
            {variant === 'url'
              ? 'Base64URL 使用 - 和 _，无填充字符'
              : mode === 'encode'
                ? '输入文本 / JSON / URL'
                : '输入 Base64 字符串'}
          </span>
        </div>

        {isLikelyBase64 && mode === 'encode' && (
          <div className="b64-detect">
            <AlertTriangle size={13} aria-hidden="true" />
            <span>输入内容看起来像 Base64</span>
            <button type="button" className="b64-detect-btn" onClick={switchToDecode}>
              切换到解码
            </button>
          </div>
        )}
      </section>

      <div className="b64-io">
        <section className="tool-panel b64-pane">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输入</h3>
          </div>
          <textarea
            className="b64-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? '输入要编码的文本…' : '输入要解码的 Base64…'}
            aria-label={mode === 'encode' ? '要编码的文本' : '要解码的 Base64'}
            spellCheck={false}
          />
        </section>

        <div className="b64-swap-area">
          <button
            type="button"
            className="tool-icon-btn b64-swap-btn"
            onClick={swap}
            disabled={!displayedOutput}
            title="交换输入与输出"
            aria-label="交换输入与输出"
          >
            <ArrowLeftRight size={15} aria-hidden="true" />
          </button>
        </div>

        <section className="tool-panel b64-pane">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输出</h3>
            <div className="b64-output-actions">
              {formattedJSON && formattedJSON !== output && (
                <button type="button" className="tool-btn" onClick={toggleFormatted}>
                  <Braces size={13} aria-hidden="true" />
                  {showFormatted ? '还原输出' : '格式化 JSON'}
                </button>
              )}
              <button
                type="button"
                className="tool-btn"
                onClick={copyOutput}
                disabled={!displayedOutput}
              >
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          <textarea
            className={`b64-textarea b64-output ${error ? 'b64-output--error' : ''}`}
            value={error || displayedOutput}
            readOnly
            placeholder="结果将在这里显示…"
            aria-label="转换结果"
            spellCheck={false}
          />
        </section>
      </div>
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
