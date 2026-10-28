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
    if (mask !== undefined)
      return (
        '0x' +
        (n & mask)
          .toString(16)
          .toUpperCase()
          .padStart(width! / 4, '0')
      )
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
    return ~(n & mask) & mask
  }
  const mask = (1n << BigInt(width)) - 1n
  return ~n & mask
}

function twosComplement(n: bigint, width: BitWidth): bigint {
  if (n < 0n) {
    // The two's complement of a negative is its positive counterpart
    const mask = (1n << BigInt(width)) - 1n
    return n & mask
  }
  // Positive number → its two's complement (negation)
  const mask = (1n << BigInt(width)) - 1n
  return -n & mask
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
    <div className="nb-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Number Base Converter</h2>
          <p className="tool-page-desc">
            同一数值的十六、十、八、二进制对照，并给出指定位宽下的反码与补码。
          </p>
        </div>
      </header>

      <div className="tool-split nb-layout">
        <section className="tool-panel nb-input-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">输入</h3>
          </div>
          <div className="nb-input-body">
            <input
              className="tool-input tool-input--lg tool-input--mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入数字，支持 0x / 0b / 0o 前缀"
              aria-label="输入数字"
              autoFocus
              spellCheck={false}
            />
            {error && <div className="nb-error">{error}</div>}

            <div className="nb-samples">
              <span className="nb-samples-label">示例</span>
              {SAMPLES.map((s) => (
                <button key={s} className="nb-sample-btn" onClick={() => loadSample(s)}>
                  {s}
                </button>
              ))}
            </div>

            <div className="nb-options">
              <span className="nb-option-label">位宽</span>
              <div className="tool-segmented">
                {BIT_WIDTHS.map((w) => (
                  <button
                    key={w}
                    className={`tool-seg ${bitWidth === w ? 'active' : ''}`}
                    aria-pressed={bitWidth === w}
                    onClick={() => setBitWidth(w)}
                  >
                    {w}-bit
                  </button>
                ))}
              </div>
              <button type="button" className="tool-btn nb-clear" onClick={clear} disabled={!input}>
                <RotateCcw size={14} aria-hidden="true" />
                清空
              </button>
            </div>
          </div>
        </section>

        <section className="tool-panel nb-results">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">转换结果</h3>
          </div>

          <div className="tool-rows">
            {results.map((r) => (
              <div key={r.label} className="tool-row">
                <div className="tool-row-meta nb-result-meta">
                  <span className="tool-row-label">{r.label}</span>
                  <span className="tool-row-hint">{r.prefix}</span>
                </div>
                <code className="tool-row-value nb-result-value">{r.value}</code>
                <button
                  type="button"
                  className="tool-icon-btn"
                  title={`复制 ${r.label}`}
                  aria-label={`复制 ${r.label}`}
                  onClick={() => copyToClipboard(r.label, r.value.replace(/\s/g, ''))}
                >
                  {copiedKey === r.label ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
            {!results.length && <div className="nb-empty">输入数字后显示各进制结果</div>}
          </div>

          {onesComp && twosComp && (
            <>
              <div className="nb-section-head">
                <span>反码与补码</span>
                <span className="nb-section-hint">{bitWidth}-bit</span>
              </div>
              <div className="nb-comp-list">
                <div className="nb-comp">
                  <div className="nb-comp-head">
                    <span className="nb-comp-name">反码</span>
                    <span className="nb-comp-desc">按位取反（Bitwise NOT）</span>
                    <button
                      type="button"
                      className="tool-icon-btn"
                      title="复制反码"
                      aria-label="复制反码"
                      onClick={() => copyToClipboard('ones', onesComp.bin.replace(/\s/g, ''))}
                    >
                      {copiedKey === 'ones' ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <code className="nb-comp-bin">{onesComp.bin}</code>
                  <div className="nb-comp-extra">
                    <span>{onesComp.hex}</span>
                    <span>{onesComp.dec}</span>
                  </div>
                </div>

                <div className="nb-comp">
                  <div className="nb-comp-head">
                    <span className="nb-comp-name">补码</span>
                    <span className="nb-comp-desc">反码 + 1（Two&apos;s Complement）</span>
                    <button
                      type="button"
                      className="tool-icon-btn"
                      title="复制补码"
                      aria-label="复制补码"
                      onClick={() => copyToClipboard('twos', twosComp.bin.replace(/\s/g, ''))}
                    >
                      {copiedKey === 'twos' ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <code className="nb-comp-bin">{twosComp.bin}</code>
                  <div className="nb-comp-extra">
                    <span>{twosComp.hex}</span>
                    <span>{twosComp.dec}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
