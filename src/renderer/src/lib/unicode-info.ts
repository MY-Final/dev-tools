/**
 * Pure helpers for the Unicode Inspector. No React, no DOM.
 *
 * Character names are deliberately not provided: they need the full UnicodeData.txt
 * name database, which this app does not ship. Block names come from the curated
 * table below; anything outside it is reported as 未收录区段 rather than guessed.
 */

export const MAX_INSPECT_CODE_POINTS = 300

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const UTF8_ENCODER = new TextEncoder()

export const NAME_UNAVAILABLE_NOTE = '本地不可用（未内置 Unicode 名称数据库）'

export interface CodePointInfo {
  codePoint: number
  /** 'U+4E2D' style, at least four hex digits. */
  hex: string
  decimal: number
  /** Two-letter general category such as 'Lo'. Use categoryName() for the label. */
  category: string
  block: string
  /** Space-separated uppercase bytes, e.g. 'E4 B8 AD'. Lone surrogates encode as U+FFFD. */
  utf8: string
  /** Space-separated UTF-16 code units, e.g. 'D83D DE00'. */
  utf16: string
  /** Hexadecimal numeric character reference, e.g. '&#x4E2D;'. */
  htmlEntity: string
  /** '中' inside the BMP, '\u{1F389}' outside it. */
  jsEscape: string
  /** '\4E2D ' with a trailing space, which terminates the escape as CSS requires. */
  cssEscape: string
  /** Percent-encoded UTF-8, e.g. '%E4%B8%AD'. */
  urlEncoded: string
}

export interface NormalizedForm {
  value: string
  /** True when this form differs from the original text. */
  differs: boolean
}

export interface GraphemeDetail {
  grapheme: string
  codePoints: CodePointInfo[]
  nfc: NormalizedForm
  nfd: NormalizedForm
  nfkc: NormalizedForm
  nfkd: NormalizedForm
  /** Contains a combining mark (\p{M}). Variation selectors are not counted. */
  isCombining: boolean
  /** Contains Extended_Pictographic, an emoji modifier or a regional indicator. Approximate. */
  isEmoji: boolean
  isRegionalIndicator: boolean
  /** Estimated terminal cell width. See estimateDisplayWidth(). */
  displayWidth: number
}

export interface DetailField {
  label: string
  value: string
}

export function capCodePoints(text: string): { text: string; truncated: boolean } {
  const chars = Array.from(text)
  if (chars.length <= MAX_INSPECT_CODE_POINTS) return { text, truncated: false }
  return { text: chars.slice(0, MAX_INSPECT_CODE_POINTS).join(''), truncated: true }
}

export function segmentGraphemes(text: string): string[] {
  if (!text) return []
  return Array.from(GRAPHEME_SEGMENTER.segment(text), (item) => item.segment)
}

function hexDigits(value: number, minWidth = 4): string {
  return value.toString(16).toUpperCase().padStart(minWidth, '0')
}

export function formatCodePointHex(codePoint: number): string {
  return `U+${hexDigits(codePoint)}`
}

// ---------------------------------------------------------------------------
// General category
// ---------------------------------------------------------------------------

const CATEGORY_TESTS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Lu', /\p{Lu}/u],
  ['Ll', /\p{Ll}/u],
  ['Lt', /\p{Lt}/u],
  ['Lm', /\p{Lm}/u],
  ['Lo', /\p{Lo}/u],
  ['Mn', /\p{Mn}/u],
  ['Mc', /\p{Mc}/u],
  ['Me', /\p{Me}/u],
  ['Nd', /\p{Nd}/u],
  ['Nl', /\p{Nl}/u],
  ['No', /\p{No}/u],
  ['Pc', /\p{Pc}/u],
  ['Pd', /\p{Pd}/u],
  ['Ps', /\p{Ps}/u],
  ['Pe', /\p{Pe}/u],
  ['Pi', /\p{Pi}/u],
  ['Pf', /\p{Pf}/u],
  ['Po', /\p{Po}/u],
  ['Sm', /\p{Sm}/u],
  ['Sc', /\p{Sc}/u],
  ['Sk', /\p{Sk}/u],
  ['So', /\p{So}/u],
  ['Zs', /\p{Zs}/u],
  ['Zl', /\p{Zl}/u],
  ['Zp', /\p{Zp}/u],
  ['Cc', /\p{Cc}/u],
  ['Cf', /\p{Cf}/u],
  ['Cs', /\p{Cs}/u],
  ['Co', /\p{Co}/u],
  ['Cn', /\p{Cn}/u]
]

/** Returns the two-letter general category of a single code point. */
export function getGeneralCategory(char: string): string {
  for (const [code, pattern] of CATEGORY_TESTS) {
    if (pattern.test(char)) return code
  }
  return 'Cn'
}

const CATEGORY_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['Lu', '大写字母'],
  ['Ll', '小写字母'],
  ['Lt', '首字母大写'],
  ['Lm', '修饰字母'],
  ['Lo', '其它字母'],
  ['Mn', '非间距标记'],
  ['Mc', '间距组合标记'],
  ['Me', '封闭标记'],
  ['Nd', '十进制数字'],
  ['Nl', '字母数字'],
  ['No', '其它数字'],
  ['Pc', '连接标点'],
  ['Pd', '破折号'],
  ['Ps', '开括号'],
  ['Pe', '闭括号'],
  ['Pi', '起始引号'],
  ['Pf', '结束引号'],
  ['Po', '其它标点'],
  ['Sm', '数学符号'],
  ['Sc', '货币符号'],
  ['Sk', '修饰符号'],
  ['So', '其它符号'],
  ['Zs', '空格分隔符'],
  ['Zl', '行分隔符'],
  ['Zp', '段分隔符'],
  ['Cc', '控制字符'],
  ['Cf', '格式字符'],
  ['Cs', '代理项'],
  ['Co', '私用区'],
  ['Cn', '未赋值']
])

export function categoryName(code: string): string {
  return CATEGORY_NAMES.get(code) ?? code
}

export type CategoryGroup =
  | 'letter'
  | 'mark'
  | 'number'
  | 'punctuation'
  | 'symbol'
  | 'separator'
  | 'other'

export const CATEGORY_GROUP_ORDER: ReadonlyArray<CategoryGroup> = [
  'letter',
  'mark',
  'number',
  'punctuation',
  'symbol',
  'separator',
  'other'
]

export const CATEGORY_GROUP_LABELS: Readonly<Record<CategoryGroup, string>> = {
  letter: '字母 (L)',
  mark: '标记 (M)',
  number: '数字 (N)',
  punctuation: '标点 (P)',
  symbol: '符号 (S)',
  separator: '空白与分隔 (Z)',
  other: '控制、格式与其它 (C)'
}

export function categoryGroupOf(code: string): CategoryGroup {
  switch (code.charAt(0)) {
    case 'L':
      return 'letter'
    case 'M':
      return 'mark'
    case 'N':
      return 'number'
    case 'P':
      return 'punctuation'
    case 'S':
      return 'symbol'
    case 'Z':
      return 'separator'
    default:
      return 'other'
  }
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/**
 * Curated block table, sorted by start, non-overlapping. Names and ranges follow the
 * Unicode Blocks.txt naming. Only a subset of the ~330 blocks is listed; everything
 * else reports 未收录区段. Note that Regional Indicator Symbols (1F1E6-1F1FF) is not a
 * separate block; it lives inside "Enclosed Alphanumeric Supplement".
 */
export const UNICODE_BLOCKS: ReadonlyArray<readonly [number, number, string]> = [
  [0x0000, 0x007f, 'Basic Latin'],
  [0x0080, 0x00ff, 'Latin-1 Supplement'],
  [0x0100, 0x017f, 'Latin Extended-A'],
  [0x0180, 0x024f, 'Latin Extended-B'],
  [0x0250, 0x02af, 'IPA Extensions'],
  [0x02b0, 0x02ff, 'Spacing Modifier Letters'],
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
  [0x1e00, 0x1eff, 'Latin Extended Additional'],
  [0x1f00, 0x1fff, 'Greek Extended'],
  [0x2000, 0x206f, 'General Punctuation'],
  [0x2070, 0x209f, 'Superscripts and Subscripts'],
  [0x20a0, 0x20cf, 'Currency Symbols'],
  [0x2100, 0x214f, 'Letterlike Symbols'],
  [0x2150, 0x218f, 'Number Forms'],
  [0x2190, 0x21ff, 'Arrows'],
  [0x2200, 0x22ff, 'Mathematical Operators'],
  [0x2300, 0x23ff, 'Miscellaneous Technical'],
  [0x2460, 0x24ff, 'Enclosed Alphanumerics'],
  [0x2500, 0x257f, 'Box Drawing'],
  [0x2580, 0x259f, 'Block Elements'],
  [0x25a0, 0x25ff, 'Geometric Shapes'],
  [0x2600, 0x26ff, 'Miscellaneous Symbols'],
  [0x2700, 0x27bf, 'Dingbats'],
  [0x2b00, 0x2bff, 'Miscellaneous Symbols and Arrows'],
  [0x2e80, 0x2eff, 'CJK Radicals Supplement'],
  [0x2f00, 0x2fdf, 'Kangxi Radicals'],
  [0x3000, 0x303f, 'CJK Symbols and Punctuation'],
  [0x3040, 0x309f, 'Hiragana'],
  [0x30a0, 0x30ff, 'Katakana'],
  [0x3100, 0x312f, 'Bopomofo'],
  [0x3130, 0x318f, 'Hangul Compatibility Jamo'],
  [0x31a0, 0x31bf, 'Bopomofo Extended'],
  [0x31f0, 0x31ff, 'Katakana Phonetic Extensions'],
  [0x3400, 0x4dbf, 'CJK Unified Ideographs Extension A'],
  [0x4e00, 0x9fff, 'CJK Unified Ideographs'],
  [0xac00, 0xd7af, 'Hangul Syllables'],
  [0xd800, 0xdb7f, 'High Surrogates'],
  [0xdb80, 0xdbff, 'High Private Use Surrogates'],
  [0xdc00, 0xdfff, 'Low Surrogates'],
  [0xe000, 0xf8ff, 'Private Use Area'],
  [0xf900, 0xfaff, 'CJK Compatibility Ideographs'],
  [0xfb00, 0xfb4f, 'Alphabetic Presentation Forms'],
  [0xfb50, 0xfdff, 'Arabic Presentation Forms-A'],
  [0xfe00, 0xfe0f, 'Variation Selectors'],
  [0xfe10, 0xfe1f, 'Vertical Forms'],
  [0xfe20, 0xfe2f, 'Combining Half Marks'],
  [0xfe30, 0xfe4f, 'CJK Compatibility Forms'],
  [0xfe50, 0xfe6f, 'Small Form Variants'],
  [0xfe70, 0xfeff, 'Arabic Presentation Forms-B'],
  [0xff00, 0xffef, 'Halfwidth and Fullwidth Forms'],
  [0xfff0, 0xffff, 'Specials'],
  [0x1d400, 0x1d7ff, 'Mathematical Alphanumeric Symbols'],
  [0x1f100, 0x1f1ff, 'Enclosed Alphanumeric Supplement'],
  [0x1f300, 0x1f5ff, 'Miscellaneous Symbols and Pictographs'],
  [0x1f600, 0x1f64f, 'Emoticons'],
  [0x1f680, 0x1f6ff, 'Transport and Map Symbols'],
  [0x1f900, 0x1f9ff, 'Supplemental Symbols and Pictographs'],
  [0x1fa70, 0x1faff, 'Symbols and Pictographs Extended-A'],
  [0xe0000, 0xe007f, 'Tags'],
  [0xe0100, 0xe01ef, 'Variation Selectors Supplement'],
  [0xf0000, 0xfffff, 'Supplementary Private Use Area-A'],
  [0x100000, 0x10ffff, 'Supplementary Private Use Area-B']
]

export function blockName(codePoint: number): string {
  for (const [start, end, name] of UNICODE_BLOCKS) {
    if (codePoint >= start && codePoint <= end) return name
  }
  return '未收录区段'
}

// ---------------------------------------------------------------------------
// Display width
// ---------------------------------------------------------------------------

// Approximate East Asian Wide/Fullwidth ranges (a subset of EastAsianWidth.txt).
// Emoji are handled separately through \p{Emoji_Presentation}.
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd]
]

const ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}]$/u
const EMOJI_PRESENTATION = /^\p{Emoji_Presentation}$/u
const EXTENDED_PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u
const COMBINING_MARK = /^\p{M}$/u
const EMOJI_LIKE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator})$/u
const REGIONAL_INDICATOR = /^\p{Regional_Indicator}$/u

function inRanges(cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  return ranges.some(([start, end]) => cp >= start && cp <= end)
}

function isVariationSelector(cp: number): boolean {
  return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)
}

/**
 * Estimated terminal cell width of one grapheme. This is a heuristic, not a wcwidth port:
 * - zero-width code points (Mn, Me, Cf: ZWJ, variation selectors, lone combining marks) add nothing;
 * - the first visible code point decides the width: 2 for Emoji_Presentation, regional
 *   indicators and the approximate East Asian Wide ranges, otherwise 1;
 * - a text-presentation pictograph followed by U+FE0F is widened to 2.
 * Known inaccuracies: terminals disagree on emoji and ZWJ sequences (many render
 * 👨‍👩‍👧‍👦 as 2 cells, some as 8); ambiguous-width characters (Greek, Cyrillic, box
 * drawing) are 1 here but 2 in CJK locales; Hangul Jamo medial and final forms are 0
 * in some terminals; the wide ranges omit some newer additions.
 */
export function estimateDisplayWidth(grapheme: string): number {
  const visible = Array.from(grapheme).filter((char) => !ZERO_WIDTH.test(char))
  const base = visible[0]
  if (base === undefined) return 0
  const cp = base.codePointAt(0) ?? 0
  if (EMOJI_PRESENTATION.test(base) || inRanges(cp, WIDE_RANGES)) return 2
  if (grapheme.includes(String.fromCodePoint(0xfe0f)) && EXTENDED_PICTOGRAPHIC.test(base)) return 2
  return 1
}

// ---------------------------------------------------------------------------
// Describing graphemes and code points
// ---------------------------------------------------------------------------

function percentEncode(char: string): string {
  try {
    return encodeURIComponent(char)
  } catch {
    // Lone surrogates cannot go through encodeURIComponent; encode their replacement bytes.
    return Array.from(UTF8_ENCODER.encode(char), (b) => `%${hexDigits(b, 2)}`).join('')
  }
}

function describeCodePoint(cp: number): CodePointInfo {
  const char = String.fromCodePoint(cp)
  const bytes = Array.from(UTF8_ENCODER.encode(char))
  const utf16Units = Array.from({ length: char.length }, (_, i) => hexDigits(char.charCodeAt(i)))
  return {
    codePoint: cp,
    hex: formatCodePointHex(cp),
    decimal: cp,
    category: getGeneralCategory(char),
    block: blockName(cp),
    utf8: bytes.map((b) => hexDigits(b, 2)).join(' '),
    utf16: utf16Units.join(' '),
    htmlEntity: `&#x${hexDigits(cp)};`,
    jsEscape: cp <= 0xffff ? `\\u${hexDigits(cp)}` : `\\u{${hexDigits(cp)}}`,
    cssEscape: `\\${cp.toString(16).toUpperCase()} `,
    urlEncoded: percentEncode(char)
  }
}

function normalizedForm(grapheme: string, form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD'): NormalizedForm {
  const value = grapheme.normalize(form)
  return { value, differs: value !== grapheme }
}

/** Describes one grapheme (or any string; flags then apply to the whole string). */
export function describeGrapheme(grapheme: string): GraphemeDetail {
  const chars = Array.from(grapheme)
  const codePoints = chars.map((char) => describeCodePoint(char.codePointAt(0) ?? 0))
  const isCombining = chars.some(
    (char) => COMBINING_MARK.test(char) && !isVariationSelector(char.codePointAt(0) ?? 0)
  )
  const isEmoji = chars.some((char) => EMOJI_LIKE.test(char))
  const isRegionalIndicator = chars.some((char) => REGIONAL_INDICATOR.test(char))
  return {
    grapheme,
    codePoints,
    nfc: normalizedForm(grapheme, 'NFC'),
    nfd: normalizedForm(grapheme, 'NFD'),
    nfkc: normalizedForm(grapheme, 'NFKC'),
    nfkd: normalizedForm(grapheme, 'NFKD'),
    isCombining,
    isEmoji,
    isRegionalIndicator,
    displayWidth: estimateDisplayWidth(grapheme)
  }
}

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

/**
 * Accepts U+4E2D, 0x4e2d, 4E2D (hex, must contain A-F to be read as hex), 20013 (decimal,
 * all digits), or a single grapheme (its first code point). Returns null for empty input,
 * anything out of range (> 0x10FFFF), surrogates (D800-DFFF) and multi-grapheme text.
 */
export function parseCodePointQuery(query: string): number | null {
  const text = query.trim()
  if (!text) return null

  let codePoint: number | null = null
  const prefixed = /^(?:U\+|0x)([0-9a-f]{1,6})$/i.exec(text)
  if (prefixed?.[1]) {
    codePoint = parseInt(prefixed[1], 16)
  } else if (Array.from(text).length === 1) {
    // A single character is taken literally, so "5" means the digit and "A" the letter.
    codePoint = text.codePointAt(0) ?? null
  } else if (/^\d+$/.test(text)) {
    codePoint = Number(text)
  } else if (/^[0-9a-f]+$/i.test(text)) {
    codePoint = parseInt(text, 16)
  } else {
    const graphemes = segmentGraphemes(text)
    if (graphemes.length !== 1) return null
    codePoint = text.codePointAt(0) ?? null
  }

  if (codePoint === null || !Number.isInteger(codePoint)) return null
  if (codePoint < 0 || codePoint > 0x10ffff) return null
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return null
  return codePoint
}

// ---------------------------------------------------------------------------
// Field lists shared by the UI and the plain-text copy
// ---------------------------------------------------------------------------

export const NORMALIZATION_ROWS: ReadonlyArray<{
  label: string
  key: 'nfc' | 'nfd' | 'nfkc' | 'nfkd'
}> = [
  { label: 'NFC', key: 'nfc' },
  { label: 'NFD', key: 'nfd' },
  { label: 'NFKC', key: 'nfkc' },
  { label: 'NFKD', key: 'nfkd' }
]

export function graphemeFields(detail: GraphemeDetail): DetailField[] {
  return [
    { label: '字形', value: detail.grapheme },
    { label: '码点数', value: String(detail.codePoints.length) },
    { label: '显示宽度（估算）', value: String(detail.displayWidth) }
  ]
}

export function normalizationFields(detail: GraphemeDetail): DetailField[] {
  return NORMALIZATION_ROWS.map((row) => ({ label: row.label, value: detail[row.key].value }))
}

export function codePointFields(info: CodePointInfo): DetailField[] {
  return [
    { label: '码点', value: info.hex },
    { label: '十进制', value: String(info.decimal) },
    { label: '分类', value: `${info.category} ${categoryName(info.category)}` },
    { label: '区段', value: info.block },
    { label: 'UTF-8', value: info.utf8 },
    { label: 'UTF-16', value: info.utf16 },
    { label: 'HTML 实体', value: info.htmlEntity },
    { label: 'JavaScript', value: info.jsEscape },
    { label: 'CSS', value: info.cssEscape },
    { label: 'URL 编码', value: info.urlEncoded }
  ]
}

/** Human-readable flags for the grapheme (combining, emoji, regional indicator). */
export function graphemeFlagLabels(detail: GraphemeDetail): string[] {
  const flags: string[] = []
  if (detail.isCombining) flags.push('组合标记')
  if (detail.isEmoji) flags.push('表情符号')
  if (detail.isRegionalIndicator) flags.push('区域指示符')
  return flags
}

/** Plain-text dump of every field, used by the "复制全部字段" action. */
export function formatGraphemeText(detail: GraphemeDetail): string {
  const lines: string[] = []
  for (const field of graphemeFields(detail)) lines.push(`${field.label}: ${field.value}`)
  const flags = graphemeFlagLabels(detail)
  lines.push(`标记: ${flags.length > 0 ? flags.join('、') : '无'}`)
  lines.push(`字符名称: ${NAME_UNAVAILABLE_NOTE}`)
  lines.push('规范化:')
  for (const field of normalizationFields(detail)) lines.push(`  ${field.label}: ${field.value}`)
  detail.codePoints.forEach((info, index) => {
    lines.push('')
    lines.push(`码点 ${index + 1}:`)
    for (const field of codePointFields(info)) lines.push(`  ${field.label}: ${field.value}`)
  })
  return lines.join('\n')
}
