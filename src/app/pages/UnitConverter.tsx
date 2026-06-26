import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/unit-converter.css'

// ── Unit definitions ───────────────────────────────────────────

interface UnitDef {
  symbol: string
  name: string
  /** Conversion factor to base unit (multiply value by this to get base) */
  toBase: number | ((v: number) => number)
  /** Conversion factor from base unit (multiply base by this to get unit) */
  fromBase: number | ((v: number) => number)
}

interface CategoryDef {
  id: string
  label: string
  icon: string
  base: string
  units: UnitDef[]
}

// Temperature needs special linear conversion
const tempToBase: Record<string, (v: number) => number> = {
  '°C': (v) => v,
  '°F': (v) => (v - 32) * 5 / 9,
  'K': (v) => v - 273.15
}
const tempFromBase: Record<string, (v: number) => number> = {
  '°C': (v) => v,
  '°F': (v) => v * 9 / 5 + 32,
  'K': (v) => v + 273.15
}

const linear = (factor: number) => ({ toBase: factor, fromBase: 1 / factor })

const CATEGORIES: CategoryDef[] = [
  {
    id: 'length', label: '长度', icon: '📏', base: 'm',
    units: [
      { symbol: 'km', name: '千米', ...linear(1000) },
      { symbol: 'm', name: '米', ...linear(1) },
      { symbol: 'cm', name: '厘米', ...linear(0.01) },
      { symbol: 'mm', name: '毫米', ...linear(0.001) },
      { symbol: 'mi', name: '英里', ...linear(1609.344) },
      { symbol: 'yd', name: '码', ...linear(0.9144) },
      { symbol: 'ft', name: '英尺', ...linear(0.3048) },
      { symbol: 'in', name: '英寸', ...linear(0.0254) }
    ]
  },
  {
    id: 'area', label: '面积', icon: '📐', base: 'm²',
    units: [
      { symbol: 'km²', name: '平方千米', ...linear(1_000_000) },
      { symbol: 'ha', name: '公顷', ...linear(10_000) },
      { symbol: 'm²', name: '平方米', ...linear(1) },
      { symbol: 'cm²', name: '平方厘米', ...linear(0.0001) },
      { symbol: 'mm²', name: '平方毫米', ...linear(0.000001) },
      { symbol: 'acre', name: '英亩', ...linear(4046.856) },
      { symbol: 'ft²', name: '平方英尺', ...linear(0.092903) }
    ]
  },
  {
    id: 'volume', label: '体积', icon: '🧊', base: 'L',
    units: [
      { symbol: 'm³', name: '立方米', ...linear(1000) },
      { symbol: 'L', name: '升', ...linear(1) },
      { symbol: 'mL', name: '毫升', ...linear(0.001) },
      { symbol: 'gal', name: '加仑(美)', ...linear(3.78541) },
      { symbol: 'qt', name: '夸脱', ...linear(0.946353) },
      { symbol: 'pt', name: '品脱', ...linear(0.473176) },
      { symbol: 'fl oz', name: '液盎司', ...linear(0.0295735) },
      { symbol: 'in³', name: '立方英寸', ...linear(0.0163871) }
    ]
  },
  {
    id: 'time', label: '时间', icon: '⏱️', base: 's',
    units: [
      { symbol: 'yr', name: '年', ...linear(31536000) },
      { symbol: 'mon', name: '月(30d)', ...linear(2592000) },
      { symbol: 'wk', name: '周', ...linear(604800) },
      { symbol: 'd', name: '天', ...linear(86400) },
      { symbol: 'h', name: '小时', ...linear(3600) },
      { symbol: 'min', name: '分钟', ...linear(60) },
      { symbol: 's', name: '秒', ...linear(1) },
      { symbol: 'ms', name: '毫秒', ...linear(0.001) },
      { symbol: 'μs', name: '微秒', ...linear(0.000001) }
    ]
  },
  {
    id: 'angle', label: '角度', icon: '📐', base: '°',
    units: [
      { symbol: 'deg', name: '度', ...linear(1) },
      { symbol: 'rad', name: '弧度', ...linear(180 / Math.PI) },
      { symbol: 'grad', name: '百分度', ...linear(0.9) },
      { symbol: 'arcmin', name: '角分', ...linear(1 / 60) },
      { symbol: 'arcsec', name: '角秒', ...linear(1 / 3600) }
    ]
  },
  {
    id: 'speed', label: '速度', icon: '🏃', base: 'm/s',
    units: [
      { symbol: 'km/h', name: '千米/时', ...linear(1 / 3.6) },
      { symbol: 'm/s', name: '米/秒', ...linear(1) },
      { symbol: 'mph', name: '英里/时', ...linear(0.44704) },
      { symbol: 'kn', name: '节', ...linear(0.514444) },
      { symbol: 'ft/s', name: '英尺/秒', ...linear(0.3048) }
    ]
  },
  {
    id: 'temperature', label: '温度', icon: '🌡️', base: '°C',
    units: [
      {
        symbol: '°C', name: '摄氏度',
        toBase: tempToBase['°C'],
        fromBase: tempFromBase['°C']
      },
      {
        symbol: '°F', name: '华氏度',
        toBase: tempToBase['°F'],
        fromBase: tempFromBase['°F']
      },
      {
        symbol: 'K', name: '开尔文',
        toBase: tempToBase['K'],
        fromBase: tempFromBase['K']
      }
    ]
  },
  {
    id: 'pressure', label: '压力', icon: '💨', base: 'Pa',
    units: [
      { symbol: 'MPa', name: '兆帕', ...linear(1_000_000) },
      { symbol: 'kPa', name: '千帕', ...linear(1000) },
      { symbol: 'Pa', name: '帕斯卡', ...linear(1) },
      { symbol: 'bar', name: '巴', ...linear(100_000) },
      { symbol: 'atm', name: '标准大气压', ...linear(101_325) },
      { symbol: 'psi', name: '磅/平方英寸', ...linear(6894.76) },
      { symbol: 'mmHg', name: '毫米汞柱', ...linear(133.322) }
    ]
  },
  {
    id: 'energy', label: '热量/能量', icon: '🔥', base: 'J',
    units: [
      { symbol: 'MJ', name: '兆焦', ...linear(1_000_000) },
      { symbol: 'kJ', name: '千焦', ...linear(1000) },
      { symbol: 'J', name: '焦耳', ...linear(1) },
      { symbol: 'kcal', name: '千卡', ...linear(4184) },
      { symbol: 'cal', name: '卡路里', ...linear(4.184) },
      { symbol: 'Wh', name: '瓦时', ...linear(3600) },
      { symbol: 'kWh', name: '千瓦时', ...linear(3_600_000) },
      { symbol: 'BTU', name: '英热单位', ...linear(1055.06) }
    ]
  },
  {
    id: 'power', label: '功率', icon: '⚡', base: 'W',
    units: [
      { symbol: 'MW', name: '兆瓦', ...linear(1_000_000) },
      { symbol: 'kW', name: '千瓦', ...linear(1000) },
      { symbol: 'W', name: '瓦特', ...linear(1) },
      { symbol: 'hp', name: '马力(英)', ...linear(745.7) },
      { symbol: 'hp-m', name: '马力(公)', ...linear(735.5) },
      { symbol: 'BTU/h', name: 'BTU/时', ...linear(0.293071) }
    ]
  }
]

// ── Helpers ────────────────────────────────────────────────────

function toNum(v: number | ((v: number) => number), val: number): number {
  return typeof v === 'function' ? v(val) : val * v
}

function formatResult(n: number): string {
  if (Math.abs(n) < 1e-15) return '0'
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6)
  if (Number.isInteger(n) && Math.abs(n) < 1e9) return n.toLocaleString('en-US')
  // Up to 10 significant digits
  const s = n.toPrecision(10)
  // Remove trailing zeros after decimal
  if (s.includes('.')) {
    const trimmed = s.replace(/\.?0+$/, '')
    if (trimmed.includes('e')) return n.toExponential(6)
    return trimmed
  }
  return s
}

// ── Component ──────────────────────────────────────────────────

export default function UnitConverter(): React.JSX.Element {
  const [activeCat, setActiveCat] = useState('length')
  const [input, setInput] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const category = useMemo(() => CATEGORIES.find((c) => c.id === activeCat)!, [activeCat])

  const numValue = useMemo(() => {
    if (!input.trim()) return null
    const n = parseFloat(input)
    return isNaN(n) ? null : n
  }, [input])

  const results = useMemo(() => {
    if (numValue === null) return null
    const baseValue = toNum(category.units[0].toBase, numValue)
    return category.units.map((u) => {
      const fromBase = toNum(u.fromBase, baseValue)
      return { ...u, value: formatResult(fromBase) }
    })
  }, [numValue, category])

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  const clear = useCallback(() => setInput(''), [])

  return (
    <div className="uc-page">
      <div className="uc-card">
        <div className="uc-header">
          <h2 className="uc-title">Unit Converter</h2>
          <p className="uc-subtitle">单位换算 — 长度 · 面积 · 体积 · 时间 · 角度 · 速度 · 温度 · 压力 · 热量 · 功率</p>
        </div>

        {/* Category tabs */}
        <div className="uc-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`uc-tab ${activeCat === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCat(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="uc-input-area">
          <div className="uc-input-row">
            <input
              className="uc-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入数值..."
              autoFocus
            />
            <span className="uc-input-unit">{category.units[0].symbol}</span>
          </div>
          <button className="uc-btn uc-btn-ghost" onClick={clear}>
            <RotateCcw size={13} />
            清空
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="uc-results">
            <span className="uc-result-label">
              基准单位：<strong>{category.units[0].symbol}</strong> ({category.units[0].name})
            </span>
            <div className="uc-result-grid">
              {results.map((u) => (
                <div key={u.symbol} className="uc-result-item">
                  <div className="uc-result-info">
                    <span className="uc-result-symbol">{u.symbol}</span>
                    <span className="uc-result-name">{u.name}</span>
                  </div>
                  <div className="uc-result-right">
                    <code className="uc-result-value">{u.value}</code>
                    <button
                      className="uc-copy-btn"
                      title="复制"
                      onClick={() => copyToClipboard(u.symbol, u.value)}
                    >
                      {copiedKey === u.symbol ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
