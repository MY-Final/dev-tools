import { useState, useCallback, useMemo } from 'react'
import { FileUp, Download, HardDrive, FileText, FileJson, FileCode, Database } from 'lucide-react'

type FileFormat = 'txt' | 'json' | 'csv' | 'binary' | 'base64'
type SizeUnit = 'KB' | 'MB' | 'GB'

const UNIT_BYTES: Record<SizeUnit, number> = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }
const CRYPTO_CHUNK_BYTES = 65536
const STREAM_CHUNK_BYTES = 64 * 1024
const BASE64_RAW_CHUNK_BYTES = 60 * 1024
const TEXT_LINE_LENGTH = 80
const encoder = new TextEncoder()

const FORMAT_LABELS: Record<FileFormat, { label: string; ext: string; mime: string; desc: string }> = {
  txt: { label: 'TXT', ext: '.txt', mime: 'text/plain', desc: '纯文本，每行随机英文字符' },
  json: { label: 'JSON', ext: '.json', mime: 'application/json', desc: '随机 JSON 对象数组' },
  csv: { label: 'CSV', ext: '.csv', mime: 'text/csv', desc: '随机行列数据' },
  binary: { label: 'Binary', ext: '.bin', mime: 'application/octet-stream', desc: '随机二进制字节' },
  base64: { label: 'Base64', ext: '.b64', mime: 'text/plain', desc: 'Base64 编码的随机数据' }
}

const TEXT_ALPHABET_BYTES = Uint8Array.from(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
  (char) => char.charCodeAt(0)
)
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CSV_HEADERS = ['id', 'name', 'email', 'score', 'created_at', 'status']
const STATUSES = ['active', 'inactive', 'pending', 'archived']

function fillRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length)
  for (let offset = 0; offset < length; offset += CRYPTO_CHUNK_BYTES) {
    const end = Math.min(offset + CRYPTO_CHUNK_BYTES, length)
    crypto.getRandomValues(bytes.subarray(offset, end))
  }
  return bytes
}

function randomBytesFromAlphabet(length: number, alphabet: Uint8Array, newlineEvery = 0): Uint8Array<ArrayBuffer> {
  const bytes = fillRandomBytes(length)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = newlineEvery > 0 && i > 0 && i % newlineEvery === 0
      ? 10
      : alphabet[bytes[i] % alphabet.length]
  }
  return bytes
}

function encodeBase64Chunk(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    result += BASE64_ALPHABET[(a >> 2) & 63]
    result += BASE64_ALPHABET[((a << 4) | (b >> 4)) & 63]
    result += BASE64_ALPHABET[((b << 2) | (c >> 6)) & 63]
    result += BASE64_ALPHABET[c & 63]
  }
  return result
}

function randomString(length: number): string {
  const bytes = randomBytesFromAlphabet(length, TEXT_ALPHABET_BYTES)
  return new TextDecoder().decode(bytes)
}

function randomName(): string {
  const first = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
  return first[Math.floor(Math.random() * first.length)]
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function createTextBlob(targetBytes: number): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = []
  let remaining = targetBytes
  let chunkIndex = 0

  while (remaining > 0) {
    const chunkSize = Math.min(STREAM_CHUNK_BYTES, remaining)
    parts.push(randomBytesFromAlphabet(chunkSize, TEXT_ALPHABET_BYTES, TEXT_LINE_LENGTH))
    remaining -= chunkSize
    chunkIndex++
    if (chunkIndex % 64 === 0) await yieldToBrowser()
  }

  return new Blob(parts, { type: FORMAT_LABELS.txt.mime })
}

async function createBinaryBlob(targetBytes: number): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = []
  let remaining = targetBytes
  let chunkIndex = 0

  while (remaining > 0) {
    const chunkSize = Math.min(STREAM_CHUNK_BYTES, remaining)
    parts.push(fillRandomBytes(chunkSize))
    remaining -= chunkSize
    chunkIndex++
    if (chunkIndex % 64 === 0) await yieldToBrowser()
  }

  return new Blob(parts, { type: FORMAT_LABELS.binary.mime })
}

async function createBase64Blob(targetBytes: number): Promise<Blob> {
  const parts: string[] = []
  const rawBytes = Math.floor(targetBytes / 4) * 3
  let remaining = rawBytes
  let chunkIndex = 0

  while (remaining > 0) {
    const chunkSize = Math.min(BASE64_RAW_CHUNK_BYTES, remaining)
    parts.push(encodeBase64Chunk(fillRandomBytes(chunkSize)))
    remaining -= chunkSize
    chunkIndex++
    if (chunkIndex % 64 === 0) await yieldToBrowser()
  }

  return new Blob(parts, { type: FORMAT_LABELS.base64.mime })
}

async function createJsonBlob(targetBytes: number): Promise<Blob> {
  const parts: string[] = ['[']
  let writtenBytes = 1
  let firstRecord = true
  let batch = ''
  let chunkIndex = 0

  while (true) {
    const separator = firstRecord ? '\n  ' : ',\n  '
    const record =
      `${separator}{"id":${Math.floor(Math.random() * 100000)},` +
      `"name":"${randomName()}","score":${(Math.random() * 100).toFixed(2)},` +
      `"active":${Math.random() > 0.5}}`
    const recordBytes = encoder.encode(record).length

    // Reserve two bytes for the closing bracket. JSON must never be sliced mid-record.
    if (writtenBytes + recordBytes + 2 > targetBytes) break

    batch += record
    writtenBytes += recordBytes
    firstRecord = false
    chunkIndex++

    if (batch.length >= STREAM_CHUNK_BYTES) {
      parts.push(batch)
      batch = ''
      if (chunkIndex % 64 === 0) await yieldToBrowser()
    }
  }

  if (batch) parts.push(batch)

  const closing = targetBytes - writtenBytes >= 2 ? '\n]' : ']'
  const paddingLength = Math.max(0, targetBytes - writtenBytes - closing.length)
  parts.push(`${' '.repeat(paddingLength)}${closing}`)

  return new Blob(parts, { type: FORMAT_LABELS.json.mime })
}

async function createCsvBlob(targetBytes: number): Promise<Blob> {
  const header = `${CSV_HEADERS.join(',')}\n`
  const parts: string[] = [header]
  let writtenBytes = encoder.encode(header).length
  let rowIndex = 1
  let batch = ''
  let chunkIndex = 0

  while (writtenBytes < targetBytes) {
    const row = `${rowIndex},${randomName()},${randomString(8)}@test.com,${(Math.random() * 100).toFixed(0)},${new Date().toISOString()},${STATUSES[rowIndex % STATUSES.length]}\n`
    const rowBytes = encoder.encode(row).length

    if (writtenBytes + rowBytes > targetBytes) break

    batch += row
    writtenBytes += rowBytes
    rowIndex++
    chunkIndex++

    if (batch.length >= STREAM_CHUNK_BYTES) {
      parts.push(batch)
      batch = ''
      if (chunkIndex % 64 === 0) await yieldToBrowser()
    }
  }

  if (batch) parts.push(batch)

  if (writtenBytes < targetBytes) {
    parts.push('\n'.repeat(targetBytes - writtenBytes))
  }

  return new Blob(parts, { type: FORMAT_LABELS.csv.mime })
}

function generateFileBlob(format: FileFormat, targetBytes: number): Promise<Blob> {
  switch (format) {
    case 'txt':
      return createTextBlob(targetBytes)
    case 'json':
      return createJsonBlob(targetBytes)
    case 'csv':
      return createCsvBlob(targetBytes)
    case 'binary':
      return createBinaryBlob(targetBytes)
    case 'base64':
      return createBase64Blob(targetBytes)
  }
}

export default function FileGenerator(): React.JSX.Element {
  const [size, setSize] = useState(1)
  const [unit, setUnit] = useState<SizeUnit>('MB')
  const [format, setFormat] = useState<FileFormat>('txt')
  const [generating, setGenerating] = useState(false)

  const totalBytes = useMemo(() => Math.max(1, Math.floor(size)) * UNIT_BYTES[unit], [size, unit])

  const sizeLabel = useMemo(() => {
    const bytes = totalBytes
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }, [totalBytes])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 50))

    try {
      const blob = await generateFileBlob(format, totalBytes)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `test-file-${size}${unit.toLowerCase()}${FORMAT_LABELS[format].ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
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

        <div className="fg-section">
          <span className="fg-section-label">文件大小</span>
          <div className="fg-size-row">
            <input
              type="number"
              className="fg-size-input"
              value={size}
              min={1}
              max={unit === 'GB' ? 10 : 1024}
              onChange={(e) => setSize(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
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