import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import '../styles/number-formatter.css'

type Style = 'decimal' | 'currency' | 'percent' | 'scientific' | 'engineering' | 'hex' | 'octal' | 'binary'

interface ResultItem {
  id: Style
  label: string
  value: string
}

function formatNumber(value: string, style: Style, locale: string, currency: string, fractionDigits: number): string {
  const n = parseFloat(value)
  if (isNaN(n)) return '—'

  switch (style) {
    case 'decimal':
      return new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(n)
    case 'currency':
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)
      } catch { return `${currency} ${n.toFixed(2)}` }
    case 'percent':
      return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(n / 100)
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
      const suffixes: Record<string, string> = { '-24': 'y', '-21': 'z', '-18': 'a', '-15': 'f', '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '', '3': 'k', '6': 'M', '9': 'G', '12': 'T', '15': 'P', '18': 'E', '21': 'Z', '24': 'Y' }
      const suffix = suffixes[engExp.toString()] || `e${engExp}`
      return `${sign}${mantissa.toFixed(fractionDigits)} ${suffix}`
    }
    case 'hex': {
      const i = Math.round(n)
      return (i >>> 0).toString(16).toUpperCase()
    }
    case 'octal':
      return (Math.round(n) >>> 0).toString(8)
    case 'binary':
      return (Math.round(n) >>> 0).toString(2)
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

  const n = parseFloat(input)
  const hasInput = input.trim() && !isNaN(n)

  const results: ResultItem[] = hasInput
    ? ALL_STYLES.map((s) => ({
        id: s.id,
        label: s.label,
        value: formatNumber(input, s.id, locale, currency, fractionDigits)
      }))
    : []

  const copyResult = useCallback(async (id: string, value: string) => {
    if (value === '—') return
    try { await navigator.clipboard.writeText(value); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) } catch { /* ignore */ }
  }, [])

  return (
    <div className="nfm-page">
      <div className="nfm-card">
        <div className="nfm-header">
          <h2 className="nfm-title">Number Formatter</h2>
          <p className="nfm-subtitle">数字格式化（千分位/货币/百分比/科学计数）</p>
        </div>

        <div className="nfm-input-area">
          <input
            className="nfm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入数字..."
          />
        </div>

        <div className="nfm-options">
          <div className="nfm-option">
            <span className="nfm-option-label">地区</span>
            <select className="nfm-select" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {LOCALES.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
            </select>
          </div>
          <div className="nfm-option">
            <span className="nfm-option-label">货币</span>
            <select className="nfm-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div className="nfm-option">
            <span className="nfm-option-label">小数位</span>
            <input className="nfm-digits" type="number" min={0} max={20} value={fractionDigits} onChange={(e) => setFractionDigits(parseInt(e.target.value) || 0)} />
          </div>
        </div>

        {hasInput && (
          <div className="nfm-results">
            {results.map((r) => (
              <div key={r.id} className="nfm-result-item">
                <div className="nfm-result-header">
                  <span className="nfm-result-label">{r.label}</span>
                  <button className="nfm-copy-btn" onClick={() => copyResult(r.id, r.value)}>
                    {copiedId === r.id ? <Check size={13} /> : <Copy size={13} />}
                    {copiedId === r.id ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="nfm-result-value">{r.value}</div>
              </div>
            ))}
          </div>
        )}

        {input && !hasInput && (
          <div className="nfm-error">请输入有效数字</div>
        )}
      </div>
    </div>
  )
}
