import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, Check, Trash2, Plus } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'
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

const CURATED_TIMEZONES = new Set(COMMON_TIMEZONES.map((t) => t.tz))

/**
 * V8 的 IANA 列表仍使用部分旧拼写（Katmandu / Calcutta / Saigon…），
 * 用户通常搜现代城市名，因此显示现代名称，并在已收录现代 id 时跳过重复项。
 */
const MODERN_TIMEZONE_NAMES: Record<string, { label: string; canonical: string }> = {
  'asia/calcutta': { label: 'Kolkata', canonical: 'Asia/Kolkata' },
  'asia/katmandu': { label: 'Kathmandu', canonical: 'Asia/Kathmandu' },
  'asia/rangoon': { label: 'Yangon', canonical: 'Asia/Yangon' },
  'asia/saigon': { label: 'Ho Chi Minh', canonical: 'Asia/Ho_Chi_Minh' },
  'america/godthab': { label: 'Nuuk', canonical: 'America/Nuuk' }
}

/** 只有「洛杉矶 (PST)」这类括注需要去掉；「Buenos Aires」这类多词城市名要完整保留。 */
function displayLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label
}

/** Full IANA list when the engine exposes it; older engines fall back to the curated list. */
function getSupportedTimezones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
  try {
    return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : []
  } catch {
    return []
  }
}

const TIMEZONE_OPTIONS = (() => {
  const seen = new Set(CURATED_TIMEZONES)
  const extra = getSupportedTimezones()
    .filter((tz) => {
      if (seen.has(tz)) return false
      const alias = MODERN_TIMEZONE_NAMES[tz.toLowerCase()]
      if (alias && seen.has(alias.canonical)) return false
      seen.add(tz)
      return true
    })
    .map((tz) => ({
      label:
        MODERN_TIMEZONE_NAMES[tz.toLowerCase()]?.label ??
        tz.split('/').pop()?.replace(/_/g, ' ') ??
        tz,
      tz
    }))
  return [...COMMON_TIMEZONES, ...extra]
})()

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
  const [copyError, setCopyError] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  // 自增 id：Date.now() 在同一毫秒内连续添加会撞 key。
  const nextIdRef = useRef(4)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remove = useCallback((id: number) => {
    setZones((prev) => prev.filter((z) => z.id !== id))
  }, [])

  const add = useCallback((tz: string, label: string) => {
    setZones((prev) => [...prev, { id: nextIdRef.current++, label, timezone: tz }])
    setShowAdd(false)
    setSearchTz('')
    // 添加面板关闭后把焦点还给触发按钮，键盘用户不会掉到页面顶部。
    requestAnimationFrame(() => addButtonRef.current?.focus())
  }, [])

  const copyAll = useCallback(async () => {
    if (!zones.length) return
    const text = zones
      .map((z) => {
        const { time, date, weekday, offset } = formatTime(now, z.timezone)
        return `${z.label}  ${time}  ${weekday} ${date} (${offset})`
      })
      .join('\n')
    if (!(await copyText(text))) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied('all')
    setTimeout(() => setCopied(null), 1500)
  }, [zones, now])

  const query = searchTz.trim().toLowerCase()
  const filtered = TIMEZONE_OPTIONS.filter(
    (t) =>
      // 同时匹配 "Los_Angeles" 和 "Los Angeles"，中文标签与 IANA id 都能搜。
      (t.label + ' ' + t.tz + ' ' + t.tz.replace(/_/g, ' ')).toLowerCase().includes(query) &&
      !zones.some((z) => z.timezone === t.tz)
  )

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowAdd(false)
        setSearchTz('')
        addButtonRef.current?.focus()
        return
      }
      if (e.key === 'Enter' && filtered[0]) {
        e.preventDefault()
        add(filtered[0].tz, displayLabel(filtered[0].label))
      }
    },
    [filtered, add]
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
            ref={addButtonRef}
            type="button"
            className={`tool-btn ${showAdd ? 'tool-btn--outline' : ''}`}
            aria-expanded={showAdd}
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={14} aria-hidden="true" />
            {showAdd ? '收起' : '添加时区'}
          </button>
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={copyAll}
            disabled={!zones.length}
          >
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
              placeholder="搜索城市或 IANA 时区（回车添加首个结果）"
              aria-label="搜索时区"
              autoFocus
              onKeyDown={handleSearchKeyDown}
            />
            <span className="tzc-add-count">{filtered.length} 个可选</span>
          </div>
          <div className="tzc-add-list">
            {filtered.map((t) => (
              <button
                key={`${t.label}-${t.tz}`}
                type="button"
                className="tzc-add-item"
                onClick={() => add(t.tz, displayLabel(t.label))}
              >
                <span className="tzc-add-name">{t.label}</span>
                <span className="tzc-tz-name">{t.tz}</span>
              </button>
            ))}
            {!filtered.length && <span className="tzc-add-empty">没有匹配的时区</span>}
          </div>
        </section>
      )}

      {zones.length > 0 ? (
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
      ) : (
        <section className="tool-panel tzc-list-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">时区对照</h3>
            <span className="tzc-list-count">0 个时区</span>
          </div>
          <div className="tzc-empty">
            <p className="tzc-empty-text">
              还没有添加时区。添加城市后，这里会并排显示它们的当前时间。
            </p>
            <button
              type="button"
              className="tool-btn tool-btn--outline"
              onClick={() => setShowAdd(true)}
            >
              <Plus size={14} aria-hidden="true" />
              添加时区
            </button>
          </div>
        </section>
      )}
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
