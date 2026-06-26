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

function formatTime(date: Date, tz: string): { time: string; date: string; weekday: string; hours: number; minutes: number } {
  try {
    const str = date.toLocaleString('en-US', { timeZone: tz, hour12: false })
    const parsed = new Date(str)
    const h = parsed.getHours()
    const m = parsed.getMinutes()
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    const dateStr = parsed.toLocaleDateString('zh-CN', { timeZone: tz })
    const weekday = parsed.toLocaleDateString('zh-CN', { timeZone: tz, weekday: 'short' })
    return { time, date: dateStr, weekday, hours: h, minutes: m }
  } catch {
    return { time: '--:--', date: '', weekday: '', hours: 0, minutes: 0 }
  }
}

function getOffset(date: Date, tz: string): string {
  try {
    const local = date.getTime()
    const tzStr = date.toLocaleString('en-US', { timeZone: tz })
    const tzDate = new Date(tzStr)
    const diff = tzDate.getTime() - local
    const hours = Math.round(diff / (1000 * 60 * 60))
    const sign = hours >= 0 ? '+' : ''
    return `UTC${sign}${hours}`
  } catch {
    return ''
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
        const { time, date, weekday } = formatTime(now, z.timezone)
        const offset = getOffset(now, z.timezone)
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
    <div className="tzc-page">
      <div className="tzc-card">
        <div className="tzc-header">
          <h2 className="tzc-title">Timezone Converter</h2>
          <p className="tzc-subtitle">多时区时间对照</p>
        </div>

        <div className="tzc-toolbar">
          <button className="tzc-add-btn" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} />
            添加时区
          </button>
          <button className="tzc-copy-btn" onClick={copyAll}>
            {copied === 'all' ? <Check size={14} /> : <Copy size={14} />}
            {copied === 'all' ? '已复制' : '复制全部'}
          </button>
        </div>

        {showAdd && (
          <div className="tzc-add-panel">
            <input
              className="tzc-search"
              value={searchTz}
              onChange={(e) => setSearchTz(e.target.value)}
              placeholder="搜索时区..."
              autoFocus
            />
            <div className="tzc-add-list">
              {filtered.map((t) => (
                <button
                  key={t.tz}
                  className="tzc-add-item"
                  onClick={() => add(t.tz, t.label.split(' ')[0])}
                >
                  <span>{t.label}</span>
                  <span className="tzc-tz-name">{t.tz}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {zones.length > 0 && (
          <div className="tzc-list">
            {zones.map((z) => {
              const { time, date, weekday } = formatTime(now, z.timezone)
              const offset = getOffset(now, z.timezone)
              const isNight = formatTime(now, z.timezone).hours < 6 || formatTime(now, z.timezone).hours >= 22
              return (
                <div key={z.id} className={`tzc-item ${isNight ? 'night' : ''}`}>
                  <div className="tzc-item-info">
                    <div className="tzc-item-label">{z.label}</div>
                    <div className="tzc-item-offset">{offset}</div>
                  </div>
                  <div className="tzc-item-time">{time}</div>
                  <div className="tzc-item-date">
                    {weekday} {date}
                  </div>
                  <button className="tzc-item-remove" onClick={() => remove(z.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
