import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Info } from 'lucide-react'

interface CharInfo {
  char: string
  codePoint: number
  hex: string
  decimal: number
  octal: string
  binary: string
  utf8: string
  utf16: string
  utf32: string
  htmlEntity: string
  htmlHex: string
  cssEscape: string
  jsEscape: string
  category: string
  name: string
  block: string
}

const UNICODE_CATEGORIES: Record<string, string> = {
  Lu: 'Letter, Uppercase',
  Ll: 'Letter, Lowercase',
  Lt: 'Letter, Titlecase',
  Lm: 'Letter, Modifier',
  Lo: 'Letter, Other',
  Mn: 'Mark, Nonspacing',
  Mc: 'Mark, Spacing Combining',
  Me: 'Mark, Enclosing',
  Nd: 'Number, Decimal Digit',
  Nl: 'Number, Letter',
  No: 'Number, Other',
  Pc: 'Punctuation, Connector',
  Pd: 'Punctuation, Dash',
  Ps: 'Punctuation, Open',
  Pe: 'Punctuation, Close',
  Pi: 'Punctuation, Initial Quote',
  Pf: 'Punctuation, Final Quote',
  Po: 'Punctuation, Other',
  Sm: 'Symbol, Math',
  Sc: 'Symbol, Currency',
  Sk: 'Symbol, Modifier',
  So: 'Symbol, Other',
  Zs: 'Separator, Space',
  Zl: 'Separator, Line',
  Zp: 'Separator, Paragraph',
  Cc: 'Control',
  Cf: 'Format',
  Cs: 'Surrogate',
  Co: 'Private Use',
  Cn: 'Unassigned'
}

// Known Unicode blocks
const UNICODE_BLOCKS: Array<[number, number, string]> = [
  [0x0000, 0x007f, 'Basic Latin'],
  [0x0080, 0x00ff, 'Latin-1 Supplement'],
  [0x0100, 0x017f, 'Latin Extended-A'],
  [0x0180, 0x024f, 'Latin Extended-B'],
  [0x0250, 0x02af, 'IPA Extensions'],
  [0x0300, 0x036f, 'Combining Diacritical Marks'],
  [0x0370, 0x03ff, 'Greek and Coptic'],
  [0x0400, 0x04ff, 'Cyrillic'],
  [0x0500, 0x052f, 'Cyrillic Supplement'],
  [0x0530, 0x058f, 'Armenian'],
  [0x0590, 0x05ff, 'Hebrew'],
  [0x0600, 0x06ff, 'Arabic'],
  [0x0900, 0x097f, 'Devanagari'],
  [0x0980, 0x09ff, 'Bengali'],
  [0x0e00, 0x0e7f, 'Thai'],
  [0x1100, 0x11ff, 'Hangul Jamo'],
  [0x2000, 0x206f, 'General Punctuation'],
  [0x2070, 0x209f, 'Superscripts and Subscripts'],
  [0x20a0, 0x20cf, 'Currency Symbols'],
  [0x2100, 0x214f, 'Letterlike Symbols'],
  [0x2190, 0x21ff, 'Arrows'],
  [0x2200, 0x22ff, 'Mathematical Operators'],
  [0x2300, 0x23ff, 'Miscellaneous Technical'],
  [0x2500, 0x257f, 'Box Drawing'],
  [0x2580, 0x259f, 'Block Elements'],
  [0x25a0, 0x25ff, 'Geometric Shapes'],
  [0x2600, 0x26ff, 'Miscellaneous Symbols'],
  [0x2700, 0x27bf, 'Dingbats'],
  [0x2e80, 0x2eff, 'CJK Radicals Supplement'],
  [0x3000, 0x303f, 'CJK Symbols and Punctuation'],
  [0x3040, 0x309f, 'Hiragana'],
  [0x30a0, 0x30ff, 'Katakana'],
  [0x3100, 0x312f, 'Bopomofo'],
  [0x4e00, 0x9fff, 'CJK Unified Ideographs'],
  [0xac00, 0xd7af, 'Hangul Syllables'],
  [0xf900, 0xfaff, 'CJK Compatibility Ideographs'],
  [0xfe00, 0xfe0f, 'Variation Selectors'],
  [0xfe30, 0xfe4f, 'CJK Compatibility Forms'],
  [0xff00, 0xffef, 'Halfwidth and Fullwidth Forms'],
  [0x1f600, 0x1f64f, 'Emoticons'],
  [0x1f300, 0x1f5ff, 'Miscellaneous Symbols and Pictographs'],
  [0x1f680, 0x1f6ff, 'Transport and Map Symbols'],
  [0x1f900, 0x1f9ff, 'Supplemental Symbols and Pictographs']
]

function getBlock(cp: number): string {
  for (const [start, end, name] of UNICODE_BLOCKS) {
    if (cp >= start && cp <= end) return name
  }
  return 'Unknown Block'
}

function getUtf8Hex(cp: number): string {
  const bytes: number[] = []
  if (cp <= 0x7f) {
    bytes.push(cp)
  } else if (cp <= 0x7ff) {
    bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
  } else if (cp <= 0xffff) {
    bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  } else {
    bytes.push(
      0xf0 | (cp >> 18),
      0x80 | ((cp >> 12) & 0x3f),
      0x80 | ((cp >> 6) & 0x3f),
      0x80 | (cp & 0x3f)
    )
  }
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

function getUtf16Hex(cp: number): string {
  if (cp <= 0xffff) {
    return cp.toString(16).toUpperCase().padStart(4, '0')
  }
  const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800
  const lo = ((cp - 0x10000) % 0x400) + 0xdc00
  return `${hi.toString(16).toUpperCase().padStart(4, '0')} ${lo.toString(16).toUpperCase().padStart(4, '0')}`
}

function getCategory(cp: number): string {
  // Note: only detects basic ASCII ranges; CJK, emoji, Arabic etc. fall through to 'Other'
  if (cp >= 0x41 && cp <= 0x5a) return UNICODE_CATEGORIES['Lu']
  if (cp >= 0x61 && cp <= 0x7a) return UNICODE_CATEGORIES['Ll']
  if (cp >= 0x30 && cp <= 0x39) return UNICODE_CATEGORIES['Nd']
  if (cp < 0x20 || cp === 0x7f) return UNICODE_CATEGORIES['Cc']
  if (cp >= 0x80 && cp <= 0x9f) return UNICODE_CATEGORIES['Cc']
  return 'Other'
}

function analyzeChar(char: string): CharInfo | null {
  if (!char) return null
  const cp = char.codePointAt(0)
  if (cp === undefined) return null

  const hex = cp.toString(16).toUpperCase().padStart(4, '0')
  const isPrintable = cp >= 0x20 && cp !== 0x7f && cp < 0x80
  const name = isPrintable ? char : `U+${hex}`

  return {
    char,
    codePoint: cp,
    hex: `U+${hex}`,
    decimal: cp,
    octal: cp.toString(8),
    binary: cp.toString(2).padStart(Math.ceil(cp.toString(2).length / 8) * 8, '0'),
    utf8: getUtf8Hex(cp),
    utf16: getUtf16Hex(cp),
    utf32: cp.toString(16).toUpperCase().padStart(8, '0'),
    htmlEntity: cp >= 0x20 && cp <= 0x7e ? `&#${cp};` : `&#x${hex};`,
    htmlHex: `&#x${hex};`,
    cssEscape: `\\${hex}`,
    jsEscape: cp <= 0xffff ? `\\u${hex}` : `\\u{${hex}}`,
    category: getCategory(cp),
    name,
    block: getBlock(cp)
  }
}

interface InfoRowProps {
  label: string
  value: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
}

function InfoRow({ label, value, copiedKey, onCopy }: InfoRowProps): React.JSX.Element {
  const key = `${label}:${value}`
  return (
    <div className="ui-info-row">
      <span className="ui-info-label">{label}</span>
      <code className="ui-info-value">{value}</code>
      <button className="ui-copy-btn" onClick={() => onCopy(value, key)} title="复制">
        {copiedKey === key ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}

export default function UnicodeInspector(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const chars = useMemo(() => {
    if (!input) return []
    // Spread to properly handle surrogate pairs (emoji etc.)
    return [...input]
  }, [input])

  const selectedChar = useMemo(() => {
    if (chars.length === 0) return null
    return analyzeChar(chars[0])
  }, [chars])

  const allChars = useMemo(() => {
    return chars.map((c) => analyzeChar(c)).filter(Boolean) as CharInfo[]
  }, [chars])

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="ui-page">
      <div className="ui-card">
        <div className="ui-header">
          <h2 className="ui-title">Unicode Inspector</h2>
          <p className="ui-subtitle">输入字符，查看详细 Unicode 信息</p>
        </div>

        <div className="ui-input-area">
          <div className="ui-input-header">
            <span className="ui-input-label">输入字符或字符串</span>
            <div className="ui-samples">
              {['A', '中', 'Ω', '🎉', '∑', '⚡'].map((s) => (
                <button key={s} className="ui-sample-btn" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <input
            className="ui-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入任意字符..."
            autoFocus
          />
        </div>

        {allChars.length > 1 && (
          <div className="ui-char-list">
            <span className="ui-char-list-label">
              <Info size={12} />
              检测到 {allChars.length} 个字符，显示第一个的详情
            </span>
            <div className="ui-char-chips">
              {allChars.map((info, i) => (
                <button
                  key={i}
                  className={`ui-char-chip ${i === 0 ? 'active' : ''}`}
                  onClick={() => setInput(info.char)}
                  title={info.hex}
                >
                  {info.char}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedChar && (
          <>
            <div className="ui-preview">
              <span className="ui-preview-char">{selectedChar.char}</span>
              <div className="ui-preview-meta">
                <span className="ui-preview-hex">{selectedChar.hex}</span>
                <span className="ui-preview-cat">{selectedChar.category}</span>
              </div>
            </div>

            <div className="ui-info-section">
              <div className="ui-section-title">基本信息</div>
              <InfoRow
                label="Code Point"
                value={selectedChar.hex}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="Decimal"
                value={String(selectedChar.decimal)}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="Octal"
                value={selectedChar.octal}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="Binary"
                value={selectedChar.binary}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="Category"
                value={selectedChar.category}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="Block"
                value={selectedChar.block}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
            </div>

            <div className="ui-info-section">
              <div className="ui-section-title">编码</div>
              <InfoRow
                label="UTF-8"
                value={selectedChar.utf8}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="UTF-16"
                value={selectedChar.utf16}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="UTF-32"
                value={selectedChar.utf32}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
            </div>

            <div className="ui-info-section">
              <div className="ui-section-title">转义序列</div>
              <InfoRow
                label="HTML Entity"
                value={selectedChar.htmlEntity}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="HTML Hex"
                value={selectedChar.htmlHex}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="CSS"
                value={selectedChar.cssEscape}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="JavaScript"
                value={selectedChar.jsEscape}
                copiedKey={copiedKey}
                onCopy={copyToClipboard}
              />
            </div>
          </>
        )}

        {!input && <div className="ui-empty">输入一个字符开始分析</div>}
      </div>
    </div>
  )
}
