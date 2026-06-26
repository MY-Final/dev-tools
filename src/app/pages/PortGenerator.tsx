import { useState, useCallback } from 'react'
import { Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react'

type RangeType = 'dynamic' | 'registered' | 'well-known' | 'custom'

interface RangeConfig {
  id: RangeType
  label: string
  desc: string
  min: number
  max: number
  warning?: boolean
}

const RANGES: RangeConfig[] = [
  { id: 'dynamic', label: 'Dynamic / Private', desc: '49152 - 65535', min: 49152, max: 65535 },
  { id: 'registered', label: 'Registered', desc: '1024 - 49151', min: 1024, max: 49151 },
  { id: 'well-known', label: 'Well Known', desc: '0 - 1023', min: 0, max: 1023, warning: true },
  { id: 'custom', label: 'Custom', desc: '自定义范围', min: 0, max: 65535 }
]

const COMMON_PORTS = new Set([
  21, 22, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 5432, 6379, 8080, 8443, 9200, 27017
])

const COUNT_PRESETS = [1, 10, 50, 100]

function generatePorts(min: number, max: number, count: number, excludeCommon: boolean): number[] {
  const ports = new Set<number>()
  const maxAttempts = count * 10
  let attempts = 0

  while (ports.size < count && attempts < maxAttempts) {
    const port = Math.floor(Math.random() * (max - min + 1)) + min
    if (!excludeCommon || !COMMON_PORTS.has(port)) {
      ports.add(port)
    }
    attempts++
  }

  return Array.from(ports)
}

function getPortClassification(port: number): string {
  if (port <= 1023) return 'Well Known'
  if (port <= 49151) return 'Registered'
  return 'Dynamic / Private'
}

function getPortStatus(port: number): string {
  if (COMMON_PORTS.has(port)) return '常用服务端口，可能冲突'
  if (port <= 1023) return '需要管理员权限'
  if (port <= 49151) return '可用于自定义服务'
  return '推荐用于本地开发'
}

export default function PortGenerator(): React.JSX.Element {
  const [rangeType, setRangeType] = useState<RangeType>('dynamic')
  const [customMin, setCustomMin] = useState('10000')
  const [customMax, setCustomMax] = useState('20000')
  const [excludeCommon, setExcludeCommon] = useState(true)
  const [count, setCount] = useState(1)
  const [ports, setPorts] = useState<number[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const getRange = useCallback((): { min: number; max: number } => {
    if (rangeType === 'custom') {
      return {
        min: Math.max(0, Math.min(65535, parseInt(customMin) || 0)),
        max: Math.max(0, Math.min(65535, parseInt(customMax) || 65535))
      }
    }
    const range = RANGES.find((r) => r.id === rangeType)!
    return { min: range.min, max: range.max }
  }, [rangeType, customMin, customMax])

  const generate = useCallback(() => {
    const { min, max } = getRange()
    if (min >= max) return
    const newPorts = generatePorts(min, max, count, excludeCommon)
    setPorts(newPorts)
  }, [getRange, count, excludeCommon])

  const copyPort = useCallback(async (port: number, index: number) => {
    try {
      await navigator.clipboard.writeText(port.toString())
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const copyAll = useCallback(async () => {
    if (ports.length === 0) return
    try {
      await navigator.clipboard.writeText(ports.join('\n'))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      // fallback
    }
  }, [ports])

  const selectedRange = RANGES.find((r) => r.id === rangeType)!

  return (
    <div className="pg2-page">
      <div className="pg2-card">
        <div className="pg2-header">
          <h2 className="pg2-title">Random Port Generator</h2>
          <p className="pg2-subtitle">生成随机网络端口号，适用于本地开发和测试</p>
        </div>

        <div className="pg2-section">
          <span className="pg2-section-label">端口范围</span>
          <div className="pg2-ranges">
            {RANGES.map((range) => (
              <label
                key={range.id}
                className={`pg2-range ${rangeType === range.id ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="range"
                  checked={rangeType === range.id}
                  onChange={() => setRangeType(range.id)}
                />
                <div className="pg2-range-content">
                  <span className="pg2-range-label">{range.label}</span>
                  <span className="pg2-range-desc">{range.desc}</span>
                </div>
              </label>
            ))}
          </div>

          {selectedRange.warning && (
            <div className="pg2-warning">
              <AlertTriangle size={14} />
              <span>Well Known 端口可能需要管理员权限</span>
            </div>
          )}

          {rangeType === 'custom' && (
            <div className="pg2-custom-range">
              <div className="pg2-custom-input">
                <label>起始端口</label>
                <input
                  type="number"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  min={0}
                  max={65535}
                />
              </div>
              <span className="pg2-custom-sep">-</span>
              <div className="pg2-custom-input">
                <label>结束端口</label>
                <input
                  type="number"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  min={0}
                  max={65535}
                />
              </div>
            </div>
          )}
        </div>

        <div className="pg2-section">
          <div className="pg2-options-row">
            <label className="pg2-checkbox">
              <input
                type="checkbox"
                checked={excludeCommon}
                onChange={(e) => setExcludeCommon(e.target.checked)}
              />
              <span className="pg2-check-mark" />
              <span>排除常用端口</span>
            </label>
            <span className="pg2-common-hint">21, 22, 80, 443, 3306, 6379, 8080...</span>
          </div>
        </div>

        <div className="pg2-section">
          <span className="pg2-section-label">生成数量</span>
          <div className="pg2-count-presets">
            {COUNT_PRESETS.map((c) => (
              <button
                key={c}
                className={`pg2-count-btn ${count === c ? 'active' : ''}`}
                onClick={() => setCount(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="pg2-actions">
          <button className="pg2-generate-btn" onClick={generate}>
            <RefreshCw size={15} />
            生成端口
          </button>
          {ports.length > 0 && (
            <button className="pg2-copy-all-btn" onClick={copyAll}>
              {copiedAll ? <Check size={15} /> : <Copy size={15} />}
              {copiedAll ? '已复制' : '复制全部'}
            </button>
          )}
        </div>

        {ports.length > 0 && (
          <div className="pg2-results">
            <div className="pg2-results-grid">
              {ports.map((port, i) => (
                <div key={i} className="pg2-port-item" onClick={() => copyPort(port, i)}>
                  <span className="pg2-port-number">{port}</span>
                  <span className="pg2-port-class">{getPortClassification(port)}</span>
                  {copiedIndex === i && (
                    <span className="pg2-copied-badge">
                      <Check size={12} />
                    </span>
                  )}
                </div>
              ))}
            </div>

            {count === 1 && ports.length === 1 && (
              <div className="pg2-port-info">
                <div className="pg2-info-row">
                  <span className="pg2-info-label">分类</span>
                  <span className="pg2-info-value">{getPortClassification(ports[0])}</span>
                </div>
                <div className="pg2-info-row">
                  <span className="pg2-info-label">状态</span>
                  <span className="pg2-info-value">{getPortStatus(ports[0])}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
