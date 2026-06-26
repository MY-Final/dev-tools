import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import '../styles/screen-info.css'

interface ScreenData {
  width: number
  height: number
  availWidth: number
  availHeight: number
  colorDepth: number
  pixelDepth: number
  devicePixelRatio: number
  dpi: number
  orientation: string
  isTouchScreen: boolean
  viewportWidth: number
  viewportHeight: number
  innerWidth: number
  innerHeight: number
  physicalWidth: string
  physicalHeight: string
  platform: string
  vendor: string
}

function getScreenData(): ScreenData {
  const s = window.screen
  const dpr = window.devicePixelRatio

  return {
    width: s.width,
    height: s.height,
    availWidth: s.availWidth,
    availHeight: s.availHeight,
    colorDepth: s.colorDepth,
    pixelDepth: s.pixelDepth,
    devicePixelRatio: dpr,
    dpi: Math.round(dpr * 96),
    orientation: `${s.orientation?.type ?? 'unknown'} (${s.orientation?.angle ?? 0}°)`,
    isTouchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    physicalWidth: `${(s.width / dpr).toFixed(1)} × ${(s.height / dpr).toFixed(1)} mm (estimated)`,
    physicalHeight: '',
    platform: navigator.platform,
    vendor: navigator.vendor
  }
}

type Field = {
  key: string
  label: string
  value: string
}

export default function ScreenInfo(): React.JSX.Element {
  const [screenData, setScreenData] = useState<ScreenData>(getScreenData)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    const handler = (): void => setScreenData(getScreenData())
    window.addEventListener('resize', handler)
    const mmHandler = (): void => setScreenData(getScreenData())
    matchMedia('(resolution: 1dppx)').addEventListener('change', mmHandler)
    return () => {
      window.removeEventListener('resize', handler)
      matchMedia('(resolution: 1dppx)').removeEventListener('change', mmHandler)
    }
  }, [])

  const fields: Field[] = [
    { key: 'width', label: '屏幕宽度', value: screenData.width.toString() },
    { key: 'height', label: '屏幕高度', value: screenData.height.toString() },
    { key: 'availWidth', label: '可用宽度', value: screenData.availWidth.toString() },
    { key: 'availHeight', label: '可用高度', value: screenData.availHeight.toString() },
    { key: 'colorDepth', label: '色彩深度', value: `${screenData.colorDepth} bits` },
    { key: 'pixelDepth', label: '像素深度', value: `${screenData.pixelDepth} bits` },
    { key: 'devicePixelRatio', label: '设备像素比 (DPR)', value: screenData.devicePixelRatio.toString() },
    { key: 'dpi', label: '预估 DPI', value: `${screenData.dpi} PPI (DPR × 96)` },
    { key: 'orientation', label: '屏幕方向', value: screenData.orientation },
    { key: 'isTouchScreen', label: '触摸屏', value: screenData.isTouchScreen ? '✅ 是' : '❌ 否' },
    { key: 'viewportWidth', label: '视口宽度 (CSS px)', value: screenData.viewportWidth.toString() },
    { key: 'viewportHeight', label: '视口高度 (CSS px)', value: screenData.viewportHeight.toString() },
    { key: 'innerWidth', label: '窗口内宽', value: screenData.innerWidth.toString() },
    { key: 'innerHeight', label: '窗口内高', value: screenData.innerHeight.toString() },
    { key: 'physicalWidth', label: '物理尺寸 (估算)', value: screenData.physicalWidth },
    { key: 'platform', label: '操作系统', value: screenData.platform },
    { key: 'vendor', label: '浏览器引擎', value: screenData.vendor || 'N/A' }
  ]

  const copyField = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const copyAll = useCallback(async () => {
    const text = fields.map((f) => `${f.label}: ${f.value}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }, [fields])

  const refresh = useCallback(() => {
    setScreenData(getScreenData())
  }, [])

  const physicalPixels = `${screenData.width} × ${screenData.height}`
  const cssPixels = `${screenData.viewportWidth} × ${screenData.viewportHeight}`

  return (
    <div className="si-page">
      <div className="si-card">
        <div className="si-header">
          <h2 className="si-title">Screen Info</h2>
          <p className="si-subtitle">屏幕分辨率、DPI、色彩深度信息</p>
        </div>

        {/* Summary banner */}
        <div className="si-summary">
          <div className="si-summary-item">
            <div className="si-summary-label">物理像素</div>
            <div className="si-summary-value si-mono">{physicalPixels}</div>
          </div>
          <div className="si-summary-item">
            <div className="si-summary-label">CSS 视口</div>
            <div className="si-summary-value si-mono">{cssPixels}</div>
          </div>
          <div className="si-summary-item">
            <div className="si-summary-label">DPR</div>
            <div className="si-summary-value si-mono">{screenData.devicePixelRatio}x</div>
          </div>
        </div>

        {/* Fields */}
        <div className="si-fields">
          {fields.map((f) => (
            <div key={f.key} className="si-field">
              <span className="si-field-label">{f.label}</span>
              <span className={`si-field-value ${f.key === 'width' || f.key === 'height' || f.key === 'devicePixelRatio' ? 'si-mono' : ''}`}>
                {f.value}
              </span>
              <button
                className="si-field-copy"
                onClick={() => copyField(f.key, f.value)}
              >
                {copiedKey === f.key ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="si-actions">
          <button className="si-copy-all-btn" onClick={copyAll}>
            <Copy size={14} />
            复制全部
          </button>
          <button className="si-refresh-btn" onClick={refresh}>
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
      </div>
    </div>
  )
}
