import { useState } from 'react'
import { Copy, Check, Zap } from 'lucide-react'
import { useConverter, type Unit } from '@renderer/tools/converter/useConverter'
import '../styles/converter.css'

const UNIT_NAMES: Record<Unit, string> = {
  B: 'Bytes',
  KB: 'Kilobytes',
  MB: 'Megabytes',
  GB: 'Gigabytes',
  TB: 'Terabytes',
  KiB: 'Kibibytes',
  MiB: 'Mebibytes',
  GiB: 'Gibibytes',
  TiB: 'Tebibytes'
}

const BINARY_QUICK: { from: string; unit: Unit; label: string }[] = [
  { from: '1', unit: 'KiB', label: '1 KiB → B' },
  { from: '1024', unit: 'KiB', label: '1024 KiB → MiB' },
  { from: '1024', unit: 'MiB', label: '1024 MiB → GiB' },
  { from: '1', unit: 'GiB', label: '1 GiB → MiB' },
  { from: '1', unit: 'TiB', label: '1 TiB → GiB' }
]

const DECIMAL_QUICK: { from: string; unit: Unit; label: string }[] = [
  { from: '1', unit: 'KB', label: '1 KB → B' },
  { from: '1000', unit: 'KB', label: '1000 KB → MB' },
  { from: '1000', unit: 'MB', label: '1000 MB → GB' },
  { from: '1', unit: 'GB', label: '1 GB → MB' },
  { from: '1', unit: 'TB', label: '1 TB → GB' }
]

export default function Converter(): React.JSX.Element {
  const {
    mode,
    precision,
    activeUnit,
    parsedUnit,
    invalid,
    hasValues,
    activeValue,
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

  // 编辑中的行显示原始输入（支持“10 MB”和长数字），失焦后再显示换算结果。
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const quickConversions = mode === 'binary' ? BINARY_QUICK : DECIMAL_QUICK

  return (
    <div className="converter-page tool-page dsv-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Data Size Converter</h2>
          <p className="tool-page-desc">输入任意一个单位，其余单位实时换算；结果精度可随时调整。</p>
        </div>
        <div className="tool-page-actions">
          <div className="tool-segmented" role="group" aria-label="换算进制">
            <button
              type="button"
              className={`tool-seg ${mode === 'binary' ? 'active' : ''}`}
              aria-pressed={mode === 'binary'}
              onClick={() => handleModeChange('binary')}
            >
              Binary
            </button>
            <button
              type="button"
              className={`tool-seg ${mode === 'decimal' ? 'active' : ''}`}
              aria-pressed={mode === 'decimal'}
              onClick={() => handleModeChange('decimal')}
            >
              Decimal
            </button>
          </div>
          <label className="dsv-precision">
            <span>精度</span>
            <select
              className="tool-select"
              aria-label="结果精度"
              value={precision}
              onChange={handlePrecisionChange}
            >
              {[2, 4, 6, 8].map((p) => (
                <option key={p} value={p}>
                  {p} 位
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={handleCopyAll}
            disabled={!hasValues}
          >
            <Copy size={14} aria-hidden="true" />
            复制全部
          </button>
        </div>
      </header>

      <div className="tool-split dsv-layout">
        <section className="tool-panel dsv-panel" aria-label="单位换算">
          {invalid ? (
            <p className="dsv-note dsv-note--error" role="status">
              请输入有效数值，例如 10 MB 或 1024
            </p>
          ) : parsedUnit !== activeUnit && activeValue.trim() !== '' ? (
            <p className="dsv-note" role="status">
              已按输入的 {parsedUnit} 换算
            </p>
          ) : null}
          <div className="dsv-rows">
            {(units as readonly Unit[]).map((unit) => (
              <div
                key={unit}
                className={`dsv-row ${unit === activeUnit ? 'is-active' : ''}`}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button')) {
                    e.currentTarget.querySelector('input')?.focus()
                  }
                }}
              >
                <label className="dsv-unit" htmlFor={`dsv-${unit}`}>
                  <span className="dsv-symbol">{unit}</span>
                  <span className="dsv-name">{UNIT_NAMES[unit]}</span>
                </label>
                <input
                  id={`dsv-${unit}`}
                  className="dsv-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={
                    unit === activeUnit && (editingUnit === unit || invalid)
                      ? activeValue
                      : values[unit] || ''
                  }
                  onChange={(e) => handleInputChange(unit, e.target.value)}
                  onFocus={() => setEditingUnit(unit)}
                  onBlur={() => setEditingUnit(null)}
                  placeholder="0"
                  aria-label={`${unit} (${UNIT_NAMES[unit]}) 数值`}
                />
                <button
                  type="button"
                  className="tool-icon-btn dsv-copy"
                  onClick={() => handleCopyValue(unit)}
                  title={`复制 ${unit} 数值`}
                  aria-label={`复制 ${unit} 数值`}
                  disabled={!values[unit]}
                >
                  {copiedUnit === unit ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="dsv-aside">
          <section className="dsv-block">
            <h3 className="dsv-block-title">
              <Zap size={13} aria-hidden="true" />
              快捷换算
            </h3>
            <div className="dsv-chips">
              {quickConversions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="dsv-chip"
                  onClick={() => handleQuickConvert(item.from, item.unit)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="dsv-block">
            <h3 className="dsv-block-title">进制说明</h3>
            <dl className="dsv-ref">
              <div className="dsv-ref-row">
                <dt>Binary</dt>
                <dd>1 KiB = 1024 B</dd>
              </div>
              <div className="dsv-ref-row">
                <dt>Decimal</dt>
                <dd>1 KB = 1000 B</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      {toast && (
        <div className="dsv-toast" role="status">
          <Check size={14} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
