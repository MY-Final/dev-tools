import { useState, useCallback, useMemo } from 'react'
import { FileUp, Download, HardDrive, FileText, FileJson, FileCode, Database } from 'lucide-react'

type FileFormat = 'txt' | 'json' | 'csv' | 'binary' | 'base64'
type SizeUnit = 'KB' | 'MB' | 'GB'

const UNIT_BYTES: Record<SizeUnit, number> = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }

const FORMAT_LABELS: Record<FileFormat, { label: string; ext: string; mime: string; desc: string }> = {
  txt: { label: 'TXT', ext: '.txt', mime: 'text/plain', desc: '纯文本，每行随机英文字符' },
  json: { label: 'JSON', ext: '.json', mime: 'application/json', desc: '随机 JSON 对象数组' },
  csv: { label: 'CSV', ext: '.csv', mime: 'text/csv', desc: '随机行列数据' },
  binary: { label: 'Binary', ext: '.bin', mime: 'application/octet-stream', desc: '随机二进制字节' },
  base64: { label: 'Base64', ext: '.b64', mime: 'text/plain', desc: 'Base64 编码的随机数据' }
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
const CSV_HEADERS = ['id', 'name', 'email', 'score', 'created_at', 'status']
const STATUSES = ['active', 'inactive', 'pending', 'archived']

function randomString(len: number): string {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (v) => ALPHABET[v % ALPHABET.length]).join('')
}

function randomName(): string {
  const first = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
  return first[Math.floor(Math.random() * first.length)]
}

function generateContent(format: FileFormat, targetBytes: number): Uint8Array {
  switch (format) {
    case 'txt': {
      let text = ''
      while (text.length < targetBytes) {
        text += randomString(80) + '\n'
      }
      return new TextEncoder().encode(text.slice(0, targetBytes))
    }
    case 'json': {
      let json = '[\n'
      let first = true
      while (json.length < targetBytes - 3) {
        if (!first) json += ',\n'
        first = false
        json += `  {"id":${Math.floor(Math.random() * 100000)},"name":"${randomName()}","score":${(Math.random() * 100).toFixed(2)},"active":${Math.random() > 0.5}}`
      }
      json += '\n]'
      return new TextEncoder().encode(json.slice(0, targetBytes))
    }
    case 'csv': {
      let csv = CSV_HEADERS.join(',') + '\n'
      let i = 1
      while (csv.length < targetBytes) {
        csv += `${i},${randomName()},${randomString(8)}@test.com,${(Math.random() * 100).toFixed(0)},${new Date().toISOString()},${STATUSES[i % STATUSES.length]}\n`
        i++
      }
      return new TextEncoder().encode(csv.slice(0, targetBytes))
    }
    case 'binary': {
      const buf = new Uint8Array(targetBytes)
      crypto.getRandomValues(buf)
      return buf
    }
    case 'base64': {
      const rawSize = Math.ceil((targetBytes * 3) / 4)
      const raw = new Uint8Array(rawSize)
      crypto.getRandomValues(raw)
      let b64 = ''
      for (let i = 0; i < raw.length; i += 3) {
        const a = raw[i]
        const b = raw[i + 1] ?? 0
        const c = raw[i + 2] ?? 0
        b64 += alphabet[(a >> 2) & 63]
        b64 += alphabet[((a << 4) | (b >> 4)) & 63]
        b64 += alphabet[((b << 2) | (c >> 6)) & 63]
        b64 += alphabet[c & 63]
      }
      return new TextEncoder().encode(b64.slice(0, targetBytes))
    }
  }
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export default function FileGenerator(): React.JSX.Element {
  const [size, setSize] = useState(1)
  const [unit, setUnit] = useState<SizeUnit>('MB')
  const [format, setFormat] = useState<FileFormat>('txt')
  const [generating, setGenerating] = useState(false)

  const totalBytes = useMemo(() => size * UNIT_BYTES[unit], [size, unit])

  const sizeLabel = useMemo(() => {
    const bytes = totalBytes
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }, [totalBytes])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    // Yield to let UI update before heavy computation
    await new Promise((r) => setTimeout(r, 50))

    try {
      const content = generateContent(format, totalBytes)
      const blob = new Blob([content as Uint8Array<ArrayBuffer>], { type: FORMAT_LABELS[format].mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `test-file-${size}${unit.toLowerCase()}${FORMAT_LABELS[format].ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }, [size, unit, format, totalBytes])

  const formatIcons: Record<FileFormat, React.ComponentType<{ size?: number }>> = {
    txt: FileText,
    json: FileJson,
    csv: FileCode,
    binary: Database,
    base64: FileText
  }

  return (
    <div className="fg-page">
      <div className="fg-card">
        <div className="fg-header">
          <h2 className="fg-title">File Generator</h2>
          <p className="fg-subtitle">生成指定大小的测试文件，用于上传限制测试</p>
        </div>

        {/* Size */}
        <div className="fg-section">
          <span className="fg-section-label">文件大小</span>
          <div className="fg-size-row">
            <input
              type="number"
              className="fg-size-input"
              value={size}
              min={1}
              max={unit === 'GB' ? 10 : 1024}
              onChange={(e) => setSize(Number(e.target.value) || 1)}
            />
            <div className="fg-unit-tabs">
              {(['KB', 'MB', 'GB'] as SizeUnit[]).map((u) => (
                <button
                  key={u}
                  className={`fg-unit-btn ${unit === u ? 'active' : ''}`}
                  onClick={() => setUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="fg-size-hint">
            <HardDrive size={13} />
            <span>实际大小: {sizeLabel}</span>
          </div>
        </div>

        {/* Format */}
        <div className="fg-section">
          <span className="fg-section-label">文件格式</span>
          <div className="fg-formats">
            {(Object.keys(FORMAT_LABELS) as FileFormat[]).map((f) => {
              const fmt = FORMAT_LABELS[f]
              const Icon = formatIcons[f]
              return (
                <button
                  key={f}
                  className={`fg-format-btn ${format === f ? 'active' : ''}`}
                  onClick={() => setFormat(f)}
                >
                  <Icon size={18} />
                  <div className="fg-format-info">
                    <span className="fg-format-name">{fmt.label}</span>
                    <span className="fg-format-desc">{fmt.desc}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Generate */}
        <button
          className="fg-generate-btn"
          onClick={handleGenerate}
          disabled={generating || totalBytes > 1024 * 1024 * 1024}
        >
          {generating ? (
            <>
              <span className="fg-spinner" />
              生成中...
            </>
          ) : (
            <>
              <Download size={18} />
              生成 {sizeLabel} 文件
            </>
          )}
        </button>

        {totalBytes > 1024 * 1024 * 1024 && (
          <div className="fg-warning">
            <FileUp size={14} />
            超过 1GB 的文件生成较慢，建议拆分成多个小块
          </div>
        )}
      </div>
    </div>
  )
}
