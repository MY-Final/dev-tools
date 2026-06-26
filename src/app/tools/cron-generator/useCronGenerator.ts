import { useState, useCallback, useMemo } from 'react'

export type CronMode = 'generator' | 'parser'

export type Frequency = 'every-minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

export interface CronConfig {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string[]
}

const WEEKDAYS = [
  { id: '1', label: 'Mon', full: 'Monday' },
  { id: '2', label: 'Tue', full: 'Tuesday' },
  { id: '3', label: 'Wed', full: 'Wednesday' },
  { id: '4', label: 'Thu', full: 'Thursday' },
  { id: '5', label: 'Fri', full: 'Friday' },
  { id: '6', label: 'Sat', full: 'Saturday' },
  { id: '0', label: 'Sun', full: 'Sunday' }
]

const MONTHS = [
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

const QUICK_TEMPLATES = [
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

const FREQUENCY_PRESETS: Record<Frequency, Partial<CronConfig>> = {
  'every-minute': { minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: [] },
  hourly: { minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: [] },
  daily: { minute: '0', hour: '9', dayOfMonth: '*', month: '*', dayOfWeek: [] },
  weekly: { minute: '0', hour: '0', dayOfMonth: '*', month: '*', dayOfWeek: ['1'] },
  monthly: { minute: '0', hour: '0', dayOfMonth: '1', month: '*', dayOfWeek: [] },
  custom: { minute: '0', hour: '9', dayOfMonth: '*', month: '*', dayOfWeek: [] }
}

function buildCronExpression(config: CronConfig): string {
  const dayOfWeek =
    config.dayOfWeek.length === 0 || config.dayOfWeek.length === 7
      ? '*'
      : config.dayOfWeek.join(',')

  return `${config.minute} ${config.hour} ${config.dayOfMonth} ${config.month} ${dayOfWeek}`
}

function parseCronExpression(cron: string): CronConfig | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const dayOfWeek = parts[4] === '*' ? [] : parts[4].split(',')

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek
  }
}

function generateDescription(config: CronConfig): string {
  const parts: string[] = []

  const dayOfWeekStr =
    config.dayOfWeek.length === 0 || config.dayOfWeek.length === 7
      ? ''
      : config.dayOfWeek.map((d) => WEEKDAYS.find((w) => w.id === d)?.full || d).join(', ')

  if (config.minute === '*' && config.hour === '*') {
    parts.push('Every minute')
  } else if (config.minute === '*') {
    parts.push('Every minute')
    if (config.hour !== '*') {
      if (config.hour.startsWith('*/')) {
        parts[0] = `Every ${config.hour.slice(2)} hours`
      } else {
        parts.push(`at hour ${config.hour}`)
      }
    }
  } else if (config.hour === '*') {
    if (config.minute.startsWith('*/')) {
      parts.push(`Every ${config.minute.slice(2)} minutes`)
    } else {
      parts.push(`At minute ${config.minute}`)
      parts.push('of every hour')
    }
  } else {
    const minuteStr = config.minute.padStart(2, '0')
    const hourStr = config.hour.padStart(2, '0')
    parts.push(`At ${hourStr}:${minuteStr}`)
  }

  if (config.dayOfMonth !== '*') {
    if (config.dayOfMonth.startsWith('*/')) {
      parts.push(`every ${config.dayOfMonth.slice(2)} days`)
    } else {
      parts.push(`on day ${config.dayOfMonth} of the month`)
    }
  }

  if (config.month !== '*') {
    if (config.month.startsWith('*/')) {
      parts.push(`every ${config.month.slice(2)} months`)
    } else {
      const monthName = MONTHS.find((m) => m.value === config.month)?.label || config.month
      parts.push(`in ${monthName}`)
    }
  }

  if (dayOfWeekStr) {
    parts.push(`on ${dayOfWeekStr}`)
  } else if (config.dayOfWeek.length === 0 && config.dayOfMonth === '*') {
    parts.push('every day')
  }

  return parts.join(' ')
}

function generateNextRuns(config: CronConfig, count: number = 5): Date[] {
  const runs: Date[] = []
  const now = new Date()
  const current = new Date(now)
  current.setSeconds(0)
  current.setMilliseconds(0)
  current.setMinutes(current.getMinutes() + 1)

  const maxIterations = 525600
  let iterations = 0

  while (runs.length < count && iterations < maxIterations) {
    iterations++

    if (config.month !== '*' && !config.month.startsWith('*/')) {
      const targetMonth = parseInt(config.month) - 1
      if (current.getMonth() !== targetMonth) {
        if (current.getMonth() > targetMonth) {
          current.setFullYear(current.getFullYear() + 1)
        }
        current.setMonth(targetMonth)
        current.setDate(1)
        current.setHours(0)
        current.setMinutes(0)
        continue
      }
    }

    if (config.dayOfMonth !== '*' && !config.dayOfMonth.startsWith('*/')) {
      const targetDay = parseInt(config.dayOfMonth)
      if (current.getDate() !== targetDay) {
        if (current.getDate() > targetDay) {
          current.setMonth(current.getMonth() + 1)
          current.setDate(1)
          current.setHours(0)
          current.setMinutes(0)
          continue
        }
        current.setDate(targetDay)
        continue
      }
    }

    if (config.dayOfWeek.length > 0 && config.dayOfWeek.length < 7) {
      const dayOfWeek = current.getDay().toString()
      if (!config.dayOfWeek.includes(dayOfWeek)) {
        current.setDate(current.getDate() + 1)
        current.setHours(0)
        current.setMinutes(0)
        continue
      }
    }

    if (config.hour !== '*' && !config.hour.startsWith('*/')) {
      const targetHour = parseInt(config.hour)
      if (current.getHours() !== targetHour) {
        if (current.getHours() > targetHour) {
          current.setDate(current.getDate() + 1)
          current.setHours(0)
          current.setMinutes(0)
          continue
        }
        current.setHours(targetHour)
        current.setMinutes(0)
        continue
      }
    }

    if (config.minute !== '*' && !config.minute.startsWith('*/')) {
      const targetMinute = parseInt(config.minute)
      if (current.getMinutes() !== targetMinute) {
        if (current.getMinutes() > targetMinute) {
          current.setHours(current.getHours() + 1)
          current.setMinutes(0)
          continue
        }
        current.setMinutes(targetMinute)
        continue
      }
    }

    runs.push(new Date(current))
    current.setMinutes(current.getMinutes() + 1)
  }

  return runs
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useCronGenerator() {
  const [mode, setMode] = useState<CronMode>('generator')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [config, setConfig] = useState<CronConfig>({
    minute: '0',
    hour: '9',
    dayOfMonth: '*',
    month: '*',
    dayOfWeek: []
  })
  const [parserInput, setParserInput] = useState('0 9 * * 1-5')
  const [toast, setToast] = useState('')
  const [nextRunCount, setNextRunCount] = useState(5)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  const cronExpression = useMemo(() => {
    return buildCronExpression(config)
  }, [config])

  const description = useMemo(() => {
    return generateDescription(config)
  }, [config])

  const nextRuns = useMemo(() => {
    return generateNextRuns(config, nextRunCount)
  }, [config, nextRunCount])

  const parsedConfig = useMemo(() => {
    if (mode !== 'parser') return null
    return parseCronExpression(parserInput)
  }, [mode, parserInput])

  const parsedDescription = useMemo(() => {
    if (!parsedConfig) return 'Invalid cron expression'
    return generateDescription(parsedConfig)
  }, [parsedConfig])

  const parsedNextRuns = useMemo(() => {
    if (!parsedConfig) return []
    return generateNextRuns(parsedConfig, 5)
  }, [parsedConfig])

  const applyFrequency = useCallback((freq: Frequency) => {
    setFrequency(freq)
    const preset = FREQUENCY_PRESETS[freq]
    setConfig((prev) => ({
      ...prev,
      ...preset,
      dayOfWeek: preset.dayOfWeek || []
    }))
  }, [])

  const applyTemplate = useCallback((cron: string) => {
    const parsed = parseCronExpression(cron)
    if (parsed) {
      setConfig(parsed)
      setFrequency('custom')
    }
  }, [])

  const updateMinute = useCallback((value: string) => {
    setConfig((prev) => ({ ...prev, minute: value }))
    setFrequency('custom')
  }, [])

  const updateHour = useCallback((value: string) => {
    setConfig((prev) => ({ ...prev, hour: value }))
    setFrequency('custom')
  }, [])

  const updateDayOfMonth = useCallback((value: string) => {
    setConfig((prev) => ({ ...prev, dayOfMonth: value }))
    setFrequency('custom')
  }, [])

  const updateMonth = useCallback((value: string) => {
    setConfig((prev) => ({ ...prev, month: value }))
    setFrequency('custom')
  }, [])

  const toggleDayOfWeek = useCallback((day: string) => {
    setConfig((prev) => {
      const newDays = prev.dayOfWeek.includes(day)
        ? prev.dayOfWeek.filter((d) => d !== day)
        : [...prev.dayOfWeek, day]
      return { ...prev, dayOfWeek: newDays }
    })
    setFrequency('custom')
  }, [])

  const selectAllWeekdays = useCallback(() => {
    setConfig((prev) => ({ ...prev, dayOfWeek: ['1', '2', '3', '4', '5'] }))
    setFrequency('custom')
  }, [])

  const selectAllDays = useCallback(() => {
    setConfig((prev) => ({ ...prev, dayOfWeek: [] }))
    setFrequency('custom')
  }, [])

  const reset = useCallback(() => {
    setFrequency('daily')
    setConfig({
      minute: '0',
      hour: '9',
      dayOfMonth: '*',
      month: '*',
      dayOfWeek: []
    })
    showToast('已重置')
  }, [showToast])

  const copyCron = useCallback(() => {
    navigator.clipboard.writeText(cronExpression)
    showToast('已复制到剪贴板')
  }, [cronExpression, showToast])

  const copyParserCron = useCallback(() => {
    navigator.clipboard.writeText(parserInput)
    showToast('已复制到剪贴板')
  }, [parserInput, showToast])

  return {
    mode,
    setMode,
    frequency,
    config,
    parserInput,
    setParserInput,
    toast,
    nextRunCount,
    setNextRunCount,
    cronExpression,
    description,
    nextRuns,
    parsedConfig,
    parsedDescription,
    parsedNextRuns,
    applyFrequency,
    applyTemplate,
    updateMinute,
    updateHour,
    updateDayOfMonth,
    updateMonth,
    toggleDayOfWeek,
    selectAllWeekdays,
    selectAllDays,
    reset,
    copyCron,
    copyParserCron,
    showToast,
    WEEKDAYS,
    MONTHS,
    QUICK_TEMPLATES
  }
}
