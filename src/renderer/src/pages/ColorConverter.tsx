import { useState, useCallback } from 'react'
import { Copy, Check, Palette, RotateCcw } from 'lucide-react'
import { useColorConverter } from '@renderer/tools/color-converter/useColorConverter'
import '../styles/color-converter.css'

// ── Component ──────────────────────────────────────────────────

const SAMPLES = ['#6366F1', 'rgb(59, 130, 246)', 'hsl(270, 70%, 50%)', '#22C55E', 'rgb(245, 158, 11)']

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

  return (
    <div className="cv-page">
      <div className="cv-card">
        <div className="cv-header">
          <h2 className="cv-title">Color Converter</h2>
          <p className="cv-subtitle">颜色格式转换 · HEX ↔ RGB ↔ HSL</p>
        </div>

        <div className="cv-input-area">
          <div className="cv-input-header">
            <span className="cv-input-label">输入颜色值</span>
            <div className="cv-samples">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  className="cv-sample-btn"
                  onClick={() => loadSample(s)}
                  style={{
                    borderLeft:
                      i < 3 ? `3px solid ${parseColorForPreview(s) ?? 'transparent'}` : undefined
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="cv-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入颜色值，支持 HEX / RGB / HSL 格式..."
            rows={2}
            autoFocus
          />
        </div>

        <div className="cv-actions-bar">
          <button className="cv-btn cv-btn-ghost" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {color && (
          <div className="cv-result-area">
            {/* Color preview */}
            <div className="cv-preview" style={{ background: color.hex }}>
              <div className="cv-preview-hex">{color.hex}</div>
            </div>

            {/* Result cards */}
            <div className="cv-results">
              <div className={`cv-result-card ${color.format === 'hex' ? 'cv-result-source' : ''}`}>
                <div className="cv-result-header">
                  <span className="cv-result-badge">HEX</span>
                  {color.format === 'hex' && <span className="cv-result-tag">输入</span>}
                </div>
                <code className="cv-result-value">{color.hex}</code>
                <button
                  className="cv-icon-btn"
                  title="复制 HEX"
                  onClick={() => copyToClipboard('hex', color.hex)}
                >
                  {copiedKey === 'hex' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div className={`cv-result-card ${color.format === 'rgb' ? 'cv-result-source' : ''}`}>
                <div className="cv-result-header">
                  <span className="cv-result-badge">RGB</span>
                  {color.format === 'rgb' && <span className="cv-result-tag">输入</span>}
                </div>
                <code className="cv-result-value">{formatRgb(color.rgb)}</code>
                <button
                  className="cv-icon-btn"
                  title="复制 RGB"
                  onClick={() => copyToClipboard('rgb', formatRgb(color.rgb))}
                >
                  {copiedKey === 'rgb' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div className={`cv-result-card ${color.format === 'hsl' ? 'cv-result-source' : ''}`}>
                <div className="cv-result-header">
                  <span className="cv-result-badge">HSL</span>
                  {color.format === 'hsl' && <span className="cv-result-tag">输入</span>}
                </div>
                <code className="cv-result-value">{formatHsl(color.hsl)}</code>
                <button
                  className="cv-icon-btn"
                  title="复制 HSL"
                  onClick={() => copyToClipboard('hsl', formatHsl(color.hsl))}
                >
                  {copiedKey === 'hsl' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {input && !color && (
          <div className="cv-error">
            <Palette size={16} />
            <span>无法识别颜色格式，请输入 HEX (#6366F1)、RGB (rgb(99,102,241)) 或 HSL (hsl(239,84%,67%))</span>
          </div>
        )}
      </div>
    </div>
  )
}
