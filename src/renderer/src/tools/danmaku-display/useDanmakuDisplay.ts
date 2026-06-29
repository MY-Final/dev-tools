import { useState, useCallback, useEffect } from 'react'

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
}

const DEFAULT_CONFIG: DanmakuConfig = {
  text: '我去厕所了，马上回来 🏃',
  fontSize: 64,
  fontColor: '#FFD700',
  bgColor: '#1A1A2E',
  mode: 'scroll',
  direction: 'left',
  speed: 5
}

export function useDanmakuDisplay(): {
  config: DanmakuConfig
  update: <K extends keyof DanmakuConfig>(key: K, value: DanmakuConfig[K]) => void
  isFullscreen: boolean
  enterFullscreen: () => void
  exitFullscreen: () => void
} {
  const [config, setConfig] = useState<DanmakuConfig>({ ...DEFAULT_CONFIG })
  const [isFullscreen, setIsFullscreen] = useState(false)

  const update = useCallback(
    <K extends keyof DanmakuConfig>(key: K, value: DanmakuConfig[K]): void => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

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

  return { config, update, isFullscreen, enterFullscreen, exitFullscreen }
}
