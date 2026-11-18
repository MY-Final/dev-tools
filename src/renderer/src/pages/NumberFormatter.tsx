import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'
import '../styles/number-formatter.css'

type Style =
  | 'decimal'
  | 'currency'
  | 'percent'
  | 'scientific'
  | 'engineering'
  | 'hex'
  | 'octal'
  | 'binary'

interface ResultItem {
  id: Style
  label: string
  value: string
}

function parseNumericInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** 用 BigInt 做进制转换：避免 >>> 0 把负数和超过 2^32 的值静默截断。 */
function formatIntegerBase(n: number, radix: 2 | 8 | 16): string {
  return BigInt(Math.round(n)).toString(radix).toUpperCase()
}

function formatNumber(
  n: number,
  style: Style,
  locale: string,
  currency: string,
  rawFractionDigits: number
): string {
  // Intl 只接受 0–20；输入框被键入 -1 时曾直接抛 RangeError 让整页进入错误边界。
  const fractionDigits = Math.min(20, Math.max(0, Math.trunc(rawFractionDigits) || 0))
  switch (style) {
    case 'decimal':
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
      }).format(n)
    case 'currency':
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)
      } catch {
        return `${currency} ${n.toFixed(2)}`
      }
    case 'percent':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
      }).format(n / 100)
    case 'scientific':
      return n.toExponential(fractionDigits)
    case 'engineering': {
      if (n === 0) return '0'
      const negative = n < 0
      const abs = Math.abs(n)
      const exp = Math.floor(Math.log10(abs))
      const engExp = Math.floor(exp / 3) * 3
      const mantissa = abs / Math.pow(10, engExp)
      const sign = negative ? '-' : ''
      const suffixes: Record<string, string> = {
        '-24': 'y',
        '-21': 'z',
        '-18': 'a',
        '-15': 'f',
        '-12': 'p',
        '-9': 'n',
        '-6': 'µ',
        '-3': 'm',
        '0': '',
        '3': 'k',
        '6': 'M',
        '9': 'G',
        '12': 'T',
        '15': 'P',
        '18': 'E',
        '21': 'Z',
        '24': 'Y'
      }
      const suffix = suffixes[engExp.toString()] || `e${engExp}`
      return `${sign}${mantissa.toFixed(fractionDigits)} ${suffix}`
    }
    case 'hex':
      return formatIntegerBase(n, 16)
    case 'octal':
      return formatIntegerBase(n, 8)
    case 'binary':
      return formatIntegerBase(n, 2)
    default:
      return n.toString()
  }
}

const ALL_STYLES: { id: Style; label: string }[] = [
  { id: 'decimal', label: '十进制 (千分位)' },
  { id: 'currency', label: '货币' },
  { id: 'percent', label: '百分比' },
  { id: 'scientific', label: '科学计数' },
  { id: 'engineering', label: '工程计数' },
  { id: 'hex', label: '十六进制' },
  { id: 'octal', label: '八进制' },
  { id: 'binary', label: '二进制' }
]

const LOCALES = [
  { id: 'zh-CN', label: '中文 (zh-CN)' },
  { id: 'en-US', label: '英语 (en-US)' },
  { id: 'de-DE', label: '德语 (de-DE)' },
  { id: 'ja-JP', label: '日语 (ja-JP)' },
  { id: 'fr-FR', label: '法语 (fr-FR)' },
  { id: 'ko-KR', label: '韩语 (ko-KR)' }
]
const CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'GBP', 'KRW']

export default function NumberFormatter(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [locale, setLocale] = useState('zh-CN')
  const [currency, setCurrency] = useState('CNY')
  const [fractionDigits, setFractionDigits] = useState(2)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const n = parseNumericInput(input)
  const hasInput = n !== null

  const results: ResultItem[] = hasInput
    ? ALL_STYLES.map((s) => ({
        id: s.id,
        label: s.label,
        value: formatNumber(n, s.id, locale, currency, fractionDigits)
      }))
    : []

  const copyResult = useCallback(async (id: string, value: string) => {
    if (value === '—') return
    if (!(await copyText(value))) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  return (
    <div className="nfm-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Number Formatter</h2>
          <p className="tool-page-desc">
            按地区与精度输出千分位、货币、百分比、科学计数等常见格式。
          </p>
        </div>
      </header>

      <section className="tool-panel nfm-input-panel">
        <div className="nfm-input-row">
          <input
            className="tool-input tool-input--lg tool-input--mono nfm-input"
            aria-label="输入数字"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入数字"
          />
        </div>

        <div className="nfm-options">
          <label className="nfm-option">
            <span className="nfm-option-label">地区</span>
            <select
              className="tool-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="nfm-option">
            <span className="nfm-option-label">货币</span>
            <select
              className="tool-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="nfm-option">
            <span className="nfm-option-label">小数位</span>
            <input
              className="tool-input nfm-digits"
              type="number"
              min={0}
              max={20}
              step={1}
              value={fractionDigits}
              onChange={(e) => {
                const next = Math.trunc(Number(e.target.value))
                setFractionDigits(Number.isFinite(next) ? Math.min(20, Math.max(0, next)) : 0)
              }}
            />
          </label>
        </div>

        {input && !hasInput && (
          <div className="nfm-error" role="alert">
            请输入有效数字，支持小数与科学计数法（如 1234.5、-2e3）
          </div>
        )}
      </section>

      {hasInput && (
        <section className="tool-panel nfm-results">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">格式化结果</h3>
          </div>
          <div className="nfm-result-grid">
            {results.map((r) => (
              <div key={r.id} className="nfm-result-item">
                <div className="nfm-result-header">
                  <span className="nfm-result-label">{r.label}</span>
                  <button
                    type="button"
                    className="tool-icon-btn"
                    onClick={() => copyResult(r.id, r.value)}
                    title={`复制 ${r.label}`}
                    aria-label={`复制 ${r.label}`}
                  >
                    {copiedId === r.id ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div className="nfm-result-value" title={r.value}>
                  {r.value}
                </div>
              </div>
            ))}
          </div>
          <p className="nfm-note">
            十六 / 八 / 二进制会先四舍五入为整数；负值与超大整数按实际数值展示，不做 32
            位补码截断。
          </p>
        </section>
      )}
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
