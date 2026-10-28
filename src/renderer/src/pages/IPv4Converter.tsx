import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, ArrowLeftRight, Globe } from 'lucide-react'

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 0 || num > 255) return null
    result = (result << 8) | num
  }
  return result >>> 0
}

function numberToIp(num: number): string {
  return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.')
}

function formatBinary(num: number): string {
  const binary = num.toString(2).padStart(32, '0')
  return `${binary.slice(0, 8)}.${binary.slice(8, 16)}.${binary.slice(16, 24)}.${binary.slice(24, 32)}`
}

function formatOctal(num: number): string {
  return [
    ((num >>> 24) & 0xff).toString(8).padStart(3, '0'),
    ((num >>> 16) & 0xff).toString(8).padStart(3, '0'),
    ((num >>> 8) & 0xff).toString(8).padStart(3, '0'),
    (num & 0xff).toString(8).padStart(3, '0')
  ].join('.')
}

function formatHex(num: number): string {
  return num.toString(16).toUpperCase().padStart(8, '0')
}

interface ConvertResult {
  ip: string
  decimal: number
  hex: string
  binary: string
  octal: string
  integer: number
}

function convert(input: string): ConvertResult | null {
  const cleaned = input.trim()
  if (!cleaned) return null

  const dotParts = cleaned.split('.')
  if (dotParts.length === 4) {
    const num = ipToNumber(cleaned)
    if (num !== null) {
      return {
        ip: cleaned,
        decimal: num,
        hex: formatHex(num),
        binary: formatBinary(num),
        octal: formatOctal(num),
        integer: num
      }
    }
  }

  const num = parseInt(cleaned, 10)
  if (!isNaN(num) && num >= 0 && num <= 4294967295) {
    const ip = numberToIp(num)
    return {
      ip,
      decimal: num,
      hex: formatHex(num),
      binary: formatBinary(num),
      octal: formatOctal(num),
      integer: num
    }
  }

  return null
}

interface OutputRow {
  label: string
  value: string
  key: string
}

export default function IPv4Converter(): React.JSX.Element {
  const [input, setInput] = useState('192.168.1.1')
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => convert(input), [input])

  const outputs: OutputRow[] = useMemo(() => {
    if (!result) return []
    return [
      { label: 'IPv4 Address', value: result.ip, key: 'ip' },
      { label: 'Decimal', value: result.decimal.toString(), key: 'decimal' },
      { label: 'Hexadecimal', value: '0x' + result.hex, key: 'hex' },
      { label: 'Binary', value: result.decimal.toString(2).padStart(32, '0'), key: 'binary-full' },
      { label: 'Binary (Grouped)', value: result.binary, key: 'binary-grouped' },
      { label: 'Octal', value: result.octal, key: 'octal' }
    ]
  }, [result])

  const copyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const loadSample = useCallback((ip: string) => {
    setInput(ip)
  }, [])

  const isLikelyDecimal = /^\d{1,10}$/.test(input.trim()) && parseInt(input.trim()) > 255

  return (
    <div className="v4c-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">IPv4 Converter</h2>
          <p className="tool-page-desc">
            IPv4 地址与十进制、十六进制、八进制及二进制形式互相转换。
          </p>
        </div>
      </header>

      <section className="tool-panel v4c-input-panel">
        <div className="v4c-input-body">
          <div className="v4c-input-head">
            <label className="v4c-input-label" htmlFor="v4c-input">
              IPv4 地址或十进制整数
            </label>
            <div className="v4c-samples">
              {['8.8.8.8', '127.0.0.1', '192.168.1.1'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className="v4c-sample-btn"
                  onClick={() => loadSample(sample)}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
          <input
            id="v4c-input"
            type="text"
            className="tool-input tool-input--mono tool-input--lg"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如 192.168.1.1 或 3232235777"
            spellCheck={false}
          />
          {isLikelyDecimal && (
            <p className="v4c-hint">
              <ArrowLeftRight size={13} aria-hidden="true" />
              检测到十进制整数，将自动转换为 IPv4 地址
            </p>
          )}
        </div>
      </section>

      {result ? (
        <section className="tool-panel v4c-outputs-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">转换结果</h3>
            <span className="v4c-output-count">{outputs.length} 种格式</span>
          </div>
          <div className="v4c-outputs">
            {outputs.map(({ label, value, key }) => (
              <div key={key} className="v4c-output-row">
                <span className="v4c-output-label">{label}</span>
                <code className="v4c-output-value" title={value}>
                  {value}
                </code>
                <button
                  type="button"
                  className="tool-icon-btn v4c-copy-btn"
                  onClick={() => copyValue(value, key)}
                  aria-label={`复制 ${label}`}
                  title={`复制 ${label}`}
                >
                  {copied === key ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <Copy size={12} aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="tool-panel v4c-empty">
          <Globe size={26} aria-hidden="true" />
          <span>输入有效的 IPv4 地址或 0–4294967295 之间的整数</span>
        </section>
      )}
    </div>
  )
}
