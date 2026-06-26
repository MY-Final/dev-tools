import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/uuid-decoder.css'

interface UUIDInfo {
  hex: string
  version: number
  variant: string
  timeLow: string
  timeMid: string
  timeHighAndVersion: string
  clockSeqAndVariant: string
  node: string
  timestamp: string | null
  clockSequence: number | null
  nodeMac: string | null
}

function parseUUID(input: string): UUIDInfo | null {
  // Clean input
  let raw = input.trim()
    .replace(/[{}]/g, '')
    .replace(/^urn:uuid:/i, '')
    .replace(/-/g, '')

  if (!/^[0-9a-fA-F]{32}$/.test(raw)) return null

  const hex = raw.toUpperCase()
  const timeLow = hex.substring(0, 8)
  const timeMid = hex.substring(8, 12)
  const timeHighAndVersion = hex.substring(12, 16)
  const clockSeqAndVariant = hex.substring(16, 18)
  const clockSeqLow = hex.substring(18, 20)
  const node = hex.substring(20, 32)

  const version = parseInt(timeHighAndVersion[0], 16)
  const variantBits = parseInt(clockSeqAndVariant, 16)
  let variant = ''
  if ((variantBits & 0x80) === 0x00) variant = 'NCS (0)'
  else if ((variantBits & 0xC0) === 0x80) variant = 'RFC 4122'
  else if ((variantBits & 0xE0) === 0xC0) variant = 'Microsoft (2)'
  else variant = 'Reserved (3)'

  // Timestamp for version 1
  let timestamp: string | null = null
  if (version === 1) {
    const timeHex = `${timeHighAndVersion.substring(1)}${timeMid}${timeLow}`
    // Convert to 100-nanosecond intervals since 1582-10-15
    const timeInt = BigInt('0x' + timeHex)
    const ticks = timeInt - 122192928000000000n
    const ms = Number(ticks / 10000n)
    timestamp = new Date(ms).toISOString()
  }

  const clockSequence = variant === 'RFC 4122'
    ? parseInt(hex.substring(16, 20), 16) & 0x3FFF
    : null

  const nodeMac = /^[0-9a-fA-F]{12}$/.test(node)
    ? node.toLowerCase().replace(/(..)(..)(..)(..)(..)(..)/, '$1:$2:$3:$4:$5:$6')
    : null

  return {
    hex,
    version,
    variant,
    timeLow,
    timeMid,
    timeHighAndVersion,
    clockSeqAndVariant: clockSeqAndVariant + clockSeqLow,
    node,
    timestamp,
    clockSequence,
    nodeMac
  }
}

const VERSION_NAMES: Record<number, string> = {
  0: 'Nil UUID',
  1: 'Time-based (MAC)',
  2: 'DCE Security',
  3: 'Name-based (MD5)',
  4: 'Random',
  5: 'Name-based (SHA-1)',
  6: 'Reordered (Greg)',
  7: 'Unix Epoch',
  8: 'Custom'
}

const SAMPLES = [
  '550e8400-e29b-41d4-a716-446655440000',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  '00000000-0000-0000-0000-000000000000',
  '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
]

export default function UUIDDecoder(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const info = useMemo(() => parseUUID(input), [input])

  const formattedUUID = info
    ? `${info.hex.substring(0, 8)}-${info.hex.substring(8, 12)}-${info.hex.substring(12, 16)}-${info.hex.substring(16, 20)}-${info.hex.substring(20, 32)}`
    : null

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* ignore */ }
  }, [])

  const clear = useCallback(() => setInput(''), [])

  return (
    <div className="ud-page">
      <div className="ud-card">
        <div className="ud-header">
          <h2 className="ud-title">UUID Decoder</h2>
          <p className="ud-subtitle">解析 UUID 版本、变体、时间戳与 MAC 地址</p>
        </div>

        <div className="ud-input-area">
          <div className="ud-input-header">
            <span className="ud-input-label">UUID</span>
            <div className="ud-samples">
              {SAMPLES.map((s) => (
                <button key={s} className="ud-sample-btn" onClick={() => setInput(s)}>
                  {s.slice(0, 8)}…
                </button>
              ))}
            </div>
          </div>
          <input
            className="ud-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 UUID，支持 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoFocus
          />
        </div>

        <div className="ud-actions">
          <button className="ud-btn ud-btn-ghost" onClick={clear}><RotateCcw size={13} />清空</button>
        </div>

        {input && !info && (
          <div className="ud-error">无效的 UUID 格式</div>
        )}

        {info && (
          <>
            {/* Formatted UUID */}
            <div className="ud-uuid-display">
              <span className="ud-uuid-version" style={{ color: '#3b82f6' }}>{info.hex.substring(0, 8)}</span>-
              <span className="ud-uuid-version" style={{ color: '#22c55e' }}>{info.hex.substring(8, 12)}</span>-
              <span className="ud-uuid-version" style={{ color: '#a855f7' }}>{info.hex.substring(12, 16)}</span>-
              <span className="ud-uuid-version" style={{ color: '#f97316' }}>{info.hex.substring(16, 20)}</span>-
              <span className="ud-uuid-version" style={{ color: '#ec4899' }}>{info.hex.substring(20, 32)}</span>
              <button className="ud-copy-mini" onClick={() => copy('uuid', formattedUUID!)}>
                {copied === 'uuid' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            {/* Version & Variant summary */}
            <div className="ud-summary-cards">
              <div className="ud-summary-card">
                <span className="ud-summary-label">版本</span>
                <span className="ud-summary-value">{info.version}</span>
                <span className="ud-summary-sub">{VERSION_NAMES[info.version] || 'Unknown'}</span>
              </div>
              <div className="ud-summary-card">
                <span className="ud-summary-label">变体</span>
                <span className="ud-summary-value">{info.variant}</span>
              </div>
              <div className="ud-summary-card">
                <span className="ud-summary-label">时钟序列</span>
                <span className="ud-summary-value">{info.clockSequence !== null ? info.clockSequence : 'N/A'}</span>
              </div>
            </div>

            {/* Timestamp (v1) */}
            {info.timestamp && (
              <div className="ud-section">
                <h4 className="ud-section-title">时间戳 (v1)</h4>
                <div className="ud-row"><span className="ud-row-label">UTC</span><code className="ud-row-value">{info.timestamp}</code></div>
              </div>
            )}

            {/* MAC (v1) */}
            {info.nodeMac && (
              <div className="ud-section">
                <h4 className="ud-section-title">MAC 地址 (v1)</h4>
                <div className="ud-row"><span className="ud-row-label">MAC</span><code className="ud-row-value">{info.nodeMac}</code>
                  <button className="ud-copy-mini" onClick={() => copy('mac', info.nodeMac!)}>
                    {copied === 'mac' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}

            {/* Bit layout */}
            <div className="ud-section">
              <h4 className="ud-section-title">位布局</h4>
              <div className="ud-bit-layout">
                <div className="ud-bit-row">
                  <span className="ud-bit-label">time_low</span>
                  <code className="ud-bit-value">{info.timeLow}</code>
                </div>
                <div className="ud-bit-row">
                  <span className="ud-bit-label">time_mid</span>
                  <code className="ud-bit-value">{info.timeMid}</code>
                </div>
                <div className="ud-bit-row">
                  <span className="ud-bit-label">time_hi_and_version</span>
                  <code className="ud-bit-value">{info.timeHighAndVersion}
                    <span className="ud-bit-version">v{info.version}</span>
                  </code>
                </div>
                <div className="ud-bit-row">
                  <span className="ud-bit-label">clk_seq_hi_res</span>
                  <code className="ud-bit-value">{info.clockSeqAndVariant.substring(0, 2)}</code>
                </div>
                <div className="ud-bit-row">
                  <span className="ud-bit-label">clk_seq_low</span>
                  <code className="ud-bit-value">{info.clockSeqAndVariant.substring(2, 4)}</code>
                </div>
                <div className="ud-bit-row">
                  <span className="ud-bit-label">node</span>
                  <code className="ud-bit-value">{info.node}</code>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
