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
      { label: 'Octal', value: result.octal, key: 'octal' },
      { label: 'Integer', value: result.integer.toString(), key: 'integer' }
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
    <div className="v4c-page">
      <div className="v4c-card">
        <div className="v4c-header">
          <h2 className="v4c-title">IPv4 Converter</h2>
          <p className="v4c-subtitle">IPv4 地址与数字格式互相转换</p>
        </div>

        <div className="v4c-input-area">
          <div className="v4c-input-header">
            <span className="v4c-input-label">输入</span>
            <div className="v4c-samples">
              <button className="v4c-sample-btn" onClick={() => loadSample('8.8.8.8')}>
                8.8.8.8
              </button>
              <button className="v4c-sample-btn" onClick={() => loadSample('127.0.0.1')}>
                127.0.0.1
              </button>
              <button className="v4c-sample-btn" onClick={() => loadSample('192.168.1.1')}>
                192.168.1.1
              </button>
            </div>
          </div>
          <input
            type="text"
            className="v4c-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="IPv4 地址或十进制数字"
          />
          {isLikelyDecimal && (
            <div className="v4c-hint">
              <ArrowLeftRight size={13} />
              <span>检测到十进制数字，将自动转换为 IPv4 地址</span>
            </div>
          )}
        </div>

        {result ? (
          <div className="v4c-outputs">
            <span className="v4c-section-label">转换结果</span>
            {outputs.map(({ label, value, key }) => (
              <div key={key} className="v4c-output-row">
                <span className="v4c-output-label">{label}</span>
                <div className="v4c-output-value-row">
                  <code className="v4c-output-value">{value}</code>
                  <button className="v4c-copy-btn" onClick={() => copyValue(value, key)}>
                    {copied === key ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="v4c-empty">
            <Globe size={32} />
            <span>输入有效的 IPv4 地址或十进制数字</span>
          </div>
        )}
      </div>
    </div>
  )
}
