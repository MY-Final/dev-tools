import { useState, useCallback, useMemo } from 'react'
import {
  FREQUENCY_PRESETS,
  MONTHS,
  QUICK_TEMPLATES,
  WEEKDAYS,
  buildCronExpression,
  generateDescription,
  generateNextRuns,
  parseCronExpression,
  type CronConfig,
  type CronMode,
  type Frequency
} from './cron-utils'

export type { CronConfig, CronMode, Frequency } from './cron-utils'

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

  const cronExpression = useMemo(() => buildCronExpression(config), [config])

  const description = useMemo(() => generateDescription(config), [config])

  const nextRuns = useMemo(() => generateNextRuns(config, nextRunCount), [config, nextRunCount])

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
      dayOfWeek: preset.dayOfWeek ?? []
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
    setConfig((prev) => ({
      ...prev,
      dayOfWeek: prev.dayOfWeek.includes(day)
        ? prev.dayOfWeek.filter((item) => item !== day)
        : [...prev.dayOfWeek, day]
    }))
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
    void navigator.clipboard.writeText(cronExpression)
    showToast('已复制到剪贴板')
  }, [cronExpression, showToast])

  const copyParserCron = useCallback(() => {
    void navigator.clipboard.writeText(parserInput)
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