/**
 * Case conversion helpers. Pure functions only (no React, no DOM beyond Intl.Segmenter).
 */

type CharKind = 'upper' | 'lower' | 'digit' | 'cjk' | 'mark' | 'sep'

const RE_UPPER = /\p{Lu}|\p{Lt}/u
const RE_LOWER_CASE = /\p{Ll}/u
const RE_CASED = /\p{Lu}|\p{Ll}|\p{Lt}/u
const RE_LETTER = /\p{L}/u
const CJK_RE = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u
const CJK_ALL = new RegExp(CJK_RE.source, 'gu')
// Letters, digits, combining marks and apostrophes. Used for sentence and title casing,
// which keep the original punctuation and spacing.
const WORD_RE = /[\p{L}\p{N}\p{M}'’]+/gu
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function kindOf(ch: string): CharKind {
  if (CJK_RE.test(ch)) return 'cjk'
  if (/\p{M}/u.test(ch)) return 'mark'
  if (RE_UPPER.test(ch)) return 'upper'
  if (RE_LETTER.test(ch)) return 'lower'
  if (/\p{N}/u.test(ch)) return 'digit'
  return 'sep'
}

/** Whether a new word begins between a character of kind `prev` and the next one. */
function startsWord(prev: CharKind | null, kind: CharKind, next: CharKind | undefined): boolean {
  if (prev === null) return false
  if (prev === 'digit') return kind !== 'digit'
  if (kind === 'digit') return true
  if (kind === 'upper') return prev === 'lower' || (prev === 'upper' && next === 'lower')
  return false
}

/**
 * Splits text into words for the identifier formats.
 *
 * - Any character that is not a letter, digit or combining mark separates words. This covers
 *   the listed separators (space, _ - . / \ : , ; + | ~) and also punctuation and quotes.
 * - Boundaries: lower to Upper (fooBar), acronym to capitalized word (XMLHttp), letter to
 *   digit and back (foo2bar, v2api).
 * - Each Han, Kana or Hangul character is its own word, so 你好world gives 你, 好, world.
 *   Naming formats then join those tokens like any other word.
 *
 * Single pass over code points with a fixed lookahead of one character, so no backtracking.
 */
export function splitWords(text: string): string[] {
  const chars = Array.from(text, (ch) => ({ ch, kind: kindOf(ch) }))
  const words: string[] = []
  let current = ''
  let prev: CharKind | null = null

  for (const [i, { ch, kind }] of chars.entries()) {
    if (kind === 'sep' || kind === 'cjk') {
      if (current) words.push(current)
      if (kind === 'cjk') words.push(ch)
      current = ''
      prev = null
    } else if (kind === 'mark') {
      current += ch
    } else {
      if (current && startsWord(prev, kind, chars[i + 1]?.kind)) {
        words.push(current)
        current = ''
      }
      current += ch
      prev = kind
    }
  }
  if (current) words.push(current)
  return words
}

function capitalize(word: string): string {
  return word.toLowerCase().replace(RE_LETTER, (c) => c.toUpperCase())
}

/**
 * Re-cases one word for title and sentence casing.
 * When the input mixes cases, a word with an uppercase letter after its first character is
 * treated as an acronym or deliberate mix (HTTP, iPhone) and kept as typed. Otherwise the
 * word is lowercased. The first letter is uppercased only when `capitalizeFirst` is set.
 */
function recase(word: string, keepCaps: boolean, capitalizeFirst: boolean): string {
  const head = Array.from(word)[0] ?? ''
  const keep = keepCaps && RE_UPPER.test(word.slice(head.length))
  const body = keep ? word : word.toLowerCase()
  return capitalizeFirst ? body.replace(RE_LETTER, (c) => c.toUpperCase()) : body
}

export function toUpper(text: string): string {
  return text.toUpperCase()
}

export function toLower(text: string): string {
  return text.toLowerCase()
}

/** Capitalizes every word. Acronyms in mixed-case input (HTTP, iPhone) are kept. */
export function toTitle(text: string): string {
  const keepCaps = RE_LOWER_CASE.test(text)
  return text.replace(WORD_RE, (w) => recase(w, keepCaps, true))
}

/**
 * Capitalizes the first letter of the text, of each line, and of each sentence after `. ! ?`
 * followed by whitespace, or after `。！？`. Other words are lowercased, except acronyms and
 * mixed-case words in mixed-case input (same rule as toTitle). `3.14` and `e.g.` stay intact.
 */
export function toSentence(text: string): string {
  const keepCaps = RE_LOWER_CASE.test(text)
  let out = ''
  let last = 0
  let sentenceStart = true
  for (const match of text.matchAll(WORD_RE)) {
    const index = match.index ?? 0
    const gap = text.slice(last, index)
    if (/[\n\r。！？]/.test(gap) || (/[.!?]/.test(gap) && /\s/.test(gap))) sentenceStart = true
    out += gap + recase(match[0], keepCaps, sentenceStart)
    sentenceStart = false
    last = index + match[0].length
  }
  return out + text.slice(last)
}

export function toCamel(text: string): string {
  return splitWords(text)
    .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w)))
    .join('')
}

export function toPascal(text: string): string {
  return splitWords(text).map(capitalize).join('')
}

export function toSnake(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join('_')
}

export function toConstant(text: string): string {
  return splitWords(text)
    .map((w) => w.toUpperCase())
    .join('_')
}

export function toKebab(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join('-')
}

/** Capitalized words joined by dashes. Header-Case would be identical, so it is not offered. */
export function toTrain(text: string): string {
  return splitWords(text).map(capitalize).join('-')
}

export function toDot(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join('.')
}

export function toPath(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join('/')
}

/**
 * URL slug. Works on the raw text rather than splitWords, so camelCase is not split.
 * Diacritics are removed, Han/Kana/Hangul are dropped, and every other run of
 * non-[a-z0-9] characters becomes a single dash.
 */
export function toSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(CJK_ALL, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Alternates case across the cased letters, starting lowercase. */
export function toAlternating(text: string): string {
  let index = 0
  let out = ''
  for (const ch of text) {
    if (RE_CASED.test(ch)) {
      out += index % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase()
      index++
    } else {
      out += ch
    }
  }
  return out
}

/** Swaps the case of ASCII letters only, so applying it twice returns the input. */
export function toInverse(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) =>
    c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()
  )
}

/** Reverses the text by grapheme cluster, so accented letters and emoji stay whole. */
export function toReverse(text: string): string {
  return Array.from(SEGMENTER.segment(text), (s) => s.segment)
    .reverse()
    .join('')
}

export interface CaseFormat {
  key: string
  label: string
  description: string
  convert: (text: string) => string
}

export const CASE_FORMATS: readonly CaseFormat[] = [
  { key: 'upper', label: 'UPPER CASE', description: '全部字母转为大写', convert: toUpper },
  { key: 'lower', label: 'lower case', description: '全部字母转为小写', convert: toLower },
  {
    key: 'title',
    label: 'Title Case',
    description: '每个单词首字母大写，缩写保持不变',
    convert: toTitle
  },
  {
    key: 'sentence',
    label: 'Sentence case',
    description: '句首字母大写，其余单词小写',
    convert: toSentence
  },
  {
    key: 'camel',
    label: 'camelCase',
    description: '首词小写，后续单词首字母大写',
    convert: toCamel
  },
  {
    key: 'pascal',
    label: 'PascalCase',
    description: '每个单词首字母大写，无分隔符',
    convert: toPascal
  },
  { key: 'snake', label: 'snake_case', description: '下划线分隔，全小写', convert: toSnake },
  {
    key: 'constant',
    label: 'CONSTANT_CASE',
    description: '下划线分隔，全大写',
    convert: toConstant
  },
  { key: 'kebab', label: 'kebab-case', description: '短横线分隔，全小写', convert: toKebab },
  {
    key: 'train',
    label: 'Train-Case',
    description: '短横线分隔，每个单词首字母大写',
    convert: toTrain
  },
  { key: 'dot', label: 'dot.case', description: '点号分隔，全小写', convert: toDot },
  { key: 'path', label: 'path/case', description: '斜杠分隔，全小写', convert: toPath },
  {
    key: 'slug',
    label: 'slug',
    description: '适合做 URL，去掉音标符号和非 ASCII 字符',
    convert: toSlug
  },
  {
    key: 'alternating',
    label: 'aLtErNaTiNg',
    description: '字母大小写逐个交替',
    convert: toAlternating
  },
  {
    key: 'inverse',
    label: 'iNVERSE cASE',
    description: '交换 ASCII 字母的大小写',
    convert: toInverse
  },
  { key: 'reverse', label: 'reverse', description: '按字符顺序倒转', convert: toReverse }
]
