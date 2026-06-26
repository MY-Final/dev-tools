import { useState, useCallback, useEffect } from 'react'
import { Fingerprint, Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/hmac-generator.css'

type Algorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type InputFormat = 'text' | 'hex' | 'base64'
type OutputFormat = 'hex' | 'base64'

const ALGORITHMS: { id: Algorithm; label: string; bits: number }[] = [
  { id: 'SHA-1', label: 'HMAC-SHA-1', bits: 160 },
  { id: 'SHA-256', label: 'HMAC-SHA-256', bits: 256 },
  { id: 'SHA-384', label: 'HMAC-SHA-384', bits: 384 },
  { id: 'SHA-512', label: 'HMAC-SHA-512', bits: 512 }
]

// ── Helpers ────────────────────────────────────────────────────

function parseInput(input: string, format: InputFormat): Uint8Array {
  if (!input) return new Uint8Array(0)
  switch (format) {
    case 'text':
      return new TextEncoder().encode(input)
    case 'hex': {
      const hex = input.replace(/\s/g, '')
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2)
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
      return bytes
    }
    case 'base64': {
      const binary = atob(input)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
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
  const [copiedAll, setCopiedAll] = useState(false)

  // Real-time computation
  useEffect(() => {
    if (!keyInput || !messageInput) {
      setResult('')
      setError('')
      return
    }

    let cancelled = false

    const run = async (): Promise<void> => {
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
          keyBytes.buffer as ArrayBuffer,
          { name: 'HMAC', hash: algorithm },
          false,
          ['sign']
        )

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes.buffer as ArrayBuffer)
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

    run()
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

  const copyAll = useCallback(async () => {
    if (!result) return
    const currentAlgo = ALGORITHMS.find((a) => a.id === algorithm)
    const text = `${currentAlgo?.label}: ${result}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      /* ignore */
    }
  }, [result, algorithm])

  const clear = useCallback(() => {
    setKeyInput('')
    setMessageInput('')
    setResult('')
    setError('')
  }, [])

  const loadSample = useCallback(
    (key: string, message: string) => {
      setKeyInput(key)
      setKeyFormat('text')
      setMessageInput(message)
      setMessageFormat('text')
    },
    []
  )

  const bits = result
    ? outputFormat === 'hex'
      ? result.length * 4
      : atob(result).length * 8
    : 0

  return (
    <div className="hmac-page">
      <div className="hmac-card">
        <div className="hmac-header">
          <h2 className="hmac-title">HMAC Generator</h2>
          <p className="hmac-subtitle">HMAC-SHA256/512 签名生成</p>
        </div>

        {/* Algorithm selector */}
        <div className="hmac-algo-selector">
          {ALGORITHMS.map(({ id, label }) => (
            <button
              key={id}
              className={`hmac-algo-btn ${algorithm === id ? 'active' : ''}`}
              onClick={() => setAlgorithm(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Key input */}
        <div className="hmac-input-area">
          <div className="hmac-input-header">
            <span className="hmac-input-label">密钥 (Secret Key)</span>
            <div className="hmac-format-group">
              {(['text', 'hex', 'base64'] as InputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`hmac-format-btn ${keyFormat === f ? 'active' : ''}`}
                  onClick={() => setKeyFormat(f)}
                >
                  {f === 'text' ? '文本' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="hmac-textarea"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={
              keyFormat === 'text'
                ? '输入密钥...'
                : keyFormat === 'hex'
                  ? '输入十六进制密钥 (例: 4a6f686e)...'
                  : '输入 Base64 密钥...'
            }
            rows={2}
          />
        </div>

        {/* Message input */}
        <div className="hmac-input-area">
          <div className="hmac-input-header">
            <span className="hmac-input-label">消息 (Message)</span>
            <div className="hmac-format-group">
              {(['text', 'hex', 'base64'] as InputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`hmac-format-btn ${messageFormat === f ? 'active' : ''}`}
                  onClick={() => setMessageFormat(f)}
                >
                  {f === 'text' ? '文本' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="hmac-textarea"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={
              messageFormat === 'text'
                ? '输入要签名的消息...'
                : messageFormat === 'hex'
                  ? '输入十六进制消息...'
                  : '输入 Base64 消息...'
            }
            rows={3}
          />
        </div>

        {/* Output format + actions */}
        <div className="hmac-options">
          <div className="hmac-option-group">
            <span className="hmac-option-label">输出格式</span>
            <div className="hmac-format-group">
              {(['hex', 'base64'] as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  className={`hmac-format-btn ${outputFormat === f ? 'active' : ''}`}
                  onClick={() => setOutputFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="hmac-option-actions">
            {result && (
              <button className="hmac-copy-all-btn" onClick={copyAll}>
                {copiedAll ? <Check size={14} /> : <Copy size={14} />}
                {copiedAll ? '已复制' : '复制全部'}
              </button>
            )}
            <button className="hmac-clear-btn" onClick={clear}>
              <RotateCcw size={14} />
              清空
            </button>
          </div>
        </div>

        {/* Samples */}
        <div className="hmac-samples">
          <span className="hmac-samples-label">示例:</span>
          <button
            className="hmac-sample-btn"
            onClick={() => loadSample('secret-key', 'Hello, World!')}
          >
            示例 1
          </button>
          <button
            className="hmac-sample-btn"
            onClick={() =>
              loadSample(
                'my-api-secret-2024',
                '{"user":"admin","action":"login"}'
              )
            }
          >
            示例 2
          </button>
          <button
            className="hmac-sample-btn"
            onClick={() =>
              loadSample(
                'The quick brown fox',
                'jumps over the lazy dog'
              )
            }
          >
            示例 3
          </button>
        </div>

        {/* Error */}
        {error && <div className="hmac-error">{error}</div>}

        {/* Result */}
        {result && !error && (
          <div className="hmac-result">
            <div className="hmac-result-header">
              <div className="hmac-result-algo">
                <Fingerprint size={14} />
                <span>
                  {ALGORITHMS.find((a) => a.id === algorithm)?.label}
                </span>
              </div>
              <button className="hmac-copy-btn" onClick={copyResult}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="hmac-result-hash">{result}</div>
            <div className="hmac-result-length">
              {bits} bits / {result.length} chars
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
