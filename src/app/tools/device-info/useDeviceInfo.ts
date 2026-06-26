import { useState, useCallback, useEffect } from 'react'

export interface ScreenInfo {
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  pixelRatio: number
  colorDepth: number
  orientation: string
  angle: number
}

export interface BrowserInfo {
  userAgent: string
  vendor: string
  language: string
  timezone: string
  cookieEnabled: boolean
  javaScriptEnabled: boolean
}

export interface SystemInfo {
  platform: string
  os: string
  cpuCores: number
  memory: number | null
  touchSupport: boolean
  maxTouchPoints: number
}

export interface NetworkInfo {
  type: string
  downlink: number | null
  rtt: number | null
  online: boolean
}

export interface LocationInfo {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  ipBased: boolean
}

export interface BatteryInfo {
  level: number | null
  charging: boolean | null
  chargingTime: number | null
  dischargingTime: number | null
  supported: boolean
}

export interface HardwareInfo {
  cpuCores: number
  memory: number | null
  maxTouchPoints: number
  webgl: boolean
  webgpu: boolean
}

export interface CapabilityInfo {
  webgl: boolean
  webgpu: boolean
  webrtc: boolean
  websocket: boolean
  serviceWorker: boolean
  indexedDB: boolean
  localStorage: boolean
  sessionStorage: boolean
  clipboardAPI: boolean
}

export interface DeviceInfo {
  screen: ScreenInfo
  browser: BrowserInfo
  system: SystemInfo
  network: NetworkInfo
  location: LocationInfo
  battery: BatteryInfo
  hardware: HardwareInfo
  capabilities: CapabilityInfo
}

function getOS(): string {
  const ua = navigator.userAgent
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown'
}

function getBrowserName(): string {
  const ua = navigator.userAgent
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
  return 'Unknown'
}

function detectCapabilities(): CapabilityInfo {
  return {
    webgl: !!document.createElement('canvas').getContext('webgl'),
    webgpu: 'gpu' in navigator,
    webrtc: !!(
      window.RTCPeerConnection ||
      (window as unknown as { webkitRTCPeerConnection?: unknown }).webkitRTCPeerConnection
    ),
    websocket: 'WebSocket' in window,
    serviceWorker: 'serviceWorker' in navigator,
    indexedDB: 'indexedDB' in window,
    localStorage: 'localStorage' in window,
    sessionStorage: 'sessionStorage' in window,
    clipboardAPI: 'clipboard' in navigator
  }
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useDeviceInfo() {
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  const getScreenInfo = useCallback((): ScreenInfo => {
    return {
      screenWidth: screen.width,
      screenHeight: screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      colorDepth: screen.colorDepth,
      orientation: screen.orientation?.type || 'unknown',
      angle: screen.orientation?.angle || 0
    }
  }, [])

  const getBrowserInfo = useCallback((): BrowserInfo => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor || 'Unknown',
      language: navigator.language,
      timezone: tz,
      cookieEnabled: navigator.cookieEnabled,
      javaScriptEnabled: true
    }
  }, [])

  const getSystemInfo = useCallback((): SystemInfo => {
    return {
      platform: navigator.platform || 'Unknown',
      os: getOS(),
      cpuCores: navigator.hardwareConcurrency || 0,
      memory: (navigator as { deviceMemory?: number }).deviceMemory || null,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      maxTouchPoints: navigator.maxTouchPoints || 0
    }
  }, [])

  const getNetworkInfo = useCallback((): NetworkInfo => {
    const conn = (
      navigator as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }
    ).connection
    return {
      type: conn?.effectiveType || 'unknown',
      downlink: conn?.downlink || null,
      rtt: conn?.rtt || null,
      online: navigator.onLine
    }
  }, [])

  const getBatteryInfo = useCallback(async (): Promise<BatteryInfo> => {
    if (!('getBattery' in navigator)) {
      return {
        level: null,
        charging: null,
        chargingTime: null,
        dischargingTime: null,
        supported: false
      }
    }
    try {
      const battery = await (
        navigator as unknown as {
          getBattery?: () => Promise<{
            level: number
            charging: boolean
            chargingTime: number
            dischargingTime: number
          }>
        }
      ).getBattery?.()
      if (!battery) {
        return {
          level: null,
          charging: null,
          chargingTime: null,
          dischargingTime: null,
          supported: false
        }
      }
      return {
        level: Math.round(battery.level * 100),
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
        supported: true
      }
    } catch {
      return {
        level: null,
        charging: null,
        chargingTime: null,
        dischargingTime: null,
        supported: false
      }
    }
  }, [])

  const getHardwareInfo = useCallback((): HardwareInfo => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    return {
      cpuCores: navigator.hardwareConcurrency || 0,
      memory: (navigator as { deviceMemory?: number }).deviceMemory || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      webgl: !!gl,
      webgpu: 'gpu' in navigator
    }
  }, [])

  const fetchLocationByIp = useCallback(async () => {
    try {
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      if (data.latitude && !data.error) {
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                location: {
                  latitude: data.latitude,
                  longitude: data.longitude,
                  accuracy: null,
                  error: null,
                  ipBased: true
                }
              }
            : null
        )
        return true
      }
    } catch {
      // IP fallback failed
    }
    return false
  }, [])

  const fetchLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              location: {
                latitude: null,
                longitude: null,
                accuracy: null,
                error: '浏览器不支持地理位置',
                ipBased: false
              }
            }
          : null
      )
      return
    }

    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                location: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  error: null,
                  ipBased: false
                }
              }
            : null
        )
        setLocationLoading(false)
      },
      async (error) => {
        // If browser geolocation fails, try IP-based fallback
        const ipSuccess = await fetchLocationByIp()
        if (!ipSuccess) {
          setInfo((prev) =>
            prev
              ? {
                  ...prev,
                  location: {
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    error: error.message,
                    ipBased: false
                  }
                }
              : null
          )
        }
        setLocationLoading(false)
      },
      { timeout: 5000 }
    )
  }, [fetchLocationByIp])

  const loadDeviceInfo = useCallback(async () => {
    setLoading(true)

    const screenInfo = getScreenInfo()
    const browserInfo = getBrowserInfo()
    const systemInfo = getSystemInfo()
    const networkInfo = getNetworkInfo()
    const hardwareInfo = getHardwareInfo()
    const capabilities = detectCapabilities()
    const batteryInfo = await getBatteryInfo()

    setInfo({
      screen: screenInfo,
      browser: browserInfo,
      system: systemInfo,
      network: networkInfo,
      location: { latitude: null, longitude: null, accuracy: null, error: null, ipBased: false },
      battery: batteryInfo,
      hardware: hardwareInfo,
      capabilities
    })

    setLoading(false)
  }, [
    getScreenInfo,
    getBrowserInfo,
    getSystemInfo,
    getNetworkInfo,
    getHardwareInfo,
    getBatteryInfo
  ])

  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadDeviceInfo()
    }
    init()

    const handleResize = (): void => {
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              screen: getScreenInfo()
            }
          : null
      )
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [loadDeviceInfo, getScreenInfo])

  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text)
      showToast('已复制')
    },
    [showToast]
  )

  const handleCopyAll = useCallback(() => {
    if (!info) return
    const data = {
      browser: getBrowserName() + ' ' + info.browser.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '',
      os: info.system.os,
      screen: `${info.screen.screenWidth}x${info.screen.screenHeight}`,
      window: `${info.screen.windowWidth}x${info.screen.windowHeight}`,
      pixelRatio: info.screen.pixelRatio,
      language: info.browser.language,
      timezone: info.browser.timezone,
      cpuCores: info.hardware.cpuCores,
      memory: info.hardware.memory ? `${info.hardware.memory}GB` : 'Unknown',
      online: info.network.online,
      networkType: info.network.type,
      battery: info.battery.level !== null ? `${info.battery.level}%` : 'Unknown',
      capabilities: info.capabilities
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    showToast('已复制全部信息')
  }, [info, showToast])

  const handleExport = useCallback(() => {
    if (!info) return
    const data = {
      screen: info.screen,
      browser: info.browser,
      system: info.system,
      network: info.network,
      location: info.location,
      battery: info.battery,
      hardware: info.hardware,
      capabilities: info.capabilities
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'device-info.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出 JSON')
  }, [info, showToast])

  return {
    info,
    loading,
    toast,
    locationLoading,
    fetchLocation,
    handleCopy,
    handleCopyAll,
    handleExport,
    refresh: loadDeviceInfo
  }
}
