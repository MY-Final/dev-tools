import { useState, useCallback, useRef, useEffect } from 'react'
import { Hash, Copy, Check, RotateCcw, Upload, File, X } from 'lucide-react'
import '../styles/hash-generator.css'

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
  SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512'
}

// ── Pure JS MD5 (~1KB, no dependencies) ────────────────────────

function md5(input: string): string {
  const add = (a: number, b: number): number => ((a & 0x7fffffff) + (b & 0x7fffffff)) ^ (a & 0x80000000) ^ (b & 0x80000000)
  const rotl = (v: number, s: number): number => (v << s) | (v >>> (32 - s))
  const F = (x: number, y: number, z: number): number => (x & y) | (~x & z)
  const G = (x: number, y: number, z: number): number => (x & z) | (y & ~z)
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number => add(rotl(add(add(a, add(F(b, c, d), x)), ac), s), b)
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number => add(rotl(add(add(a, add(G(b, c, d), x)), ac), s), b)

  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) bytes.push(input.charCodeAt(i))
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const len = input.length * 8
  for (let i = 0; i < 4; i++) bytes.push((len >>> (i * 8)) & 0xff)

  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 4) words.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24))

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476
  const S = [7, 12, 17, 22, 5, 9, 14, 20]
  const AC = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a]
  const CI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12]

  for (let k = 0; k < words.length; k += 16) {
    const aa = a, bb = b, cc = c, dd = d
    for (let i = 0; i < 16; i++) { const fn = i < 16 ? ff : gg; a = fn(a, b, c, d, words[k + CI[i]], S[i < 16 ? (i % 4) : ((i - 16) % 4) * 2 + (i >= 24 ? 2 : i >= 20 ? 1 : 0)], AC[i]); [a, b, c, d] = [d, a, b, c] }
    for (let i = 16; i < 32; i++) { a = gg(a, b, c, d, words[k + CI[i]], S[4 + (i % 4)], AC[i]); [a, b, c, d] = [d, a, b, c] }
    a = add(a, aa); b = add(b, bb); c = add(c, cc); d = add(d, dd)
  }

  const h = (n: number): string => { let s = ''; for (let i = 0; i < 4; i++) s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0'); return s }
  return h(a) + h(b) + h(c) + h(d)
}

// ── Native Web Crypto hashing ──────────────────────────────────

async function digest(text: string, algo: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest(algo, data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
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
    if (mode !== 'text' || !textInput) { setResults(EMPTY); return }
    let cancelled = false

    const run = async (): Promise<void> => {
      setComputing(true)
      const r: Record<Algorithm, string> = { ...EMPTY }
      r.MD5 = md5(textInput)
      await Promise.all(
        (Object.entries(WEB_ALGO) as [Algorithm, string][]).map(async ([id, algo]) => {
          r[id] = await digest(textInput, algo)
        })
      )
      if (!cancelled) { setResults(r); setComputing(false) }
    }
    run()
    return () => { cancelled = true }
  }, [textInput, mode])

  // File hashing
  const handleFile = useCallback((f: File) => {
    setFile(f); setTextInput(''); setComputing(true)
    let cancelled = false

    const hashFile = async (algo: string): Promise<string> => {
      const data = await f.arrayBuffer()
      const buf = await crypto.subtle.digest(algo, data)
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    ;(async () => {
      const r: Record<Algorithm, string> = { ...EMPTY }
      r.MD5 = md5(await f.text())
      await Promise.all(
        (Object.entries(WEB_ALGO) as [Algorithm, string][]).map(async ([id, algo]) => {
          r[id] = await hashFile(algo)
        })
      )
      if (!cancelled) { setResults(r); setComputing(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const formatHash = useCallback((hash: string) => uppercase ? hash.toUpperCase() : hash.toLowerCase(), [uppercase])
  const clear = useCallback(() => { setTextInput(''); setFile(null); setResults(EMPTY); setComputing(false); if (fileInputRef.current) fileInputRef.current.value = '' }, [])
  const copyHash = useCallback(async (algo: string, hash: string) => { try { await navigator.clipboard.writeText(hash); setCopiedAlgo(algo); setTimeout(() => setCopiedAlgo(null), 1500) } catch { /* ignore */ } }, [])
  const copyAll = useCallback(async () => {
    if (!Object.values(results).some(Boolean)) return
    const t = ALGORITHMS.map(({ id, label }) => `${label}: ${formatHash(results[id])}`).join('\n')
    try { await navigator.clipboard.writeText(t); setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1500) } catch { /* ignore */ }
  }, [results, formatHash])

  const hasResults = Object.values(results).some((v) => v)

  return (
    <div className="hg-page"><div className="hg-card">
      <div className="hg-header"><h2 className="hg-title">Hash Generator</h2><p className="hg-subtitle">生成 MD5、SHA-1、SHA-256、SHA-384、SHA-512 哈希值</p></div>
      <div className="hg-mode-selector">
        <button className={`hg-mode-btn ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>文本输入</button>
        <button className={`hg-mode-btn ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>文件上传</button>
      </div>
      {mode === 'text' ? (
        <div className="hg-input-area">
          <div className="hg-input-header">
            <span className="hg-input-label">输入文本</span>
            <div className="hg-samples">
              {['Hello, World!', 'The quick brown fox jumps over the lazy dog', 'dev-tools@1.0.0'].map((s, i) => (
                <button key={i} className="hg-sample-btn" onClick={() => setTextInput(s)}>示例 {i + 1}</button>
              ))}
            </div>
          </div>
          <textarea className="hg-textarea" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="输入要计算哈希的文本..." rows={4} />
        </div>
      ) : (
        <div className="hg-file-area">
          {!file ? (
            <div className={`hg-dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} /><p className="hg-dropzone-text">拖拽文件到此处，或点击上传</p><p className="hg-dropzone-hint">支持任意文件格式</p>
              <input ref={fileInputRef} type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
            </div>
          ) : (
            <div className="hg-file-info">
              <div className="hg-file-icon"><File size={24} /></div>
              <div className="hg-file-details"><div className="hg-file-name">{file.name}</div><div className="hg-file-meta">{formatSize(file.size)} · {file.type || '未知类型'}</div></div>
              <button className="hg-file-remove" onClick={() => { setFile(null); setResults(EMPTY); setComputing(false) }}><X size={16} /></button>
            </div>
          )}
        </div>
      )}
      <div className="hg-options">
        <div className="hg-option-group"><span className="hg-option-label">大小写</span><button className={`hg-toggle-btn ${uppercase ? 'active' : ''}`} onClick={() => setUppercase(!uppercase)}>{uppercase ? 'ABC' : 'abc'}</button></div>
        <div className="hg-option-actions">
          {hasResults && !computing && <button className="hg-copy-all-btn" onClick={copyAll}>{copiedAll ? <Check size={14} /> : <Copy size={14} />}{copiedAll ? '已复制' : '复制全部'}</button>}
          <button className="hg-clear-btn" onClick={clear}><RotateCcw size={14} />清空</button>
        </div>
      </div>
      {computing && <div className="hg-computing"><div className="hg-spinner" />正在计算...</div>}
      {hasResults && !computing && (
        <div className="hg-results">
          {ALGORITHMS.map(({ id, label, bits }) => {
            const hash = results[id]
            if (!hash) return null
            const displayHash = formatHash(hash)
            return (
              <div key={id} className="hg-result-item">
                <div className="hg-result-header"><div className="hg-result-algo"><Hash size={14} /><span>{label}</span></div><button className="hg-copy-btn" onClick={() => copyHash(id, displayHash)}>{copiedAlgo === id ? <Check size={13} /> : <Copy size={13} />}{copiedAlgo === id ? '已复制' : '复制'}</button></div>
                <div className="hg-result-hash">{displayHash}</div>
                <div className="hg-result-length">{bits} bits / {hash.length} chars</div>
              </div>
            )
          })}
        </div>
      )}
    </div></div>
  )
}
