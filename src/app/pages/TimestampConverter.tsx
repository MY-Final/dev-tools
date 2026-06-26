import { useState, useCallback, useEffect, useMemo } from 'react'
import { Copy, Check, RotateCcw, Clock, ArrowLeftRight, Globe, Zap } from 'lucide-react'

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

  return (
    <div className="tc-page">
      <div className="tc-card">
        <div className="tc-header">
          <h2 className="tc-title">Timestamp Converter</h2>
          <p className="tc-subtitle">Unix 时间戳与日期时间双向转换</p>
        </div>

        <div className="tc-now">
          <div className="tc-now-header">
            <Clock size={14} />
            <span>当前时间</span>
          </div>
          <div className="tc-now-time">{formatInTimezone(now, timezone, dateOpts)}</div>
          <div className="tc-now-timestamps">
            <button
              className="tc-now-ts"
              onClick={() => copyText(Math.floor(now.getTime() / 1000).toString(), 'now-s')}
            >
              <span className="tc-now-ts-label">Unix</span>
              <span className="tc-now-ts-value">{Math.floor(now.getTime() / 1000)}</span>
            </button>
            <button
              className="tc-now-ts"
              onClick={() => copyText(now.getTime().toString(), 'now-ms')}
            >
              <span className="tc-now-ts-label">毫秒</span>
              <span className="tc-now-ts-value">{now.getTime()}</span>
            </button>
          </div>
        </div>

        <div className="tc-tz-selector">
          <Globe size={14} />
          <span className="tc-tz-label">时区</span>
          <select
            className="tc-tz-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div className="tc-converter">
          <div className="tc-input-group">
            <div className="tc-input-header">
              <span className="tc-input-label">时间戳</span>
              <span className="tc-input-hint">支持秒级 / 毫秒级</span>
            </div>
            <input
              type="text"
              className="tc-input"
              value={timestampInput}
              onChange={(e) => handleTimestampChange(e.target.value)}
              placeholder="1718784000"
            />
          </div>

          <div className="tc-swap">
            <ArrowLeftRight size={16} />
          </div>

          <div className="tc-input-group">
            <div className="tc-input-header">
              <span className="tc-input-label">日期时间</span>
              <span className="tc-input-hint">本地时间</span>
            </div>
            <input
              type="text"
              className="tc-input"
              value={dateInput}
              onChange={(e) => handleDateChange(e.target.value)}
              placeholder="2025-06-19 10:00:00"
            />
          </div>
        </div>

        <div className="tc-actions">
          <button className="tc-action-btn" onClick={useCurrentTime}>
            <Clock size={14} />
            使用当前时间
          </button>
          <button className="tc-action-btn" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {currentDate && (
          <div className="tc-results">
            <div className="tc-result-section">
              <span className="tc-result-label">时间戳</span>
              <div className="tc-result-grid">
                <div className="tc-result-item">
                  <span className="tc-result-name">Unix Timestamp</span>
                  <div className="tc-result-value-row">
                    <code className="tc-result-value">
                      {Math.floor(currentDate.getTime() / 1000)}
                    </code>
                    <button
                      className="tc-copy-btn"
                      onClick={() =>
                        copyText(Math.floor(currentDate.getTime() / 1000).toString(), 'unix')
                      }
                    >
                      {copied === 'unix' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div className="tc-result-item">
                  <span className="tc-result-name">Milliseconds</span>
                  <div className="tc-result-value-row">
                    <code className="tc-result-value">{currentDate.getTime()}</code>
                    <button
                      className="tc-copy-btn"
                      onClick={() => copyText(currentDate.getTime().toString(), 'ms')}
                    >
                      {copied === 'ms' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="tc-result-section">
              <span className="tc-result-label">格式化</span>
              <div className="tc-result-grid">
                <div className="tc-result-item">
                  <span className="tc-result-name">本地时间</span>
                  <div className="tc-result-value-row">
                    <code className="tc-result-value">
                      {formatInTimezone(currentDate, timezone, dateOpts)}
                    </code>
                    <button
                      className="tc-copy-btn"
                      onClick={() =>
                        copyText(formatInTimezone(currentDate, timezone, dateOpts), 'local')
                      }
                    >
                      {copied === 'local' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div className="tc-result-item">
                  <span className="tc-result-name">ISO8601</span>
                  <div className="tc-result-value-row">
                    <code className="tc-result-value">{currentDate.toISOString()}</code>
                    <button
                      className="tc-copy-btn"
                      onClick={() => copyText(currentDate.toISOString(), 'iso')}
                    >
                      {copied === 'iso' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="tc-result-section">
              <span className="tc-result-label">多时区</span>
              <div className="tc-tz-grid">
                {TIMEZONES.map((tz) => (
                  <div key={tz.id} className="tc-tz-item">
                    <span className="tc-tz-name">{tz.label}</span>
                    <span className="tc-tz-time">
                      {formatInTimezone(currentDate, tz.id, {
                        ...dateOpts,
                        timeZoneName: undefined
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="tc-quick-offsets">
          <div className="tc-quick-header">
            <Zap size={14} />
            <span>快捷计算</span>
          </div>
          <div className="tc-quick-buttons">
            {QUICK_OFFSETS.map((offset) => (
              <button
                key={offset.minutes}
                className="tc-quick-btn"
                onClick={() => addOffset(offset.minutes)}
              >
                {offset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
