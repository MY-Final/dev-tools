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
  block: string
}

// Injecting a long paragraph would otherwise build one chip, one info object and
// one DOM button per code point on every keystroke.
const MAX_INPUT_LENGTH = 300

interface GraphemeInfo {
  grapheme: string
  codePoints: CharInfo[]
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

// Unicode general categories ordered from specific to broad; `String.prototype`
// property escapes resolve them for every script without a hand-written table.
const CATEGORY_PATTERNS: Record<string, RegExp> = {
  Lu: /\p{Lu}/u,
  Ll: /\p{Ll}/u,
  Lt: /\p{Lt}/u,
  Lm: /\p{Lm}/u,
  Lo: /\p{Lo}/u,
  Mn: /\p{Mn}/u,
  Mc: /\p{Mc}/u,
  Me: /\p{Me}/u,
  Nd: /\p{Nd}/u,
  Nl: /\p{Nl}/u,
  No: /\p{No}/u,
  Pc: /\p{Pc}/u,
  Pd: /\p{Pd}/u,
  Ps: /\p{Ps}/u,
  Pe: /\p{Pe}/u,
  Pi: /\p{Pi}/u,
  Pf: /\p{Pf}/u,
  Po: /\p{Po}/u,
  Sm: /\p{Sm}/u,
  Sc: /\p{Sc}/u,
  Sk: /\p{Sk}/u,
  So: /\p{So}/u,
  Zs: /\p{Zs}/u,
  Zl: /\p{Zl}/u,
  Zp: /\p{Zp}/u,
  Cc: /\p{Cc}/u,
  Cf: /\p{Cf}/u,
  Cs: /\p{Cs}/u,
  Co: /\p{Co}/u,
  Cn: /\p{Cn}/u
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
  return '未收录（内置常用区段之外）'
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
  // Intl.Segmenter and the Unicode property escapes cover every script; fall back
  // to the built-in description table when a code point matches no class.
  const char = String.fromCodePoint(cp)
  for (const [key, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(char)) return UNICODE_CATEGORIES[key] ?? key
  }
  return '未分类 (Cn)'
}

function analyzeChar(char: string): CharInfo | null {
  if (!char) return null
  const cp = char.codePointAt(0)
  if (cp === undefined) return null

  const hex = cp.toString(16).toUpperCase().padStart(4, '0')

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
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const graphemes = useMemo((): GraphemeInfo[] => {
    if (!input) return []
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const result: GraphemeInfo[] = []
    for (const { segment } of segmenter.segment(input)) {
      const codePoints = Array.from(segment)
        .map((c) => analyzeChar(c))
        .filter((info): info is CharInfo => info !== null)
      if (codePoints.length > 0) result.push({ grapheme: segment, codePoints })
    }
    return result
  }, [input])

  const allChars = useMemo(() => graphemes.flatMap((grapheme) => grapheme.codePoints), [graphemes])

  const selectedChar = allChars[Math.min(selectedIndex, allChars.length - 1)] ?? null

  const updateInput = useCallback((value: string) => {
    setInput(value.slice(0, MAX_INPUT_LENGTH))
    setSelectedIndex(0)
  }, [])

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
          <p className="ui-subtitle">
            查看码点、UTF-8/16 编码、Unicode 分类与转义序列；按字形分组，组合字符可作为整体分析
          </p>
        </div>

        <div className="ui-input-area">
          <div className="ui-input-header">
            <span className="ui-input-label">输入字符或字符串</span>
            <div className="ui-samples">
              {['A', '中', 'Ω', '🎉', '∑', '⚡'].map((s) => (
                <button key={s} className="ui-sample-btn" onClick={() => updateInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <input
            className="ui-input"
            type="text"
            value={input}
            onChange={(e) => updateInput(e.target.value)}
            placeholder="输入任意字符..."
            autoFocus
          />
        </div>

        {graphemes.length > 1 && (
          <div className="ui-char-list">
            <span className="ui-char-list-label">
              <Info size={12} />共 {graphemes.length} 个字符 · {allChars.length} 个码点，当前查看第{' '}
              {Math.min(selectedIndex + 1, allChars.length)} 个
            </span>
            <div className="ui-char-chips">
              {graphemes.map((grapheme, i) => {
                const offset = graphemes
                  .slice(0, i)
                  .reduce((sum, item) => sum + item.codePoints.length, 0)
                return (
                  <button
                    key={`${grapheme.grapheme}-${i}`}
                    className={`ui-char-chip ${offset === selectedIndex ? 'active' : ''}`}
                    onClick={() => setSelectedIndex(offset)}
                    title={`${grapheme.codePoints.map((c) => c.hex).join(' ')}${grapheme.codePoints.length > 1 ? ` · ${grapheme.codePoints.length} 个码点` : ''}`}
                  >
                    {grapheme.grapheme}
                  </button>
                )
              })}
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
