import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/number-base.css'

type BitWidth = 8 | 16 | 32

interface ConversionResult {
  label: string
  value: string
  prefix: string
}

// ── Utils ──────────────────────────────────────────────────────

function toOctal(n: bigint): string {
  if (n < 0n) return '-' + (-n).toString(8)
  return n.toString(8)
}

function toDecimal(n: bigint): string {
  return n.toString(10)
}

function toHex(n: bigint, width?: number): string {
  if (n < 0n) {
    const mask = width ? (1n << BigInt(width)) - 1n : undefined
    if (mask !== undefined) return '0x' + (n & mask).toString(16).toUpperCase().padStart(width! / 4, '0')
    return '-0x' + (-n).toString(16).toUpperCase()
  }
  return '0x' + n.toString(16).toUpperCase()
}

function formatBinary(n: bigint, width: BitWidth): string {
  if (n < 0n) {
    const mask = (1n << BigInt(width)) - 1n
    const twosComp = n & mask
    const bits = twosComp.toString(2).padStart(width, '0')
    // Group by 4
    return bits.replace(/(.{4})/g, '$1 ').trim()
  }
  const bits = n.toString(2).padStart(width, '0')
  return bits.replace(/(.{4})/g, '$1 ').trim()
}

function onesComplement(n: bigint, width: BitWidth): bigint {
  // Bitwise NOT
  if (n < 0n) {
    const mask = (1n << BigInt(width)) - 1n
    return (~(n & mask)) & mask
  }
  const mask = (1n << BigInt(width)) - 1n
  return (~n) & mask
}

function twosComplement(n: bigint, width: BitWidth): bigint {
  if (n < 0n) {
    // The two's complement of a negative is its positive counterpart
    const mask = (1n << BigInt(width)) - 1n
    return (n & mask)
  }
  // Positive number → its two's complement (negation)
  const mask = (1n << BigInt(width)) - 1n
  return ((-n) & mask)
}

// ── Parse input ────────────────────────────────────────────────

function parseInput(input: string): { value: bigint; error: string | null } {
  const trimmed = input.trim()
  if (!trimmed) return { value: 0n, error: null }

  try {
    // Hex: 0x prefix or bare hex with A-F
    if (/^0x/i.test(trimmed)) {
      return { value: BigInt(trimmed), error: null }
    }
    // Binary: 0b prefix
    if (/^0b/i.test(trimmed)) {
      return { value: BigInt(trimmed), error: null }
    }
    // Octal: 0o prefix
    if (/^0o/i.test(trimmed)) {
      return { value: BigInt(trimmed), error: null }
    }
    // Decimal (possibly negative)
    if (/^-?\d+$/.test(trimmed)) {
      return { value: BigInt(trimmed), error: null }
    }
    // Try as bare hex (contains A-F)
    if (/^[0-9a-fA-F]+$/.test(trimmed) && /[a-fA-F]/.test(trimmed)) {
      return { value: BigInt('0x' + trimmed), error: null }
    }
    return { value: 0n, error: '无法识别格式' }
  } catch {
    return { value: 0n, error: '无效数字' }
  }
}

// ── Component ──────────────────────────────────────────────────

const BIT_WIDTHS: BitWidth[] = [8, 16, 32]

const SAMPLES = ['42', '-1', '0xFF', '0b1010', '255', '-128']

export default function NumberBase(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [bitWidth, setBitWidth] = useState<BitWidth>(16)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const { value, error } = useMemo(() => parseInput(input), [input])

  const results: ConversionResult[] = useMemo(() => {
    if (!input.trim() || error) return []
    return [
      { label: 'HEX', value: toHex(value, bitWidth), prefix: '十六进制' },
      { label: 'DEC', value: toDecimal(value), prefix: '十进制' },
      { label: 'OCT', value: toOctal(value), prefix: '八进制' },
      { label: 'BIN', value: formatBinary(value, bitWidth), prefix: `${bitWidth}-bit 二进制` }
    ]
  }, [value, error, input, bitWidth])

  const onesComp = useMemo(() => {
    if (!input.trim() || error) return null
    const oc = onesComplement(value, bitWidth)
    return {
      bin: formatBinary(oc, bitWidth),
      dec: toDecimal(oc),
      hex: toHex(oc, bitWidth)
    }
  }, [value, error, input, bitWidth])

  const twosComp = useMemo(() => {
    if (!input.trim() || error) return null
    const tc = twosComplement(value, bitWidth)
    return {
      bin: formatBinary(tc, bitWidth),
      dec: toDecimal(tc),
      hex: toHex(tc, bitWidth)
    }
  }, [value, error, input, bitWidth])

  const clear = useCallback(() => setInput(''), [])
  const loadSample = useCallback((s: string) => setInput(s), [])

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\s/g, ''))
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="nb-page">
      <div className="nb-card">
        <div className="nb-header">
          <h2 className="nb-title">Number Base Converter</h2>
          <p className="nb-subtitle">进制转换 · 反码 · 补码</p>
        </div>

        {/* Input */}
        <div className="nb-input-area">
          <div className="nb-input-header">
            <span className="nb-input-label">输入数字</span>
            <div className="nb-samples">
              {SAMPLES.map((s) => (
                <button key={s} className="nb-sample-btn" onClick={() => loadSample(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <input
            className="nb-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入数字，支持 0x / 0b / 0o 前缀..."
            autoFocus
          />
          {error && <div className="nb-error">{error}</div>}
        </div>

        {/* Bit width selector */}
        <div className="nb-bit-width">
          <span className="nb-bit-label">位宽</span>
          <div className="nb-segmented">
            {BIT_WIDTHS.map((w) => (
              <button
                key={w}
                className={`nb-seg-option ${bitWidth === w ? 'active' : ''}`}
                onClick={() => setBitWidth(w)}
              >
                {w}-bit
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="nb-actions">
          <button className="nb-btn nb-btn-ghost" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {/* Results — base conversions */}
        {results.length > 0 && (
          <div className="nb-results">
            <h4 className="nb-section-label">进制转换</h4>
            {results.map((r) => (
              <div key={r.label} className="nb-result-row">
                <div className="nb-result-header">
                  <span className="nb-result-badge">{r.label}</span>
                  <span className="nb-result-prefix">{r.prefix}</span>
                </div>
                <code className="nb-result-value">{r.value}</code>
                <button
                  className="nb-icon-btn"
                  title="复制"
                  onClick={() => copyToClipboard(r.label, r.value.replace(/\s/g, ''))}
                >
                  {copiedKey === r.label ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Complement */}
        {onesComp && twosComp && (
          <div className="nb-complements">
            <h4 className="nb-section-label">反码与补码</h4>

            <div className="nb-comp-card">
              <div className="nb-comp-header">
                <span className="nb-comp-badge nb-comp-badge-ones">反码</span>
                <span className="nb-comp-desc">按位取反（Bitwise NOT）</span>
              </div>
              <div className="nb-comp-row">
                <code className="nb-comp-value">{onesComp.bin}</code>
                <button
                  className="nb-icon-btn"
                  title="复制"
                  onClick={() => copyToClipboard('ones', onesComp.bin.replace(/\s/g, ''))}
                >
                  {copiedKey === 'ones' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="nb-comp-extra">
                <span>{onesComp.hex}</span>
                <span className="nb-comp-sep">·</span>
                <span>{onesComp.dec}</span>
              </div>
            </div>

            <div className="nb-comp-card">
              <div className="nb-comp-header">
                <span className="nb-comp-badge nb-comp-badge-twos">补码</span>
                <span className="nb-comp-desc">反码 + 1（Two&apos;s Complement）</span>
              </div>
              <div className="nb-comp-row">
                <code className="nb-comp-value">{twosComp.bin}</code>
                <button
                  className="nb-icon-btn"
                  title="复制"
                  onClick={() => copyToClipboard('twos', twosComp.bin.replace(/\s/g, ''))}
                >
                  {copiedKey === 'twos' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="nb-comp-extra">
                <span>{twosComp.hex}</span>
                <span className="nb-comp-sep">·</span>
                <span>{twosComp.dec}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
