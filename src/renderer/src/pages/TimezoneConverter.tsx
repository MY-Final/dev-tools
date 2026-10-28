import { useState, useCallback, useEffect } from 'react'
import { Copy, Check, Trash2, Plus } from 'lucide-react'
import '../styles/timezone-converter.css'

interface TimezoneEntry {
  id: number
  label: string
  timezone: string
}

const COMMON_TIMEZONES = [
  { label: 'UTC', tz: 'UTC' },
  { label: '北京 (CST)', tz: 'Asia/Shanghai' },
  { label: '东京 (JST)', tz: 'Asia/Tokyo' },
  { label: '首尔', tz: 'Asia/Seoul' },
  { label: '新加坡', tz: 'Asia/Singapore' },
  { label: '悉尼 (AEST)', tz: 'Australia/Sydney' },
  { label: '伦敦 (GMT)', tz: 'Europe/London' },
  { label: '纽约 (EST)', tz: 'America/New_York' },
  { label: '洛杉矶 (PST)', tz: 'America/Los_Angeles' },
  { label: '旧金山', tz: 'America/Los_Angeles' },
  { label: '芝加哥', tz: 'America/Chicago' },
  { label: '柏林 (CET)', tz: 'Europe/Berlin' },
  { label: '巴黎', tz: 'Europe/Paris' },
  { label: '莫斯科', tz: 'Europe/Moscow' },
  { label: '迪拜', tz: 'Asia/Dubai' },
  { label: '印度 (IST)', tz: 'Asia/Kolkata' },
  { label: '圣保罗', tz: 'America/Sao_Paulo' },
  { label: '多伦多', tz: 'America/Toronto' }
]

interface TimeZoneInfo {
  time: string
  date: string
  weekday: string
  hours: number
  minutes: number
  offset: string
}

function formatTime(date: Date, tz: string): TimeZoneInfo {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
      timeZoneName: 'longOffset'
    })
    const parts = formatter.formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? ''

    const hours = Number(value('hour'))
    const minutes = Number(value('minute'))
    const rawOffset = value('timeZoneName')
    const offset = rawOffset === 'GMT' ? 'UTC' : rawOffset.replace(/^GMT/, 'UTC')

    return {
      time: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0'),
      date: value('year') + '-' + value('month') + '-' + value('day'),
      weekday: value('weekday'),
      hours,
      minutes,
      offset: offset || 'UTC'
    }
  } catch {
    return { time: '--:--', date: '', weekday: '', hours: 0, minutes: 0, offset: '' }
  }
}
export default function TimezoneConverter(): React.JSX.Element {
  const [zones, setZones] = useState<TimezoneEntry[]>([
    { id: 1, label: '北京', timezone: 'Asia/Shanghai' },
    { id: 2, label: '伦敦', timezone: 'Europe/London' },
    { id: 3, label: '纽约', timezone: 'America/New_York' }
  ])
  const [now, setNow] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [searchTz, setSearchTz] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remove = useCallback((id: number) => {
    setZones((prev) => prev.filter((z) => z.id !== id))
  }, [])

  const add = useCallback((tz: string, label: string) => {
    setZones((prev) => [...prev, { id: Date.now(), label, timezone: tz }])
    setShowAdd(false)
    setSearchTz('')
  }, [])

  const copyAll = useCallback(async () => {
    const text = zones
      .map((z) => {
        const { time, date, weekday, offset } = formatTime(now, z.timezone)
        return `${z.label}  ${time}  ${weekday} ${date} (${offset})`
      })
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied('all')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }, [zones, now])

  const filtered = COMMON_TIMEZONES.filter(
    (t) =>
      (t.label + t.tz).toLowerCase().includes(searchTz.toLowerCase()) &&
      !zones.some((z) => z.timezone === t.tz)
  )

  return (
    <div className="tzc-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Timezone Converter</h2>
          <p className="tool-page-desc">并排对照多个城市的当前时间，添加或移除常用时区。</p>
        </div>
        <div className="tool-page-actions">
          <button
            type="button"
            className={`tool-btn ${showAdd ? 'tool-btn--outline' : ''}`}
            aria-expanded={showAdd}
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={14} aria-hidden="true" />
            {showAdd ? '收起' : '添加时区'}
          </button>
          <button type="button" className="tool-btn tool-btn--outline" onClick={copyAll}>
            {copied === 'all' ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copied === 'all' ? '已复制' : '复制全部'}
          </button>
        </div>
      </header>

      {showAdd && (
        <section className="tool-panel tzc-add-panel">
          <div className="tzc-add-head">
            <input
              className="tool-input tzc-search"
              value={searchTz}
              onChange={(e) => setSearchTz(e.target.value)}
              placeholder="搜索城市或时区"
              aria-label="搜索时区"
              autoFocus
            />
            <span className="tzc-add-count">{filtered.length} 个可选</span>
          </div>
          <div className="tzc-add-list">
            {filtered.map((t) => (
              <button
                key={t.tz}
                type="button"
                className="tzc-add-item"
                onClick={() => add(t.tz, t.label.split(' ')[0])}
              >
                <span className="tzc-add-name">{t.label}</span>
                <span className="tzc-tz-name">{t.tz}</span>
              </button>
            ))}
            {!filtered.length && <span className="tzc-add-empty">没有可添加的时区</span>}
          </div>
        </section>
      )}

      {zones.length > 0 && (
        <section className="tool-panel tzc-list-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">时区对照</h3>
            <span className="tzc-list-count">{zones.length} 个时区</span>
          </div>
          <div className="tzc-list">
            {zones.map((z) => {
              const { time, date, weekday, hours, offset } = formatTime(now, z.timezone)
              const isNight = hours < 6 || hours >= 22
              return (
                <div key={z.id} className={`tzc-item ${isNight ? 'night' : ''}`}>
                  <div className="tzc-item-info">
                    <span className="tzc-item-label">{z.label}</span>
                    <span className="tzc-item-offset">{offset}</span>
                  </div>
                  <span className="tzc-item-time">{time}</span>
                  <span className="tzc-item-date">
                    {weekday} {date}
                  </span>
                  <button
                    type="button"
                    className="tool-icon-btn tzc-item-remove"
                    onClick={() => remove(z.id)}
                    title={`移除 ${z.label}`}
                    aria-label={`移除 ${z.label}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
