import { Copy, Check, Database, Zap } from 'lucide-react'
import { useConverter, type Unit } from '@renderer/tools/converter/useConverter'

export default function Converter(): React.JSX.Element {
  const {
    mode,
    precision,
    activeUnit,
    toast,
    copiedUnit,
    units,
    values,
    handleInputChange,
    handleModeChange,
    handlePrecisionChange,
    handleQuickConvert,
    handleCopyValue,
    handleCopyAll
  } = useConverter()

  return (
    <div className="converter-page">
      {/* 背景装饰 */}
      <div className="converter-bg-decoration" />

      {/* 主卡片 */}
      <div className="converter-card">
        <div className="converter-hero">
          <div className="converter-header">
            <div className="converter-kicker">
              <Database size={14} />
              Data units
            </div>
            <h2 className="converter-title">Data Size Converter</h2>
            <p className="converter-subtitle">输入一个数值，实时换算常用数据大小单位。</p>
          </div>
        </div>

        <div className="converter-workbench">
          <section className="converter-main-panel">
            {/* 分段控制器 */}
            <div className="converter-segment">
              <button
                className={`converter-segment-btn ${mode === 'decimal' ? 'active' : ''}`}
                onClick={() => handleModeChange('decimal')}
              >
                <span className="converter-segment-label">Decimal</span>
                <span className="converter-segment-hint">1000</span>
              </button>
              <button
                className={`converter-segment-btn ${mode === 'binary' ? 'active' : ''}`}
                onClick={() => handleModeChange('binary')}
              >
                <span className="converter-segment-label">Binary</span>
                <span className="converter-segment-hint">1024</span>
              </button>
            </div>

            {/* 输入区域 */}
            <div className="converter-inputs">
              {(units as readonly Unit[]).map((unit) => (
                <div
                  key={unit}
                  className={`converter-input-group ${unit === activeUnit ? 'active' : ''}`}
                >
                  <div className="converter-input-label">
                    <span className="converter-unit-name">{unit}</span>
                    <span className="converter-unit-full">
                      {unit === 'B' && 'Bytes'}
                      {unit === 'KB' && 'Kilobytes'}
                      {unit === 'MB' && 'Megabytes'}
                      {unit === 'GB' && 'Gigabytes'}
                      {unit === 'TB' && 'Terabytes'}
                      {unit === 'KiB' && 'Kibibytes'}
                      {unit === 'MiB' && 'Mebibytes'}
                      {unit === 'GiB' && 'Gibibytes'}
                      {unit === 'TiB' && 'Tebibytes'}
                    </span>
                  </div>
                  <div className="converter-input-wrapper">
                    <input
                      type="text"
                      className="converter-input"
                      value={values[unit] || ''}
                      onChange={(e) => handleInputChange(unit, e.target.value)}
                      placeholder="0"
                    />
                    <button
                      className="converter-copy-btn"
                      onClick={() => handleCopyValue(unit)}
                      title="复制数值"
                    >
                      {copiedUnit === unit ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="converter-side-panel">
            {/* 精度选择 + 复制全部 */}
            <div className="converter-actions">
              <div className="converter-precision">
                <span className="converter-precision-label">结果精度</span>
                <div className="converter-precision-options">
                  {[2, 4, 6, 8].map((p) => (
                    <button
                      key={p}
                      className={`converter-precision-btn ${precision === p ? 'active' : ''}`}
                      onClick={() =>
                        handlePrecisionChange({
                          target: { value: String(p) }
                        } as React.ChangeEvent<HTMLSelectElement>)
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button className="converter-copy-all" onClick={handleCopyAll}>
                <Copy size={14} />
                复制全部
              </button>
            </div>

            {/* 快捷转换 */}
            <div className="converter-shortcuts">
              <div className="converter-shortcuts-title">
                <Zap size={13} />
                快捷转换
              </div>
              <div className="converter-shortcuts-list">
                {[
                  { from: '1', unit: 'KB' as Unit, label: '1 KB → B' },
                  { from: '1024', unit: 'KB' as Unit, label: '1024 KB → MB' },
                  { from: '1024', unit: 'MB' as Unit, label: '1024 MB → GB' },
                  { from: '1', unit: 'GB' as Unit, label: '1 GB → MB' },
                  { from: '1', unit: 'TB' as Unit, label: '1 TB → GB' },
                  { from: '1', unit: 'GiB' as Unit, label: '1 GiB → MiB' }
                ].map((item) => (
                  <button
                    key={item.label}
                    className="converter-pill"
                    onClick={() => handleQuickConvert(item.from, item.unit)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="converter-reference">
              <div className="converter-reference-title">Binary vs Decimal</div>
              <div className="converter-reference-row">
                <span>Binary</span>
                <strong>1 KiB = 1024 B</strong>
              </div>
              <div className="converter-reference-row">
                <span>Decimal</span>
                <strong>1 KB = 1000 B</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="converter-toast">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
