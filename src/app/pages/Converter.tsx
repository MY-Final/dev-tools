import { Copy, Check, Info } from 'lucide-react'
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
        {/* Header */}
        <div className="converter-header">
          <h2 className="converter-title">Data Size Converter</h2>
          <p className="converter-subtitle">数据大小单位转换工具</p>
        </div>

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

        {/* 提示框 */}
        <div className="converter-callout">
          <Info size={14} className="converter-callout-icon" />
          <span>在任意输入框输入数值，其他单位自动计算。支持 10mb、512kb 等格式。</span>
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

        {/* 精度选择 + 复制全部 */}
        <div className="converter-actions">
          <div className="converter-precision">
            <span className="converter-precision-label">精度</span>
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
          <div className="converter-shortcuts-title">快捷转换</div>
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
