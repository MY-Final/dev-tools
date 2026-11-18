import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'
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

function toIsoTime(ms: number): string | null {
  if (!Number.isFinite(ms)) return null
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** 60-bit 100ns intervals since 1582-10-15 → ISO time. */
function gregorianTimestamp(timeHex: string): string | null {
  const ticks = BigInt('0x' + timeHex) - 122192928000000000n
  return toIsoTime(Number(ticks / 10000n))
}

function parseUUID(input: string): UUIDInfo | null {
  // Clean input
  const raw = input.trim()
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

  // Timestamp: v1 stores a Gregorian 60-bit clock, v6 reorders the same clock,
  // v7 stores Unix milliseconds in the first 48 bits.
  let timestamp: string | null = null
  if (version === 1) {
    const timeHex = `${timeHighAndVersion.substring(1)}${timeMid}${timeLow}`
    timestamp = gregorianTimestamp(timeHex)
  } else if (version === 6) {
    timestamp = gregorianTimestamp(hex.substring(0, 12) + hex.substring(13, 16))
  } else if (version === 7) {
    timestamp = toIsoTime(Number(BigInt('0x' + hex.substring(0, 12))))
  }

  const clockSequence = variant === 'RFC 4122'
    ? parseInt(hex.substring(16, 20), 16) & 0x3FFF
    : null

  const firstNodeByte = parseInt(node.substring(0, 2), 16)
  const isUnicastNode = (firstNodeByte & 0x01) === 0
  const nodeMac =
    (version === 1 || version === 2) && variant === 'RFC 4122' && isUnicastNode
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

function BitRow({
  label,
  value,
  version
}: {
  label: string
  value: string
  version?: number
}): React.JSX.Element {
  return (
    <div className="ud-bit-row">
      <span className="ud-bit-label">{label}</span>
      <code className="ud-bit-value">
        {value}
        {version !== undefined && <span className="ud-bit-version">v{version}</span>}
      </code>
    </div>
  )
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
  '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  '1e0b3a2e-9e0b-6d1a-8000-000000000000',
  '01920000-7d2a-7c3b-9a1e-2b3c4d5e6f70'
]

export default function UUIDDecoder(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const info = useMemo(() => parseUUID(input), [input])

  const formattedUUID = info
    ? `${info.hex.substring(0, 8)}-${info.hex.substring(8, 12)}-${info.hex.substring(12, 16)}-${info.hex.substring(16, 20)}-${info.hex.substring(20, 32)}`
    : null

  const copy = useCallback(async (key: string, text: string) => {
    if (!(await copyText(text))) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
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
                <button
                  key={s}
                  className="ud-sample-btn"
                  onClick={() => setInput(s)}
                  title={s}
                >
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

            {/* Timestamp (v1 / v6 / v7) */}
            {info.timestamp && (
              <div className="ud-section">
                <h4 className="ud-section-title">时间戳 (v{info.version})</h4>
                <div className="ud-row"><span className="ud-row-label">UTC</span><code className="ud-row-value">{info.timestamp}</code></div>
              </div>
            )}

            {/* MAC (v1) */}
            {info.nodeMac && (
              <div className="ud-section">
                <h4 className="ud-section-title">MAC 地址 (v{info.version})</h4>
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
                {info.version === 7 ? (
                  <>
                    <BitRow label="unix_ts_ms" value={info.hex.substring(0, 12)} />
                    <BitRow label="ver + rand_a" value={info.hex.substring(12, 16)} version={7} />
                    <BitRow label="var + rand_b" value={info.hex.substring(16, 32)} />
                  </>
                ) : info.version === 6 ? (
                  <>
                    <BitRow label="time_high" value={info.hex.substring(0, 12)} />
                    <BitRow label="ver + time_low" value={info.hex.substring(12, 16)} version={6} />
                    <BitRow
                      label="clk_seq_hi_res"
                      value={info.clockSeqAndVariant.substring(0, 2)}
                    />
                    <BitRow label="clk_seq_low" value={info.clockSeqAndVariant.substring(2, 4)} />
                    <BitRow label="node" value={info.node} />
                  </>
                ) : (
                  <>
                    <BitRow label="time_low" value={info.timeLow} />
                    <BitRow label="time_mid" value={info.timeMid} />
                    <BitRow
                      label="time_hi_and_version"
                      value={info.timeHighAndVersion}
                      version={info.version}
                    />
                    <BitRow
                      label="clk_seq_hi_res"
                      value={info.clockSeqAndVariant.substring(0, 2)}
                    />
                    <BitRow label="clk_seq_low" value={info.clockSeqAndVariant.substring(2, 4)} />
                    <BitRow label="node" value={info.node} />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
