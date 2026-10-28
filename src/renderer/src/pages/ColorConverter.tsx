import { useState, useCallback } from 'react'
import { Copy, Check, Palette, RotateCcw } from 'lucide-react'
import { useColorConverter } from '@renderer/tools/color-converter/useColorConverter'
import '../styles/color-converter.css'

// ── Component ──────────────────────────────────────────────────

const SAMPLES = [
  '#6366F1',
  'rgb(59, 130, 246)',
  'hsl(270, 70%, 50%)',
  '#22C55E',
  'rgb(245, 158, 11)'
]

// Helper for sample preview (not in hook because it's UI-specific)
function parseColorForPreview(input: string): string | null {
  const trimmed = input.trim()
  if (/^#[0-9a-fA-F]{3,6}$/.test(trimmed)) return trimmed
  const rgbMatch = trimmed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch
    return `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`
  }
  return null
}

export default function ColorConverter(): React.JSX.Element {
  const { input, setInput, color, clear, loadSample, formatRgb, formatHsl } = useColorConverter()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  const formatRows = color
    ? [
        { key: 'hex', label: 'HEX', value: color.hex },
        { key: 'rgb', label: 'RGB', value: formatRgb(color.rgb) },
        { key: 'hsl', label: 'HSL', value: formatHsl(color.hsl) }
      ]
    : []

  return (
    <div className="cv-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Color Converter</h2>
          <p className="tool-page-desc">HEX、RGB、HSL 之间实时互转，点选示例即可载入。</p>
        </div>
      </header>

      <div className="tool-split cv-layout">
        <div className="cv-main">
          <section className="tool-panel cv-input-panel">
            <div className="cv-input-row">
              <span
                className="cv-input-swatch"
                style={{ background: color?.hex ?? 'transparent' }}
                aria-hidden="true"
              />
              <input
                className="cv-input tool-input tool-input--lg tool-input--mono"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="#6366F1 / rgb(99, 102, 241) / hsl(239, 84%, 67%)"
                aria-label="颜色值"
                autoFocus
                spellCheck={false}
              />
              <button
                type="button"
                className="tool-btn"
                onClick={clear}
                disabled={!input}
                title="清空输入"
              >
                <RotateCcw size={14} aria-hidden="true" />
                清空
              </button>
            </div>

            <div className="cv-samples">
              <span className="cv-samples-label">示例</span>
              {SAMPLES.map((s) => (
                <button key={s} className="cv-sample-btn" onClick={() => loadSample(s)}>
                  <span
                    className="cv-sample-dot"
                    style={{ background: parseColorForPreview(s) ?? 'transparent' }}
                    aria-hidden="true"
                  />
                  {s}
                </button>
              ))}
            </div>

            {input && !color && (
              <div className="cv-error" role="alert">
                <Palette size={15} aria-hidden="true" />
                <span>
                  无法识别该格式，请输入 HEX (#6366F1)、RGB (rgb(99,102,241)) 或 HSL
                  (hsl(239,84%,67%))
                </span>
              </div>
            )}
          </section>

          {color && (
            <section className="tool-panel cv-results">
              <div className="tool-panel-head">
                <h3 className="tool-panel-title">转换结果</h3>
              </div>
              <div className="tool-rows">
                {formatRows.map((row) => (
                  <div className="tool-row" key={row.key}>
                    <div className="tool-row-meta cv-result-meta">
                      <span className="tool-row-label">{row.label}</span>
                      {color.format === row.key && <span className="cv-source-tag">来源</span>}
                    </div>
                    <code className="tool-row-value">{row.value}</code>
                    <button
                      type="button"
                      className="tool-icon-btn"
                      onClick={() => copyToClipboard(row.key, row.value)}
                      title={`复制 ${row.label}`}
                      aria-label={`复制 ${row.label}`}
                    >
                      {copiedKey === row.key ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {color && (
          <section className="tool-panel cv-preview-panel" aria-label="颜色预览">
            <div className="cv-preview-large" style={{ background: color.hex }}>
              <span className="cv-preview-large-hex">{color.hex}</span>
            </div>
            <dl className="cv-preview-meta">
              <div>
                <dt>R</dt>
                <dd>{color.rgb.r}</dd>
              </div>
              <div>
                <dt>G</dt>
                <dd>{color.rgb.g}</dd>
              </div>
              <div>
                <dt>B</dt>
                <dd>{color.rgb.b}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </div>
  )
}
