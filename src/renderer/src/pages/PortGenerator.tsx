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
    <div className="pg2-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Random Port Generator</h2>
          <p className="tool-page-desc">
            按端口区间生成随机端口号，可排除常用服务端口，点击结果即可复制。
          </p>
        </div>
      </header>

      <div className="tool-split pg2-layout">
        <section className="tool-panel pg2-settings">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">生成设置</h3>
          </div>

          <div className="pg2-body">
            <div className="pg2-field">
              <span className="pg2-field-label">端口范围</span>
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
                    <span className="pg2-range-content">
                      <span className="pg2-range-label">{range.label}</span>
                      <span className="pg2-range-desc">{range.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              {selectedRange.warning && (
                <div className="pg2-warning">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>Well Known 端口可能需要管理员权限</span>
                </div>
              )}

              {rangeType === 'custom' && (
                <div className="pg2-custom-range">
                  <label className="pg2-custom-input">
                    <span>起始端口</span>
                    <input
                      className="tool-input tool-input--mono"
                      type="number"
                      value={customMin}
                      onChange={(e) => setCustomMin(e.target.value)}
                      min={0}
                      max={65535}
                    />
                  </label>
                  <span className="pg2-custom-sep">–</span>
                  <label className="pg2-custom-input">
                    <span>结束端口</span>
                    <input
                      className="tool-input tool-input--mono"
                      type="number"
                      value={customMax}
                      onChange={(e) => setCustomMax(e.target.value)}
                      min={0}
                      max={65535}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="pg2-field">
              <label className="pg2-checkbox">
                <input
                  type="checkbox"
                  checked={excludeCommon}
                  onChange={(e) => setExcludeCommon(e.target.checked)}
                />
                <span>排除常用端口</span>
              </label>
              <span className="pg2-common-hint">21, 22, 80, 443, 3306, 6379, 8080…</span>
            </div>

            <div className="pg2-field pg2-field-row">
              <span className="pg2-field-label">生成数量</span>
              <div className="tool-segmented">
                {COUNT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`tool-seg ${count === c ? 'active' : ''}`}
                    aria-pressed={count === c}
                    onClick={() => setCount(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pg2-actions">
            <button type="button" className="tool-btn tool-btn--primary" onClick={generate}>
              <RefreshCw size={15} aria-hidden="true" />
              生成端口
            </button>
          </div>
        </section>

        <section className="tool-panel pg2-results">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">生成结果</h3>
            {ports.length > 0 && (
              <button type="button" className="tool-btn pg2-copy-all" onClick={copyAll}>
                {copiedAll ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                {copiedAll ? '已复制' : '复制全部'}
              </button>
            )}
          </div>

          {ports.length === 0 ? (
            <div className="pg2-empty">设置端口范围与数量后，点击“生成端口”开始。</div>
          ) : (
            <>
              <div className="pg2-results-grid">
                {ports.map((port, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pg2-port-item"
                    onClick={() => copyPort(port, i)}
                    title={`复制端口 ${port}`}
                  >
                    <span className="pg2-port-number">{port}</span>
                    <span className="pg2-port-class">{getPortClassification(port)}</span>
                    {copiedIndex === i && (
                      <span className="pg2-copied-badge">
                        <Check size={12} aria-hidden="true" />
                      </span>
                    )}
                  </button>
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
            </>
          )}
        </section>
      </div>
    </div>
  )
}
