import { useState, useCallback, useRef, useEffect } from 'react'
import { Copy, Check, RotateCcw, Upload, File, X } from 'lucide-react'
import '../styles/hash-generator.css'
import { bytesToHex, md5Hex } from '../lib/crypto-utils'

type Algorithm = 'MD5' | 'SHA1' | 'SHA256' | 'SHA384' | 'SHA512'
type InputMode = 'text' | 'file'

const ALGORITHMS: { id: Algorithm; label: string; bits: number }[] = [
  { id: 'MD5', label: 'MD5', bits: 128 },
  { id: 'SHA1', label: 'SHA-1', bits: 160 },
  { id: 'SHA256', label: 'SHA-256', bits: 256 },
  { id: 'SHA384', label: 'SHA-384', bits: 384 },
  { id: 'SHA512', label: 'SHA-512', bits: 512 }
]

const WEB_ALGO: Record<string, string> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512'
}

// ── Native Web Crypto hashing ──────────────────────────────────

async function digest(text: string, algo: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest(algo, data)
  return bytesToHex(new Uint8Array(buf))
}

const EMPTY: Record<Algorithm, string> = { MD5: '', SHA1: '', SHA256: '', SHA384: '', SHA512: '' }

// ── Helpers ────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / k ** i).toFixed(1)) + ' ' + sizes[i]
}

// ── Component ──────────────────────────────────────────────────

export default function HashGenerator(): React.JSX.Element {
  const [mode, setMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uppercase, setUppercase] = useState(false)
  const [copiedAlgo, setCopiedAlgo] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [results, setResults] = useState<Record<Algorithm, string>>(EMPTY)
  const [computing, setComputing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Text hashing (async via useEffect)
  useEffect(() => {
    let cancelled = false

    const run = async (): Promise<void> => {
      await Promise.resolve()
      if (cancelled) return

      if (mode !== 'text' || !textInput) {
        setResults(EMPTY)
        setComputing(false)
        return
      }

      setComputing(true)
      const r: Record<Algorithm, string> = { ...EMPTY }
      r.MD5 = md5Hex(new TextEncoder().encode(textInput))
      await Promise.all(
        (Object.entries(WEB_ALGO) as [Algorithm, string][]).map(async ([id, algo]) => {
          r[id] = await digest(textInput, algo)
        })
      )
      if (!cancelled) {
        setResults(r)
        setComputing(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [textInput, mode])
  // File hashing
  const handleFile = useCallback((f: File) => {
    setFile(f)
    setTextInput('')
    setComputing(true)

    void (async () => {
      try {
        const fileBuffer = await f.arrayBuffer()
        const data = new Uint8Array(fileBuffer)
        const r: Record<Algorithm, string> = { ...EMPTY }

        r.MD5 = md5Hex(data)
        await Promise.all(
          (Object.entries(WEB_ALGO) as [Algorithm, string][]).map(async ([id, algo]) => {
            const buf = await crypto.subtle.digest(algo, fileBuffer)
            r[id] = bytesToHex(new Uint8Array(buf))
          })
        )

        setResults(r)
      } finally {
        setComputing(false)
      }
    })()
  }, [])
  const formatHash = useCallback(
    (hash: string) => (uppercase ? hash.toUpperCase() : hash.toLowerCase()),
    [uppercase]
  )
  const clear = useCallback(() => {
    setTextInput('')
    setFile(null)
    setResults(EMPTY)
    setComputing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])
  const copyHash = useCallback(async (algo: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopiedAlgo(algo)
      setTimeout(() => setCopiedAlgo(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])
  const copyAll = useCallback(async () => {
    if (!Object.values(results).some(Boolean)) return
    const t = ALGORITHMS.map(({ id, label }) => `${label}: ${formatHash(results[id])}`).join('\n')
    try {
      await navigator.clipboard.writeText(t)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      /* ignore */
    }
  }, [results, formatHash])

  const hasResults = Object.values(results).some((v) => v)

  return (
    <div className="hg-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Hash Generator</h2>
          <p className="tool-page-desc">同时计算 MD5、SHA-1、SHA-256、SHA-384 与 SHA-512 摘要。</p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn tool-btn--outline" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel hg-input-panel">
        <div className="tool-panel-head">
          <div className="tool-segmented">
            <button
              type="button"
              className={`tool-seg ${mode === 'text' ? 'active' : ''}`}
              onClick={() => setMode('text')}
              aria-pressed={mode === 'text'}
            >
              文本输入
            </button>
            <button
              type="button"
              className={`tool-seg ${mode === 'file' ? 'active' : ''}`}
              onClick={() => setMode('file')}
              aria-pressed={mode === 'file'}
            >
              文件上传
            </button>
          </div>
          {mode === 'text' && (
            <div className="hg-samples">
              {['Hello, World!', 'The quick brown fox jumps over the lazy dog'].map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="hg-sample-btn"
                  onClick={() => setTextInput(s)}
                >
                  示例 {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'text' ? (
          <div className="hg-input-area">
            <label className="hg-input-label" htmlFor="hg-input">
              输入文本
            </label>
            <textarea
              id="hg-input"
              className="hg-textarea"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="输入要计算哈希的文本…"
              rows={5}
            />
          </div>
        ) : (
          <div className="hg-file-area">
            {!file ? (
              <button
                type="button"
                className={`hg-dropzone ${dragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={26} aria-hidden="true" />
                <span className="hg-dropzone-text">拖拽文件到此处，或点击选择文件</span>
                <span className="hg-dropzone-hint">支持任意文件格式</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                  hidden
                />
              </button>
            ) : (
              <div className="hg-file-info">
                <File size={20} aria-hidden="true" />
                <div className="hg-file-details">
                  <span className="hg-file-name">{file.name}</span>
                  <span className="hg-file-meta">
                    {formatSize(file.size)} · {file.type || '未知类型'}
                  </span>
                </div>
                <button
                  type="button"
                  className="tool-icon-btn hg-file-remove"
                  onClick={() => {
                    setFile(null)
                    setResults(EMPTY)
                    setComputing(false)
                  }}
                  aria-label="移除文件"
                  title="移除文件"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="tool-panel hg-results-panel">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">哈希结果</h3>
          <div className="hg-results-actions">
            <div className="tool-segmented">
              <button
                type="button"
                className={`tool-seg ${!uppercase ? 'active' : ''}`}
                onClick={() => setUppercase(false)}
                aria-pressed={!uppercase}
              >
                abc
              </button>
              <button
                type="button"
                className={`tool-seg ${uppercase ? 'active' : ''}`}
                onClick={() => setUppercase(true)}
                aria-pressed={uppercase}
              >
                ABC
              </button>
            </div>
            {hasResults && !computing && (
              <button type="button" className="tool-btn" onClick={copyAll}>
                {copiedAll ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copiedAll ? '已复制' : '复制全部'}
              </button>
            )}
          </div>
        </div>

        {computing ? (
          <div className="hg-state">
            <span className="hg-spinner" aria-hidden="true" />
            正在计算…
          </div>
        ) : hasResults ? (
          <div className="hg-results">
            {ALGORITHMS.map(({ id, label, bits }) => {
              const hash = results[id]
              if (!hash) return null
              const displayHash = formatHash(hash)
              return (
                <div key={id} className="hg-result-row">
                  <div className="hg-result-meta">
                    <span className="hg-result-algo">{label}</span>
                    <span className="hg-result-bits">{bits} bits</span>
                  </div>
                  <code className="hg-result-hash">{displayHash}</code>
                  <button
                    type="button"
                    className="tool-icon-btn hg-copy-btn"
                    onClick={() => copyHash(id, displayHash)}
                    aria-label={`复制 ${label} 哈希`}
                    title={`复制 ${label}`}
                  >
                    {copiedAlgo === id ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="hg-state">输入文本或选择文件后自动计算，五种算法同时生成。</div>
        )}
      </section>
    </div>
  )
}
