import { useState, useCallback, useEffect, useRef } from 'react'

export type DisplayMode = 'scroll' | 'static'
export type ScrollDirection = 'left' | 'right' | 'up' | 'down'

export interface DanmakuConfig {
  text: string
  fontSize: number
  fontColor: string
  bgColor: string
  mode: DisplayMode
  direction: ScrollDirection
  speed: number
  returnTimeEnabled: boolean
  returnTimeType: 'none' | 'absolute' | 'relative'
  returnTimeAbsolute: string
  returnTimeRelative: number
  showClock: boolean
}

export interface TemplateItem {
  emoji: string
  text: string
}

export const TEMPLATES: TemplateItem[] = [
  { emoji: '🚽', text: '去洗手间了' },
  { emoji: '☕', text: '休息一下' },
  { emoji: '📋', text: '开会中' },
  { emoji: '😴', text: '午休中' },
  { emoji: '🏃', text: '马上回来' },
  { emoji: '🏢', text: '外出办事' },
  { emoji: '🔇', text: '请勿打扰' },
  { emoji: '⏳', text: '请稍候' },
  { emoji: '🎤', text: '演示中' },
  { emoji: '👋', text: '欢迎光临' }
]

function nowStr(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getTargetTimestamp(
  rt: DanmakuConfig['returnTimeType'],
  abs: string,
  rel: number
): number | null {
  if (rt === 'none') return null
  const now = Date.now()
  if (rt === 'relative') {
    return now + rel * 60 * 1000
  }
  const [h, m] = abs.split(':').map(Number)
  const target = new Date()
  target.setHours(h, m, 0, 0)
  if (target.getTime() <= now) target.setDate(target.getDate() + 1)
  return target.getTime()
}

export function useDanmakuDisplay(): {
  config: DanmakuConfig
  update: <K extends keyof DanmakuConfig>(key: K, value: DanmakuConfig[K]) => void
  isFullscreen: boolean
  enterFullscreen: () => void
  exitFullscreen: () => void
  applyTemplate: (t: TemplateItem) => void
  overlayTime: string
  countdownTotal: number
} {
  const [config, setConfig] = useState<DanmakuConfig>({
    text: '我去厕所了，马上回来 🏃',
    fontSize: 64,
    fontColor: '#FFD700',
    bgColor: '#1A1A2E',
    mode: 'scroll',
    direction: 'left',
    speed: 5,
    returnTimeEnabled: false,
    returnTimeType: 'none',
    returnTimeAbsolute: nowStr(),
    returnTimeRelative: 30,
    showClock: true
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [overlayTime, setOverlayTime] = useState('')
  const [countdownTotal, setCountdownTotal] = useState(0)
  const targetRef = useRef<number | null>(null)

  const update = useCallback(
    <K extends keyof DanmakuConfig>(key: K, value: DanmakuConfig[K]): void => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const applyTemplate = useCallback((t: TemplateItem) => {
    setConfig((prev) => ({ ...prev, text: `${t.emoji} ${t.text}` }))
  }, [])

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false)
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true)
    document.documentElement.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exitFullscreen()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen, exitFullscreen])

  useEffect(() => {
    const handler = (): void => {
      if (!document.fullscreenElement) setIsFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    targetRef.current =
      config.returnTimeEnabled && config.returnTimeType !== 'none'
        ? getTargetTimestamp(
            config.returnTimeType,
            config.returnTimeAbsolute,
            config.returnTimeRelative
          )
        : null
  }, [
    config.returnTimeEnabled,
    config.returnTimeType,
    config.returnTimeAbsolute,
    config.returnTimeRelative
  ])

  useEffect(() => {
    if (!isFullscreen) return
    const tick = setInterval(() => {
      const now = Date.now()
      if (config.showClock) {
        setOverlayTime(nowStr())
      }
      if (targetRef.current !== null) {
        const left = Math.max(0, Math.floor((targetRef.current - now) / 1000))
        setCountdownTotal(left)
      } else {
        setCountdownTotal(0)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [isFullscreen, config.showClock])

  return {
    config,
    update,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    applyTemplate,
    overlayTime,
    countdownTotal
  }
}
