import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, ArrowLeftRight, Globe } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'

const OCTET_RE = /^\d{1,3}$/

function ipToNumber(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    // 整段校验：parseInt 会把 "1x"、"1e2" 静默解析成 1。
    if (!OCTET_RE.test(part)) return null
    const num = Number(part)
    if (num > 255) return null
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

  let num: number | null = null
  if (cleaned.includes('.')) {
    num = ipToNumber(cleaned)
  } else {
    const hexMatch = cleaned.match(/^0x([0-9a-f]{1,8})$/i)
    if (hexMatch) {
      num = parseInt(hexMatch[1], 16) >>> 0
    } else if (/^\d{1,10}$/.test(cleaned)) {
      const decimal = Number(cleaned)
      if (decimal <= 4294967295) num = decimal
    }
  }

  if (num === null) return null

  return {
    ip: numberToIp(num),
    decimal: num,
    hex: formatHex(num),
    binary: formatBinary(num),
    octal: formatOctal(num),
    integer: num
  }
}

interface OutputRow {
  label: string
  value: string
  key: string
}

export default function IPv4Converter(): React.JSX.Element {
  const [input, setInput] = useState('192.168.1.1')
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

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
    if (!(await copyText(value))) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const loadSample = useCallback((ip: string) => {
    setInput(ip)
  }, [])

  const trimmedInput = input.trim()
  // 只有转换成功时才提示识别到的输入格式，避免越界值时给出误导。
  const detectedFormat = !result
    ? null
    : /^0x[0-9a-f]{1,8}$/i.test(trimmedInput)
      ? 'hex'
      : /^\d{1,10}$/.test(trimmedInput) && Number(trimmedInput) > 255
        ? 'decimal'
        : null

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
            placeholder="例如 192.168.1.1、3232235777 或 0xC0A80101"
            spellCheck={false}
          />
          {detectedFormat && (
            <p className="v4c-hint">
              <ArrowLeftRight size={13} aria-hidden="true" />
              {detectedFormat === 'hex'
                ? '检测到十六进制整数，将自动转换为 IPv4 地址'
                : '检测到十进制整数，将自动转换为 IPv4 地址'}
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
          <span>输入有效的 IPv4 地址、0–4294967295 的整数或 0x 开头的十六进制</span>
        </section>
      )}
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
