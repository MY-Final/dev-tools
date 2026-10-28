import { useState, useCallback, useMemo } from 'react'
import { Copy, Check, ArrowLeftRight, RotateCcw, Braces, AlertTriangle } from 'lucide-react'

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
  const decoder = new TextDecoder()
  return decoder.decode(bytes)
}

function looksLikeBase64(str: string): boolean {
  const cleaned = str.trim()
  if (!cleaned) return false
  return /^[A-Za-z0-9+/_-]+=*$/.test(cleaned) && cleaned.length >= 4
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
  } catch {
    return { output: '', error: '无效的 Base64 字符串' }
  }
}

export default function Base64Codec(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('encode')
  const [variant, setVariant] = useState<Variant>('standard')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const { output, error } = useMemo(
    () => computeOutput(input, mode, variant),
    [input, mode, variant]
  )

  const isLikelyBase64 = useMemo(() => looksLikeBase64(input), [input])

  const formattedJSON = useMemo(() => {
    if (mode === 'decode' && output) return tryFormatJSON(output)
    return null
  }, [mode, output])

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

  const swap = useCallback(() => {
    if (output) {
      setInput(output)
      setMode(mode === 'encode' ? 'decode' : 'encode')
    }
  }, [output, mode])

  const clear = useCallback(() => {
    setInput('')
  }, [])

  const formatJSON = useCallback(() => {
    if (formattedJSON) {
      setInput(formattedJSON)
    }
  }, [formattedJSON])

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
            disabled={!output}
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
              {formattedJSON && (
                <button type="button" className="tool-btn" onClick={formatJSON}>
                  <Braces size={13} aria-hidden="true" />
                  格式化 JSON
                </button>
              )}
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
          <textarea
            className={`b64-textarea b64-output ${error ? 'b64-output--error' : ''}`}
            value={error || output}
            readOnly
            placeholder="结果将在这里显示…"
            aria-label="转换结果"
            spellCheck={false}
          />
        </section>
      </div>
    </div>
  )
}
