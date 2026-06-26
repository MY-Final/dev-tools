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
    <div className="b64-page">
      <div className="b64-card">
        <div className="b64-header">
          <h2 className="b64-title">Base64 Codec</h2>
          <p className="b64-subtitle">Base64 编码与解码，支持 Unicode 和 Base64URL</p>
        </div>

        <div className="b64-controls">
          <div className="b64-mode-selector">
            <button
              className={`b64-mode-btn ${mode === 'encode' ? 'active' : ''}`}
              onClick={() => setMode('encode')}
            >
              编码
            </button>
            <button
              className={`b64-mode-btn ${mode === 'decode' ? 'active' : ''}`}
              onClick={() => setMode('decode')}
            >
              解码
            </button>
          </div>
          <div className="b64-variant-selector">
            <button
              className={`b64-variant-btn ${variant === 'standard' ? 'active' : ''}`}
              onClick={() => setVariant('standard')}
            >
              Standard
            </button>
            <button
              className={`b64-variant-btn ${variant === 'url' ? 'active' : ''}`}
              onClick={() => setVariant('url')}
            >
              URL
            </button>
          </div>
        </div>

        {variant === 'url' && (
          <div className="b64-hint">
            Base64URL 使用 - 和 _ 替代 + 和 /，无填充字符，适用于 URL 和 JWT
          </div>
        )}

        {isLikelyBase64 && mode === 'encode' && (
          <div className="b64-detect">
            <AlertTriangle size={14} />
            <span>输入内容看起来像 Base64</span>
            <button className="b64-detect-btn" onClick={switchToDecode}>
              切换到解码
            </button>
          </div>
        )}

        <div className="b64-io">
          <div className="b64-input-area">
            <div className="b64-input-header">
              <span className="b64-input-label">输入</span>
              <span className="b64-input-hint">
                {mode === 'encode' ? '文本 / JSON / URL' : 'Base64 字符串'}
              </span>
            </div>
            <textarea
              className="b64-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'encode' ? '输入要编码的文本...' : '输入要解码的 Base64...'}
              rows={6}
            />
          </div>

          <div className="b64-swap-area">
            <button className="b64-swap-btn" onClick={swap} disabled={!output}>
              <ArrowLeftRight size={16} />
            </button>
          </div>

          <div className="b64-output-area">
            <div className="b64-output-header">
              <span className="b64-output-label">输出</span>
              <div className="b64-output-actions">
                {formattedJSON && (
                  <button className="b64-format-btn" onClick={formatJSON}>
                    <Braces size={13} />
                    格式化 JSON
                  </button>
                )}
                <button className="b64-copy-btn" onClick={copyOutput} disabled={!output}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <textarea
              className="b64-textarea b64-output"
              value={error || output}
              readOnly
              placeholder="结果将在这里显示..."
              rows={6}
            />
          </div>
        </div>

        <div className="b64-actions">
          <button className="b64-action-btn" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>
      </div>
    </div>
  )
}
