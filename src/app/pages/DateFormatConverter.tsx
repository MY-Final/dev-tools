import { useState, useCallback, useEffect } from 'react'
import { Copy, Check, Clock } from 'lucide-react'
import '../styles/date-format-converter.css'

type Format =
  | 'ISO 8601'
  | 'Unix (秒)'
  | 'Unix (毫秒)'
  | 'RFC 2822'
  | 'UTC String'
  | 'Locale (zh-CN)'
  | 'Locale (en-US)'
  | 'YYYY-MM-DD'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'Custom'

interface FormatDef {
  id: Format
  label: string
  format: (d: Date) => string
}

const FORMATS: FormatDef[] = [
  { id: 'ISO 8601', label: 'ISO 8601', format: (d) => d.toISOString() },
  { id: 'Unix (秒)', label: 'Unix 时间戳 (秒)', format: (d) => Math.floor(d.getTime() / 1000).toString() },
  { id: 'Unix (毫秒)', label: 'Unix 时间戳 (毫秒)', format: (d) => d.getTime().toString() },
  { id: 'RFC 2822', label: 'RFC 2822', format: (d) => d.toUTCString() },
  { id: 'UTC String', label: 'UTC String', format: (d) => d.toUTCString() },
  { id: 'Locale (zh-CN)', label: 'Locale (zh-CN)', format: (d) => d.toLocaleString('zh-CN') },
  { id: 'Locale (en-US)', label: 'Locale (en-US)', format: (d) => d.toLocaleString('en-US') },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', format: (d) => `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}` },
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', format: (d) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}` },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', format: (d) => `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}` }
]


function parseInput(input: string): Date | null {
  const s = input.trim()
  if (!s) return null
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s)
  // Try Unix timestamp (seconds)
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s) * 1000)
  // Try Unix timestamp (milliseconds)
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s))
  // Try local date
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return null
}

export default function DateFormatConverter(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<Date | null>(null)
  const [now, setNow] = useState(new Date())
  const [copied, setCopied] = useState<string | null>(null)
  const [customFmt, setCustomFmt] = useState('yyyy-MM-dd HH:mm:ss')

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleInput = useCallback((value: string) => {
    setInput(value)
    if (!value.trim()) { setParsed(null); return }
    const d = parseInput(value)
    setParsed(d)
  }, [])

  const useNow = useCallback(() => {
    setInput('')
    setParsed(now)
  }, [now])

  const customFormat = useCallback((d: Date): string => {
    try {
      const pad = (n: number, len = 2) => n.toString().padStart(len, '0')
      return customFmt
        .replace(/yyyy/g, d.getFullYear().toString())
        .replace(/yy/g, d.getFullYear().toString().slice(-2))
        .replace(/MM/g, pad(d.getMonth() + 1))
        .replace(/dd/g, pad(d.getDate()))
        .replace(/HH/g, pad(d.getHours()))
        .replace(/mm/g, pad(d.getMinutes()))
        .replace(/ss/g, pad(d.getSeconds()))
        .replace(/SSS/g, pad(d.getMilliseconds(), 3))
    } catch { return '格式错误' }
  }, [customFmt])

  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500) } catch { /* ignore */ }
  }, [])

  const displayDate = parsed || now

  return (
    <div className="dfc-page">
      <div className="dfc-card">
        <div className="dfc-header">
          <h2 className="dfc-title">Date Format Converter</h2>
          <p className="dfc-subtitle">日期格式互转（ISO/Unix/RFC/自定义）</p>
        </div>

        <div className="dfc-input-area">
          <div className="dfc-input-header">
            <span className="dfc-input-label">输入日期</span>
            <button className="dfc-now-btn" onClick={useNow}>
              <Clock size={13} /> 当前时间
            </button>
          </div>
          <input
            className="dfc-input"
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={`不输入则显示当前时间: ${now.toLocaleString('zh-CN')}`}
          />
          {input && !parsed && <div className="dfc-error">无法解析该日期格式</div>}
        </div>

        <div className="dfc-formats">
          {FORMATS.map((f) => (
            <div key={f.id} className="dfc-format-item">
              <div className="dfc-format-label">{f.label}</div>
              <div className="dfc-format-value">{f.format(displayDate)}</div>
              <button className="dfc-format-copy" onClick={() => copy(f.format(displayDate), f.id)}>
                {copied === f.id ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          ))}

          <div className="dfc-format-item dfc-custom">
            <div className="dfc-format-label">自定义格式</div>
            <input
              className="dfc-custom-fmt"
              value={customFmt}
              onChange={(e) => setCustomFmt(e.target.value)}
              placeholder="yyyy-MM-dd HH:mm:ss"
            />
            <div className="dfc-format-value">{customFormat(displayDate)}</div>
            <button className="dfc-format-copy" onClick={() => copy(customFormat(displayDate), 'custom')}>
              {copied === 'custom' ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        <div className="dfc-help">
          <span>格式参考: </span>
          <code>yyyy</code> 年 <code>MM</code> 月 <code>dd</code> 日 <code>HH</code> 时 <code>mm</code> 分 <code>ss</code> 秒 <code>SSS</code> 毫秒
        </div>
      </div>
    </div>
  )
}
