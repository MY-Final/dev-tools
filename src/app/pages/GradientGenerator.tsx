import { useState, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/gradient-generator.css'

type GradientDirection = 'to right' | 'to left' | 'to bottom' | 'to top' | 'to bottom right' | 'to bottom left' | 'to top right' | 'to top left'

const DIRECTIONS: GradientDirection[] = ['to right', 'to left', 'to bottom', 'to top', 'to bottom right', 'to bottom left', 'to top right', 'to top left']
const DIR_LABELS: Record<string, string> = { 'to right': '→', 'to left': '←', 'to bottom': '↓', 'to top': '↑', 'to bottom right': '↘', 'to bottom left': '↙', 'to top right': '↗', 'to top left': '↖' }

const PRESETS: [string, string, string][] = [
  ['#6366F1', '#8B5CF6', '夕阳紫'],
  ['#3B82F6', '#06B6D4', '海洋蓝'],
  ['#22C55E', '#10B981', '翡翠绿'],
  ['#F59E0B', '#F97316', '落日橙'],
  ['#EC4899', '#F43F5E', '玫瑰粉'],
  ['#8B5CF6', '#EC4899', '晚霞紫'],
]

export default function GradientGenerator(): React.JSX.Element {
  const [color1, setColor1] = useState('#6366F1')
  const [color2, setColor2] = useState('#8B5CF6')
  const [direction, setDirection] = useState<GradientDirection>('to bottom right')
  const [copied, setCopied] = useState(false)

  const gradientCss = `background: linear-gradient(${direction}, ${color1}, ${color2});`
  const gradientStyle = { background: `linear-gradient(${direction}, ${color1}, ${color2})` }

  const loadPreset = useCallback((c1: string, c2: string) => {
    setColor1(c1); setColor2(c2)
  }, [])

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(gradientCss); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }, [gradientCss])

  const reset = useCallback(() => {
    setColor1('#6366F1'); setColor2('#8B5CF6'); setDirection('to bottom right')
  }, [])

  // Validate hex color
  const normalizeColor = useCallback((val: string): string => {
    let hex = val.replace(/^#/, '')
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return '#' + hex.toUpperCase()
    if (/^[0-9a-fA-F]{3}$/.test(hex)) return '#' + hex.split('').map(c => c + c).join('').toUpperCase()
    return ''
  }, [])

  return (
    <div className="gg-page">
      <div className="gg-card">
        <div className="gg-header">
          <h2 className="gg-title">CSS Gradient Generator</h2>
          <p className="gg-subtitle">可视化渐变生成器</p>
        </div>

        <div className="gg-preview" style={gradientStyle} />

        <div className="gg-controls">
          <div className="gg-color-row">
            {([
              { label: 'Color 1', val: color1, set: setColor1 },
              { label: 'Color 2', val: color2, set: setColor2 },
            ]).map((c) => (
              <div key={c.label} className="gg-color-picker">
                <span className="gg-color-label">{c.label}</span>
                <div className="gg-color-row-item">
                  <span className="gg-color-swatch" style={{ background: c.val }} />
                  <input
                    className="gg-color-input-text"
                    value={c.val}
                    onChange={(e) => c.set(e.target.value)}
                    onBlur={(e) => {
                      const normalized = normalizeColor(e.target.value)
                      if (normalized) c.set(normalized)
                    }}
                    placeholder="#000000"
                    spellCheck={false}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="gg-direction">
            <span className="gg-direction-label">方向</span>
            <div className="gg-direction-grid">
              {DIRECTIONS.map((d) => (
                <button key={d} className={`gg-dir-btn ${direction === d ? 'active' : ''}`} onClick={() => setDirection(d)} title={d}>
                  {DIR_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="gg-presets">
          <span className="gg-presets-label">预设</span>
          <div className="gg-preset-grid">
            {PRESETS.map(([c1, c2, label]) => (
              <button key={label} className="gg-preset-btn" onClick={() => loadPreset(c1, c2)} title={label}>
                <span className="gg-preset-swatch" style={{ background: `linear-gradient(to right, ${c1}, ${c2})` }} />
                <span className="gg-preset-name">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gg-output">
          <div className="gg-output-header">
            <span className="gg-output-label">CSS</span>
            <div className="gg-output-actions">
              <button className="gg-btn" onClick={reset}><RotateCcw size={13} />重置</button>
              <button className="gg-btn gg-btn-primary" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button>
            </div>
          </div>
          <pre className="gg-output-code">{gradientCss}</pre>
        </div>
      </div>
    </div>
  )
}
