import { useState, useCallback, useEffect } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/hmac-generator.css'
import { hexToBytes, toArrayBuffer } from '../lib/crypto-utils'

type Algorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type InputFormat = 'text' | 'hex' | 'base64'
type OutputFormat = 'hex' | 'base64'

const ALGORITHMS: { id: Algorithm; label: string; bits: number }[] = [
  { id: 'SHA-1', label: 'HMAC-SHA-1', bits: 160 },
  { id: 'SHA-256', label: 'HMAC-SHA-256', bits: 256 },
  { id: 'SHA-384', label: 'HMAC-SHA-384', bits: 384 },
  { id: 'SHA-512', label: 'HMAC-SHA-512', bits: 512 }
]

const INPUT_FORMATS: { id: InputFormat; label: string }[] = [
  { id: 'text', label: '文本' },
  { id: 'hex', label: 'HEX' },
  { id: 'base64', label: 'Base64' }
]

// ── Helpers ────────────────────────────────────────────────────

function parseInput(input: string, format: InputFormat): Uint8Array {
  switch (format) {
    case 'text':
      return new TextEncoder().encode(input)
    case 'hex':
      return hexToBytes(input)
    case 'base64': {
      try {
        const binary = atob(input)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes
      } catch {
        throw new Error('无效的 Base64 字符串')
      }
    }
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

// ── Component ──────────────────────────────────────────────────

export default function HmacGenerator(): React.JSX.Element {
  const [algorithm, setAlgorithm] = useState<Algorithm>('SHA-256')
  const [keyInput, setKeyInput] = useState('')
  const [keyFormat, setKeyFormat] = useState<InputFormat>('text')
  const [messageInput, setMessageInput] = useState('')
  const [messageFormat, setMessageFormat] = useState<InputFormat>('text')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('hex')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Real-time computation
  useEffect(() => {
    let cancelled = false

    const run = async (): Promise<void> => {
      await Promise.resolve()
      if (cancelled) return

      if (!keyInput) {
        setResult('')
        setError('')
        return
      }

      try {
        const keyBytes = parseInput(keyInput, keyFormat)
        const messageBytes = parseInput(messageInput, messageFormat)

        if (keyBytes.length === 0) {
          setResult('')
          setError('密钥不能为空')
          return
        }

        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          toArrayBuffer(keyBytes),
          { name: 'HMAC', hash: algorithm },
          false,
          ['sign']
        )

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(messageBytes))
        const bytes = new Uint8Array(signature)

        if (!cancelled) {
          setResult(outputFormat === 'hex' ? toHex(bytes) : toBase64(bytes))
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setResult('')
          setError(err instanceof Error ? err.message : '计算失败')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [keyInput, keyFormat, messageInput, messageFormat, algorithm, outputFormat])

  const copyResult = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [result])

  const clear = useCallback(() => {
    setKeyInput('')
    setMessageInput('')
    setResult('')
    setError('')
  }, [])

  const loadSample = useCallback((key: string, message: string) => {
    setKeyInput(key)
    setKeyFormat('text')
    setMessageInput(message)
    setMessageFormat('text')
  }, [])

  const currentAlgo = ALGORITHMS.find((a) => a.id === algorithm)
  const bits = result ? (outputFormat === 'hex' ? result.length * 4 : atob(result).length * 8) : 0

  return (
    <div className="hmac-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">HMAC Generator</h2>
          <p className="tool-page-desc">使用密钥对消息生成 HMAC 签名，输入变化时实时计算。</p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn tool-btn--outline" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel hmac-toolbar">
        <div className="hmac-toolbar-row">
          <div className="tool-segmented" role="group" aria-label="签名算法">
            {ALGORITHMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`tool-seg ${algorithm === id ? 'active' : ''}`}
                onClick={() => setAlgorithm(id)}
                aria-pressed={algorithm === id}
              >
                {label.replace('HMAC-', '')}
              </button>
            ))}
          </div>
          <div className="hmac-output-format">
            <span className="hmac-field-label">输出</span>
            <div className="tool-segmented" role="group" aria-label="输出格式">
              {(['hex', 'base64'] as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`tool-seg ${outputFormat === f ? 'active' : ''}`}
                  onClick={() => setOutputFormat(f)}
                  aria-pressed={outputFormat === f}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="tool-split hmac-layout">
        <section className="tool-panel hmac-input">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输入</h3>
            <div className="hmac-samples">
              <span className="hmac-field-label">示例</span>
              <button
                type="button"
                className="hmac-sample-btn"
                onClick={() => loadSample('secret-key', 'Hello, World!')}
              >
                1
              </button>
              <button
                type="button"
                className="hmac-sample-btn"
                onClick={() =>
                  loadSample('my-api-secret-2024', '{"user":"admin","action":"login"}')
                }
              >
                2
              </button>
              <button
                type="button"
                className="hmac-sample-btn"
                onClick={() => loadSample('The quick brown fox', 'jumps over the lazy dog')}
              >
                3
              </button>
            </div>
          </div>

          <div className="hmac-field">
            <div className="hmac-field-head">
              <label className="hmac-field-label" htmlFor="hmac-key">
                密钥 Secret Key
              </label>
              <div className="tool-segmented" role="group" aria-label="密钥格式">
                {INPUT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`tool-seg ${keyFormat === f.id ? 'active' : ''}`}
                    onClick={() => setKeyFormat(f.id)}
                    aria-pressed={keyFormat === f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="hmac-key"
              className="hmac-textarea"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={
                keyFormat === 'text'
                  ? '输入密钥…'
                  : keyFormat === 'hex'
                    ? '输入十六进制密钥，如 4a6f686e'
                    : '输入 Base64 密钥'
              }
              rows={2}
              spellCheck={false}
            />
          </div>

          <div className="hmac-field hmac-field--message">
            <div className="hmac-field-head">
              <label className="hmac-field-label" htmlFor="hmac-message">
                消息 Message
              </label>
              <div className="tool-segmented" role="group" aria-label="消息格式">
                {INPUT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`tool-seg ${messageFormat === f.id ? 'active' : ''}`}
                    onClick={() => setMessageFormat(f.id)}
                    aria-pressed={messageFormat === f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="hmac-message"
              className="hmac-textarea hmac-textarea--message"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                messageFormat === 'text'
                  ? '输入要签名的消息…'
                  : messageFormat === 'hex'
                    ? '输入十六进制消息'
                    : '输入 Base64 消息'
              }
              rows={5}
              spellCheck={false}
            />
          </div>
        </section>

        <section className="tool-panel hmac-result">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">签名</h3>
            <button type="button" className="tool-btn" onClick={copyResult} disabled={!result}>
              {copied ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {copied ? '已复制' : '复制'}
            </button>
          </div>

          {error ? (
            <div className="hmac-error" role="status">
              {error}
            </div>
          ) : result ? (
            <>
              <div className="hmac-result-meta">
                <span className="hmac-result-algo">{currentAlgo?.label}</span>
                <span className="hmac-result-bits">{bits} bit</span>
              </div>
              <div className="hmac-result-hash">{result}</div>
              <p className="hmac-result-note">
                {bits / 8} 字节 · {result.length} 字符 · {outputFormat.toUpperCase()} 输出
              </p>
            </>
          ) : (
            <div className="hmac-empty">输入密钥后立即生成签名，无需点击按钮。</div>
          )}
        </section>
      </div>
    </div>
  )
}
