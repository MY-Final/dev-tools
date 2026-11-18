export type CronMode = 'generator' | 'parser'

export type Frequency = 'every-minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

export interface CronConfig {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string[]
}

export const WEEKDAYS = [
  { id: '1', label: 'Mon', full: 'Monday' },
  { id: '2', label: 'Tue', full: 'Tuesday' },
  { id: '3', label: 'Wed', full: 'Wednesday' },
  { id: '4', label: 'Thu', full: 'Thursday' },
  { id: '5', label: 'Fri', full: 'Friday' },
  { id: '6', label: 'Sat', full: 'Saturday' },
  { id: '0', label: 'Sun', full: 'Sunday' }
]

export const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
]

export const QUICK_TEMPLATES = [
  { id: 'every-minute', label: '每分钟', cron: '* * * * *' },
  { id: 'every-5-minutes', label: '每5分钟', cron: '*/5 * * * *' },
  { id: 'every-15-minutes', label: '每15分钟', cron: '*/15 * * * *' },
  { id: 'every-30-minutes', label: '每30分钟', cron: '*/30 * * * *' },
  { id: 'hourly', label: '每小时', cron: '0 * * * *' },
  { id: 'daily-9am', label: '每天9点', cron: '0 9 * * *' },
  { id: 'weekdays-9am', label: '工作日9点', cron: '0 9 * * 1-5' },
  { id: 'weekly-monday', label: '每周一凌晨', cron: '0 0 * * 1' },
  { id: 'monthly-first', label: '每月1号', cron: '0 0 1 * *' },
  { id: 'yearly', label: '每年1月1号', cron: '0 0 1 1 *' }
]

export const FREQUENCY_PRESETS: Record<Frequency, Partial<CronConfig>> = {
  'every-minute': { minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: [] },
  hourly: { minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: [] },
  daily: { minute: '0', hour: '9', dayOfMonth: '*', month: '*', dayOfWeek: [] },
  weekly: { minute: '0', hour: '0', dayOfMonth: '*', month: '*', dayOfWeek: ['1'] },
  monthly: { minute: '0', hour: '0', dayOfMonth: '1', month: '*', dayOfWeek: [] },
  custom: { minute: '0', hour: '9', dayOfMonth: '*', month: '*', dayOfWeek: [] }
}

interface FieldSpec {
  min: number
  max: number
  names?: Record<string, number>
}

interface ParsedField {
  values: Set<number>
  restricted: boolean
}

interface ParsedSchedule {
  minute: ParsedField
  hour: ParsedField
  dayOfMonth: ParsedField
  month: ParsedField
  dayOfWeek: ParsedField
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
}

const WEEKDAY_NAMES: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6
}

const MINUTE_SPEC: FieldSpec = { min: 0, max: 59 }
const HOUR_SPEC: FieldSpec = { min: 0, max: 23 }
const DAY_OF_MONTH_SPEC: FieldSpec = { min: 1, max: 31 }
const MONTH_SPEC: FieldSpec = { min: 1, max: 12, names: MONTH_NAMES }
const DAY_OF_WEEK_SPEC: FieldSpec = { min: 0, max: 7, names: WEEKDAY_NAMES }

const WEEKDAY_ORDER: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  0: 6
}

function normalizeFieldValue(token: string, spec: FieldSpec): number | null {
  const namedValue = spec.names?.[token.toUpperCase()]
  const value = namedValue ?? Number(token)

  if (!Number.isInteger(value) || value < spec.min || value > spec.max) return null
  return value
}

function parseSegment(segment: string, spec: FieldSpec, values: Set<number>): boolean {
  const parts = segment.split('/')
  if (parts.length > 2) return false

  const step = parts[1] === undefined ? 1 : Number(parts[1])
  if (!Number.isInteger(step) || step <= 0) return false

  const range = parts[0]
  let start: number
  let end: number

  if (range === '*') {
    start = spec.min
    end = spec.max
  } else if (range.includes('-')) {
    const bounds = range.split('-')
    if (bounds.length !== 2) return false

    const parsedStart = normalizeFieldValue(bounds[0], spec)
    const parsedEnd = normalizeFieldValue(bounds[1], spec)
    if (parsedStart === null || parsedEnd === null || parsedStart > parsedEnd) return false

    start = parsedStart
    end = parsedEnd
  } else {
    const parsedValue = normalizeFieldValue(range, spec)
    if (parsedValue === null) return false

    start = parsedValue
    end = parsedValue
  }

  for (let value = start; value <= end; value += step) {
    values.add(spec === DAY_OF_WEEK_SPEC && value === 7 ? 0 : value)
  }

  return true
}

function parseField(raw: string, spec: FieldSpec): ParsedField | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const values = new Set<number>()
  for (const segment of trimmed.split(',')) {
    if (!parseSegment(segment, spec, values)) return null
  }

  return {
    values,
    restricted: trimmed !== '*'
  }
}

function parseSchedule(parts: string[]): ParsedSchedule | null {
  const minute = parseField(parts[0], MINUTE_SPEC)
  const hour = parseField(parts[1], HOUR_SPEC)
  const dayOfMonth = parseField(parts[2], DAY_OF_MONTH_SPEC)
  const month = parseField(parts[3], MONTH_SPEC)
  const dayOfWeek = parseField(parts[4], DAY_OF_WEEK_SPEC)

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null

  return { minute, hour, dayOfMonth, month, dayOfWeek }
}

function sortWeekdays(values: number[]): string[] {
  return [...values].sort((a, b) => WEEKDAY_ORDER[a] - WEEKDAY_ORDER[b]).map(String)
}

function formatWeekdays(days: string[]): string {
  if (days.length === 0 || days.length === 7) return ''

  return days
    .map((day) => {
      const weekday = WEEKDAYS.find((item) => item.id === day)
      return weekday?.full ?? day
    })
    .join(', ')
}

function buildTimeDescription(config: CronConfig): string {
  if (config.minute === '*' && config.hour === '*') return 'Every minute'
  if (config.minute === '*') {
    return config.hour.startsWith('*/')
      ? `Every minute during every ${config.hour.slice(2)} hours`
      : `Every minute during hour ${config.hour}`
  }
  if (config.minute.startsWith('*/')) {
    if (config.hour === '*') return `Every ${config.minute.slice(2)} minutes`
    if (config.hour.startsWith('*/')) {
      return `Every ${config.minute.slice(2)} minutes during every ${config.hour.slice(2)} hours`
    }
    return `Every ${config.minute.slice(2)} minutes at hour ${config.hour}`
  }
  if (config.hour === '*') return `At minute ${config.minute} of every hour`
  if (config.hour.startsWith('*/')) {
    return `At minute ${config.minute} during every ${config.hour.slice(2)} hours`
  }

  const minute = config.minute.includes(',') || config.minute.includes('-') ? config.minute : config.minute.padStart(2, '0')
  const hour = config.hour.includes(',') || config.hour.includes('-') ? config.hour : config.hour.padStart(2, '0')
  return `At ${hour}:${minute}`
}

function buildDateDescription(config: CronConfig): string {
  const parts: string[] = []
  const dayOfWeek = formatWeekdays(config.dayOfWeek)
  const bothDayFieldsRestricted = config.dayOfMonth !== '*' && config.dayOfWeek.length > 0

  if (config.month !== '*') {
    if (config.month.startsWith('*/')) {
      parts.push(`every ${config.month.slice(2)} months`)
    } else {
      // 解析模式保留原始写法（JAN / 1），描述里统一还原成月份全称。
      const monthNames = config.month
        .split(',')
        .map((value) => {
          const numeric = MONTH_NAMES[value.toUpperCase()] ?? Number(value)
          return MONTHS.find((month) => month.value === String(numeric))?.label ?? value
        })
        .join(', ')
      parts.push(`in ${monthNames}`)
    }
  }

  if (config.dayOfMonth !== '*') {
    if (config.dayOfMonth.startsWith('*/')) {
      parts.push(`every ${config.dayOfMonth.slice(2)} days`)
    } else {
      parts.push(`on day ${config.dayOfMonth} of the month`)
    }
  }

  if (dayOfWeek) parts.push(`on ${dayOfWeek}`)
  if (parts.length === 0) parts.push('every day')
  if (bothDayFieldsRestricted) parts.push('(day-of-month or day-of-week)')

  return parts.join(' ')
}

export function buildCronExpression(config: CronConfig): string {
  const numericWeekdays = config.dayOfWeek.every((day) => /^\d+$/.test(day))
  const weekdays =
    config.dayOfWeek.length === 0 || config.dayOfWeek.length === 7
      ? '*'
      : numericWeekdays
        ? sortWeekdays(config.dayOfWeek.map(Number)).join(',')
        : config.dayOfWeek.join(',')

  return `${config.minute} ${config.hour} ${config.dayOfMonth} ${config.month} ${weekdays}`
}

export type CronParseError = 'empty' | 'part-count' | 'invalid-field'

export interface CronParseResult {
  config: CronConfig | null
  error: CronParseError | null
  /** 实际字段数，用于把「需要 5 段」和「字段值无效」区分开。 */
  partCount: number
}

export function parseCronExpressionDetailed(cron: string): CronParseResult {
  if (!cron.trim()) return { config: null, error: 'empty', partCount: 0 }

  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return { config: null, error: 'part-count', partCount: parts.length }

  const schedule = parseSchedule(parts)
  if (!schedule) return { config: null, error: 'invalid-field', partCount: 5 }

  return {
    config: {
      minute: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4] === '*' ? [] : sortWeekdays([...schedule.dayOfWeek.values])
    },
    error: null,
    partCount: 5
  }
}

export function parseCronExpression(cron: string): CronConfig | null {
  return parseCronExpressionDetailed(cron).config
}

export interface CronConfigIssue {
  field: string
  value: string
  min: number
  max: number
}

/** 生成器里的「指定」输入可能被键入越界值，先校验再展示，避免静默生成无效表达式。 */
export function validateCronConfig(config: CronConfig): CronConfigIssue | null {
  const checks: { field: string; spec: FieldSpec; value: string }[] = [
    { field: '分钟', spec: MINUTE_SPEC, value: config.minute },
    { field: '小时', spec: HOUR_SPEC, value: config.hour },
    { field: '日期', spec: DAY_OF_MONTH_SPEC, value: config.dayOfMonth },
    { field: '月份', spec: MONTH_SPEC, value: config.month }
  ]
  for (const check of checks) {
    if (!parseField(check.value, check.spec)) {
      return {
        field: check.field,
        value: check.value,
        min: check.spec.min,
        max: check.spec.max
      }
    }
  }

  const badWeekday = config.dayOfWeek.find((day) => !parseField(day, DAY_OF_WEEK_SPEC))
  if (badWeekday !== undefined) {
    return { field: '星期', value: badWeekday, min: 0, max: 6 }
  }

  return null
}

export function generateDescription(config: CronConfig): string {
  return `${buildTimeDescription(config)} ${buildDateDescription(config)}`
}

function firstAtOrAfter(start: number, values: Set<number>): number | null {
  for (let value = start; value <= 59; value++) {
    if (values.has(value)) return value
  }
  return null
}

function nextMonth(current: Date, months: Set<number>): void {
  current.setDate(1)
  current.setHours(0, 0, 0, 0)

  const currentMonth = current.getMonth() + 1
  for (let month = currentMonth + 1; month <= 12; month++) {
    if (months.has(month)) {
      current.setMonth(month - 1, 1)
      return
    }
  }

  current.setFullYear(current.getFullYear() + 1)
  current.setMonth(Math.min(...months) - 1, 1)
}

function matchesDay(schedule: ParsedSchedule, current: Date): boolean {
  const dayOfMonthMatches = schedule.dayOfMonth.values.has(current.getDate())
  const dayOfWeekMatches = schedule.dayOfWeek.values.has(current.getDay())

  if (!schedule.dayOfMonth.restricted && !schedule.dayOfWeek.restricted) return true
  if (!schedule.dayOfMonth.restricted) return dayOfWeekMatches
  if (!schedule.dayOfWeek.restricted) return dayOfMonthMatches
  return dayOfMonthMatches || dayOfWeekMatches
}

function firstHourAtOrAfter(start: number, values: Set<number>): number | null {
  for (let hour = start; hour <= 23; hour++) {
    if (values.has(hour)) return hour
  }
  return null
}

export function generateNextRuns(config: CronConfig, count = 5, baseDate = new Date()): Date[] {
  const schedule = parseSchedule([
    config.minute,
    config.hour,
    config.dayOfMonth,
    config.month,
    config.dayOfWeek.length === 0 ? '*' : config.dayOfWeek.join(',')
  ])
  if (!schedule || count <= 0) return []

  const runs: Date[] = []
  const current = new Date(baseDate)
  current.setSeconds(0, 0)
  current.setMinutes(current.getMinutes() + 1)

  const maxDate = new Date(current)
  maxDate.setFullYear(maxDate.getFullYear() + 40)

  while (runs.length < count && current.getTime() <= maxDate.getTime()) {
    const month = current.getMonth() + 1
    if (!schedule.month.values.has(month)) {
      nextMonth(current, schedule.month.values)
      continue
    }

    if (!matchesDay(schedule, current)) {
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    if (!schedule.hour.values.has(current.getHours())) {
      const nextHour = firstHourAtOrAfter(current.getHours(), schedule.hour.values)
      if (nextHour === null) {
        current.setDate(current.getDate() + 1)
        current.setHours(0, 0, 0, 0)
      } else {
        current.setHours(nextHour, 0, 0, 0)
      }
      continue
    }

    if (!schedule.minute.values.has(current.getMinutes())) {
      const nextMinute = firstAtOrAfter(current.getMinutes(), schedule.minute.values)
      if (nextMinute === null) {
        current.setHours(current.getHours() + 1, 0, 0, 0)
      } else {
        current.setMinutes(nextMinute, 0, 0)
      }
      continue
    }

    runs.push(new Date(current))
    current.setMinutes(current.getMinutes() + 1)
  }

  return runs
}