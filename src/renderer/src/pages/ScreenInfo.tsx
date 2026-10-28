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
  const [copiedAll, setCopiedAll] = useState(false)

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
    {
      key: 'devicePixelRatio',
      label: '设备像素比 (DPR)',
      value: screenData.devicePixelRatio.toString()
    },
    { key: 'dpi', label: '预估 DPI', value: `${screenData.dpi} PPI (DPR × 96)` },
    { key: 'orientation', label: '屏幕方向', value: screenData.orientation },
    { key: 'isTouchScreen', label: '触摸屏', value: screenData.isTouchScreen ? '是' : '否' },
    {
      key: 'viewportWidth',
      label: '视口宽度 (CSS px)',
      value: screenData.viewportWidth.toString()
    },
    {
      key: 'viewportHeight',
      label: '视口高度 (CSS px)',
      value: screenData.viewportHeight.toString()
    },
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
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
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
    <div className="si-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Screen Info</h2>
          <p className="tool-page-desc">屏幕分辨率、可用区域、DPI、色彩深度与窗口信息。</p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn" onClick={copyAll}>
            {copiedAll ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copiedAll ? '已复制' : '复制全部'}
          </button>
          <button type="button" className="tool-btn tool-btn--outline" onClick={refresh}>
            <RefreshCw size={14} aria-hidden="true" />
            刷新
          </button>
        </div>
      </header>

      <section className="tool-panel si-summary">
        <div className="si-summary-item">
          <span className="si-summary-label">物理像素</span>
          <span className="si-summary-value">{physicalPixels}</span>
        </div>
        <div className="si-summary-item">
          <span className="si-summary-label">CSS 视口</span>
          <span className="si-summary-value">{cssPixels}</span>
        </div>
        <div className="si-summary-item">
          <span className="si-summary-label">设备像素比</span>
          <span className="si-summary-value">{screenData.devicePixelRatio}×</span>
        </div>
        <div className="si-summary-item">
          <span className="si-summary-label">屏幕方向</span>
          <span className="si-summary-value si-summary-value--sm">{screenData.orientation}</span>
        </div>
      </section>

      <section className="tool-panel si-fields-panel">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">详细参数</h3>
          <span className="si-field-count">{fields.length} 项</span>
        </div>
        <div className="si-fields">
          {fields.map((f) => (
            <div key={f.key} className="si-field">
              <span className="si-field-label">{f.label}</span>
              <span className="si-field-value" title={f.value}>
                {f.value}
              </span>
              <button
                type="button"
                className="tool-icon-btn si-field-copy"
                onClick={() => copyField(f.key, f.value)}
                aria-label={`复制${f.label}`}
                title={`复制${f.label}`}
              >
                {copiedKey === f.key ? (
                  <Check size={12} aria-hidden="true" />
                ) : (
                  <Copy size={12} aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
