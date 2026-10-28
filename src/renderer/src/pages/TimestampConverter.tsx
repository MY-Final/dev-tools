import { useState, useCallback, useEffect, useMemo } from 'react'
import { Copy, Check, RotateCcw, Clock, Globe, Zap } from 'lucide-react'
import '../styles/timestamp-converter.css'

const TIMEZONES = [
  { id: 'UTC', label: 'UTC' },
  { id: 'Asia/Shanghai', label: 'Shanghai' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Europe/London', label: 'London' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Australia/Sydney', label: 'Sydney' }
]

const QUICK_OFFSETS = [
  { label: '+15分钟', minutes: 15 },
  { label: '+1小时', minutes: 60 },
  { label: '+1天', minutes: 1440 },
  { label: '+7天', minutes: 10080 },
  { label: '+30天', minutes: 43200 }
]

function formatInTimezone(date: Date, tz: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('zh-CN', { ...options, timeZone: tz }).format(date)
}

function parseTimestamp(input: string): { value: number; isMs: boolean } | null {
  const cleaned = input.trim()
  if (!cleaned || !/^\d+$/.test(cleaned)) return null
  const num = Number(cleaned)
  if (cleaned.length <= 10) return { value: num, isMs: false }
  if (cleaned.length <= 13) return { value: num, isMs: true }
  return null
}

function parseDateInput(input: string): Date | null {
  const cleaned = input.trim()
  if (!cleaned) return null
  const date = new Date(cleaned)
  return isNaN(date.getTime()) ? null : date
}

export default function TimestampConverter(): React.JSX.Element {
  const [now, setNow] = useState(new Date())
  const [timestampInput, setTimestampInput] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
    } catch {
      return 'Asia/Shanghai'
    }
  })
  const [copied, setCopied] = useState<string | null>(null)
  const [activeInput, setActiveInput] = useState<'timestamp' | 'date'>('timestamp')

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const currentDate = useMemo(() => {
    if (activeInput === 'timestamp') {
      const parsed = parseTimestamp(timestampInput)
      if (!parsed) return null
      return new Date(parsed.isMs ? parsed.value : parsed.value * 1000)
    }
    return parseDateInput(dateInput)
  }, [timestampInput, dateInput, activeInput])

  const handleTimestampChange = useCallback((value: string) => {
    setTimestampInput(value)
    setActiveInput('timestamp')
    const parsed = parseTimestamp(value)
    if (parsed) {
      const date = new Date(parsed.isMs ? parsed.value : parsed.value * 1000)
      const iso = date.toISOString().slice(0, 19)
      setDateInput(iso)
    }
  }, [])

  const handleDateChange = useCallback((value: string) => {
    setDateInput(value)
    setActiveInput('date')
    const date = parseDateInput(value)
    if (date) {
      setTimestampInput(Math.floor(date.getTime() / 1000).toString())
    }
  }, [])

  const useCurrentTime = useCallback(() => {
    const date = new Date()
    setTimestampInput(Math.floor(date.getTime() / 1000).toString())
    setDateInput(date.toISOString().slice(0, 19))
    setActiveInput('timestamp')
  }, [])

  const clear = useCallback(() => {
    setTimestampInput('')
    setDateInput('')
  }, [])

  const addOffset = useCallback(
    (minutes: number) => {
      const base = currentDate || new Date()
      const future = new Date(base.getTime() + minutes * 60 * 1000)
      setTimestampInput(Math.floor(future.getTime() / 1000).toString())
      setDateInput(future.toISOString().slice(0, 19))
      setActiveInput('timestamp')
    },
    [currentDate]
  )

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const dateOpts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }

  const displayDate = currentDate ?? now
  const resultRows = [
    {
      key: 'unix',
      label: 'Unix Timestamp',
      hint: '秒级',
      value: Math.floor(displayDate.getTime() / 1000).toString()
    },
    {
      key: 'ms',
      label: 'Milliseconds',
      hint: '毫秒级',
      value: displayDate.getTime().toString()
    },
    {
      key: 'local',
      label: '本地时间',
      hint: timezone,
      value: formatInTimezone(displayDate, timezone, dateOpts)
    },
    {
      key: 'iso',
      label: 'ISO 8601',
      hint: 'UTC',
      value: displayDate.toISOString()
    }
  ]

  return (
    <div className="tc-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Timestamp Converter</h2>
          <p className="tool-page-desc">
            Unix 时间戳与日期时间双向转换，支持秒级、毫秒级与多时区对照。
          </p>
        </div>
        <div className="tool-page-actions">
          <label className="tc-tz">
            <Globe size={14} aria-hidden="true" />
            <span className="tc-tz-label">时区</span>
            <select
              className="tool-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label="显示时区"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="tool-btn tool-btn--outline" onClick={useCurrentTime}>
            <Clock size={14} aria-hidden="true" />
            当前时间
          </button>
          <button type="button" className="tool-btn" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <div className="tool-split tc-layout">
        <section className="tool-panel tc-input-panel">
          <div className="tc-now">
            <div className="tc-now-main">
              <span className="tc-now-label">现在</span>
              <span className="tc-now-time">{formatInTimezone(now, timezone, dateOpts)}</span>
            </div>
            <div className="tc-now-copies">
              <button
                type="button"
                className="tc-now-ts"
                onClick={() => copyText(Math.floor(now.getTime() / 1000).toString(), 'now-s')}
                title="复制当前 Unix 时间戳"
              >
                <span className="tc-now-ts-label">Unix</span>
                <span className="tc-now-ts-value">{Math.floor(now.getTime() / 1000)}</span>
                {copied === 'now-s' ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button
                type="button"
                className="tc-now-ts"
                onClick={() => copyText(now.getTime().toString(), 'now-ms')}
                title="复制当前毫秒时间戳"
              >
                <span className="tc-now-ts-label">毫秒</span>
                <span className="tc-now-ts-value">{now.getTime()}</span>
                {copied === 'now-ms' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div className="tc-fields">
            <div className="tc-field">
              <div className="tc-field-head">
                <label htmlFor="tc-timestamp">时间戳</label>
                <span>秒级 / 毫秒级</span>
              </div>
              <input
                id="tc-timestamp"
                type="text"
                className="tool-input tool-input--mono tool-input--lg"
                value={timestampInput}
                onChange={(e) => handleTimestampChange(e.target.value)}
                placeholder="1718784000"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>

            <div className="tc-field">
              <div className="tc-field-head">
                <label htmlFor="tc-date">日期时间</label>
                <span>本地时间</span>
              </div>
              <input
                id="tc-date"
                type="text"
                className="tool-input tool-input--mono tool-input--lg"
                value={dateInput}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="2025-06-19 10:00:00"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="tc-quick">
            <span className="tc-quick-label">
              <Zap size={13} aria-hidden="true" />
              快捷
            </span>
            <div className="tc-quick-buttons">
              {QUICK_OFFSETS.map((offset) => (
                <button
                  key={offset.minutes}
                  type="button"
                  className="tc-quick-btn"
                  onClick={() => addOffset(offset.minutes)}
                >
                  {offset.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="tc-results">
          <section className="tool-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">转换结果</h3>
              {!currentDate && <span className="tc-preview-note">当前时间预览</span>}
            </div>
            <div className="tool-rows">
              {resultRows.map((row) => (
                <div className="tool-row" key={row.key}>
                  <div className="tool-row-meta tc-result-meta">
                    <span className="tool-row-label">{row.label}</span>
                    <span className="tool-row-hint">{row.hint}</span>
                  </div>
                  <code className="tool-row-value tc-result-value">{row.value}</code>
                  <button
                    type="button"
                    className="tool-icon-btn"
                    onClick={() => copyText(row.value, row.key)}
                    title={`复制 ${row.label}`}
                    aria-label={`复制 ${row.label}`}
                  >
                    {copied === row.key ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="tool-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">多时区对照</h3>
              <span className="tc-zones-count">{TIMEZONES.length} 个时区</span>
            </div>
            <div className="tool-rows">
              {TIMEZONES.map((tz) => (
                <div className="tool-row tc-zone-row" key={tz.id}>
                  <span className="tool-row-label tc-zone-name">{tz.label}</span>
                  <span className="tc-zone-time">
                    {formatInTimezone(displayDate, tz.id, {
                      ...dateOpts,
                      timeZoneName: undefined
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
