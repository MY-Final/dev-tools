import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Palette, RotateCcw } from 'lucide-react'
import '../styles/color-converter.css'

// ── Color types ────────────────────────────────────────────────

interface RGB {
  r: number
  g: number
  b: number
}

interface HSL {
  h: number
  s: number
  l: number
}

type ColorFormat = 'hex' | 'rgb' | 'hsl'

interface ParsedColor {
  format: ColorFormat
  hex: string
  rgb: RGB
  hsl: HSL
}

// ── Parsers ────────────────────────────────────────────────────

function parseHex(input: string): ParsedColor | null {
  const hex = input.replace(/^#/, '').trim()
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null

  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)

  const hsl = rgbToHsl({ r, g, b })
  return {
    format: 'hex',
    hex: `#${full.toUpperCase()}`,
    rgb: { r, g, b },
    hsl
  }
}

function parseRgb(input: string): ParsedColor | null {
  const match = input.match(
    /rgba?\s*\(\s*(\d{1,3})\s*[,/\s]\s*(\d{1,3})\s*[,/\s]\s*(\d{1,3})\s*(?:[,/\s]\s*[\d.]+)?\s*\)/i
  )
  if (!match) return null
  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)
  if (r > 255 || g > 255 || b > 255) return null

  const hex = rgbToHex({ r, g, b })
  const hsl = rgbToHsl({ r, g, b })
  return { format: 'rgb', hex, rgb: { r, g, b }, hsl }
}

function parseHsl(input: string): ParsedColor | null {
  const match = input.match(
    /hsla?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*[\d.]+)?\s*\)/i
  )
  if (!match) return null
  const h = parseInt(match[1], 10) % 360
  const s = parseInt(match[2], 10)
  const l = parseInt(match[3], 10)
  if (s > 100 || l > 100) return null

  const rgb = hslToRgb({ h, s, l })
  const hex = rgbToHex(rgb)
  return { format: 'hsl', hex, rgb, hsl: { h, s, l } }
}

// ── Converters ─────────────────────────────────────────────────

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === nr) h = ((ng - nb) / delta + (ng < nb ? 6 : 0)) * 60
    else if (max === ng) h = ((nb - nr) / delta + 2) * 60
    else h = ((nr - ng) / delta + 4) * 60
  }

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const ns = s / 100
  const nl = l / 100
  const c = (1 - Math.abs(2 * nl - 1)) * ns
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = nl - c / 2

  let nr = 0, ng = 0, nb = 0
  if (h < 60) { nr = c; ng = x }
  else if (h < 120) { nr = x; ng = c }
  else if (h < 180) { ng = c; nb = x }
  else if (h < 240) { ng = x; nb = c }
  else if (h < 300) { nr = x; nb = c }
  else { nr = c; nb = x }

  return {
    r: Math.round((nr + m) * 255),
    g: Math.round((ng + m) * 255),
    b: Math.round((nb + m) * 255)
  }
}

// ── Auto-detect ────────────────────────────────────────────────

function parseColor(input: string): ParsedColor | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^#/.test(trimmed) || /^[0-9a-fA-F]{3,6}$/.test(trimmed)) {
    return parseHex(trimmed)
  }
  if (/^rgb/i.test(trimmed)) {
    return parseRgb(trimmed)
  }
  if (/^hsl/i.test(trimmed)) {
    return parseHsl(trimmed)
  }
  // Try hex without #
  const hexMatch = parseHex(trimmed)
  if (hexMatch) return hexMatch

  return null
}

// ── Component ──────────────────────────────────────────────────

const SAMPLES = ['#6366F1', 'rgb(59, 130, 246)', 'hsl(270, 70%, 50%)', '#22C55E', 'rgb(245, 158, 11)']

export default function ColorConverter(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const color = useMemo(() => parseColor(input), [input])

  const clear = useCallback(() => setInput(''), [])

  const loadSample = useCallback((sample: string) => {
    setInput(sample)
  }, [])

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  const formatRgb = ({ r, g, b }: RGB): string => `rgb(${r}, ${g}, ${b})`
  const formatHsl = ({ h, s, l }: HSL): string => `hsl(${h}, ${s}%, ${l}%)`

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
                      i < 3
                        ? `3px solid ${parseColor(s)?.hex ?? 'transparent'}`
                        : undefined
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
