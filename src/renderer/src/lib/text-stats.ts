/**
 * Pure text analysis for the Text Analyzer page. No React and no DOM access,
 * so every function can be exercised directly from Node.
 */

export interface LineExtreme {
  /** Length in code points, excluding the line break. */
  length: number
  /** Zero-based line index. The UI shows index + 1. */
  index: number
}

export interface TextStats {
  characters: number
  charactersNoSpaces: number
  words: number
  cjkCharacters: number
  latinWords: number
  uniqueLatinWords: number
  /** Mean length of Latin words in code points; 0 when there are none. */
  averageWordLength: number
  lines: number
  nonEmptyLines: number
  paragraphs: number
  sentences: number
  longestLine: LineExtreme
  /** A4 page estimate: 500 Latin words or 1000 CJK characters per page, rounded up. */
  estimatedPages: number
  bytes: number
  readingSeconds: number
  speakingSeconds: number
}

export interface KeywordItem {
  word: string
  count: number
  /** count / (Latin tokens + CJK characters scanned). */
  ratio: number
}

export interface CharacterItem {
  char: string
  count: number
  /** count / visible graphemes (whitespace excluded). */
  ratio: number
}

export interface LineStats {
  total: number
  /** Lines that are empty or contain only whitespace. */
  empty: number
  longest: LineExtreme
  /** Shortest line with visible content. Empty lines are excluded. */
  shortest: LineExtreme
}

const CJK_CHAR_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const CJK_PATTERN = new RegExp(CJK_CHAR_PATTERN.source, 'gu')
// Maximal runs of CJK characters. Bounds keyword n-gram generation to one run at a time.
const CJK_RUN_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu
// Latin words keep internal apostrophes and hyphens ("don't", "state-of-the-art").
const LATIN_WORD_PATTERN = /[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9À-ɏ]+)*/g
const DIGITS_ONLY = /^\d+$/
const WHITESPACE = /\s/
const LINE_BREAK = /\r\n|\r|\n/

// Sentence-final punctuation, Latin and CJK.
const SENTENCE_END = new Set(['.', '!', '?', '。', '！', '？', '…'])

// Characters per minute for CJK, words per minute for alphabetic text.
const CJK_READING_SPEED = 300
const CJK_SPEAKING_SPEED = 200
const WORD_READING_SPEED = 200
const WORD_SPEAKING_SPEED = 130

const WORDS_PER_PAGE = 500
const CJK_CHARS_PER_PAGE = 1000

const KEYWORD_MIN_LATIN = 2
const KEYWORD_MIN_CJK = 3
const KEYWORD_CJK_MIN_LEN = 2
const KEYWORD_CJK_MAX_LEN = 4

const textEncoder = new TextEncoder()
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// About 150 common English function words and contractions. Matched on lowercased tokens.
const LATIN_STOPWORDS = new Set(
  (
    'a about above after again against all also am an and any are as at be because been before ' +
    'being below between both but by can cannot could did do does doing down during each either ' +
    'else etc few for from further get got had has have having he her here hers herself him ' +
    'himself his how i if in into is it its itself just let me may might more most must my myself ' +
    'no nor not now of off on once one only or other our ours ourselves out over own same s shall ' +
    'she should so some such t than that the their theirs them themselves then there these they ' +
    'this those through to too under until up us very was we were what when where which while who ' +
    'whom why will with would yet you your yours yourself yourselves ' +
    "don't it's i'm isn't can't won't that's there's let's they're we're you're"
  ).split(' ')
)

// About 75 high-frequency Chinese function characters. A CJK n-gram made only of these is ignored.
const CJK_STOP_CHARS = new Set(
  '的一是不了在有和与及其并或但而也都就还又很更最再已被把给让向从到对于以为之这那个们我你他她它会能要上下中说着过地得吗呢吧啊因所等些如将由当时后来去么'.split(
    ''
  )
)

function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function normalizeLatinToken(token: string): string {
  return token.toLowerCase().replace(/’/g, "'")
}

/**
 * Splits on CRLF, CR or LF. A single trailing line break does not create an
 * extra empty line, so "a\n" has one line.
 */
export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split(LINE_BREAK)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function summarizeLines(lines: string[]): LineStats {
  let empty = 0
  let longest: LineExtreme = { length: 0, index: 0 }
  let shortestLength = Number.POSITIVE_INFINITY
  let shortestIndex = 0

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim() === '') {
      empty++
      continue
    }
    const length = Array.from(line).length
    // Strict comparisons keep the first occurrence on ties.
    if (length > longest.length) longest = { length, index }
    if (length < shortestLength) {
      shortestLength = length
      shortestIndex = index
    }
  }

  return {
    total: lines.length,
    empty,
    longest,
    shortest: Number.isFinite(shortestLength)
      ? { length: shortestLength, index: shortestIndex }
      : { length: 0, index: 0 }
  }
}

/** Counts runs of sentence-final punctuation, plus a trailing fragment that has visible text. */
function countSentences(text: string): number {
  let count = 0
  let inTerminator = false
  let hasOpenContent = false
  for (const ch of text) {
    if (SENTENCE_END.has(ch)) {
      if (!inTerminator) count++
      inTerminator = true
      hasOpenContent = false
    } else {
      inTerminator = false
      if (!WHITESPACE.test(ch)) hasOpenContent = true
    }
  }
  return hasOpenContent ? count + 1 : count
}

export function analyzeText(text: string): TextStats {
  let characters = 0
  let charactersNoSpaces = 0
  for (const ch of text) {
    characters++
    if (!WHITESPACE.test(ch)) charactersNoSpaces++
  }

  const cjkCharacters = text.match(CJK_PATTERN)?.length ?? 0
  const latinTokens = text.replace(CJK_PATTERN, ' ').match(LATIN_WORD_PATTERN) ?? []
  const latinWords = latinTokens.length
  const uniqueWords = new Set<string>()
  let letterTotal = 0
  for (const token of latinTokens) {
    letterTotal += token.length
    uniqueWords.add(normalizeLatinToken(token))
  }

  const lines = splitLines(text)
  const lineSummary = summarizeLines(lines)
  // A paragraph is a run of non-blank lines, so blank lines separate paragraphs.
  let paragraphs = 0
  let inParagraph = false
  for (const line of lines) {
    if (line.trim() === '') {
      inParagraph = false
    } else if (!inParagraph) {
      paragraphs++
      inParagraph = true
    }
  }

  const estimatedPages =
    latinWords === 0 && cjkCharacters === 0
      ? 0
      : Math.ceil(latinWords / WORDS_PER_PAGE + cjkCharacters / CJK_CHARS_PER_PAGE)

  const words = cjkCharacters + latinWords
  const readingSeconds = Math.ceil(
    (latinWords / WORD_READING_SPEED + cjkCharacters / CJK_READING_SPEED) * 60
  )
  const speakingSeconds = Math.ceil(
    (latinWords / WORD_SPEAKING_SPEED + cjkCharacters / CJK_SPEAKING_SPEED) * 60
  )

  return {
    characters,
    charactersNoSpaces,
    words,
    cjkCharacters,
    latinWords,
    uniqueLatinWords: uniqueWords.size,
    averageWordLength: latinWords === 0 ? 0 : letterTotal / latinWords,
    lines: lines.length,
    nonEmptyLines: lines.length - lineSummary.empty,
    paragraphs,
    sentences: countSentences(text),
    longestLine: lineSummary.longest,
    estimatedPages,
    bytes: textEncoder.encode(text).byteLength,
    readingSeconds,
    speakingSeconds
  }
}

/** Adds n-grams of length 2 to 4 from one CJK run. Windows made only of function characters are skipped. */
function countCjkGrams(chars: string[], counts: Map<string, number>): void {
  const isStop = chars.map((ch) => CJK_STOP_CHARS.has(ch))
  for (let n = KEYWORD_CJK_MIN_LEN; n <= KEYWORD_CJK_MAX_LEN; n++) {
    for (let i = 0; i + n <= chars.length; i++) {
      let allStop = true
      for (let k = i; k < i + n; k++) {
        if (!isStop[k]) {
          allStop = false
          break
        }
      }
      if (allStop) continue
      const gram = chars.slice(i, i + n).join('')
      counts.set(gram, (counts.get(gram) ?? 0) + 1)
    }
  }
}

/**
 * Records, for every proper substring of an accepted n-gram, the highest count of a
 * superstring that contains it. A substring whose count is not above that is redundant.
 */
function markSubstrings(word: string, count: number, covered: Map<string, number>): void {
  const chars = Array.from(word)
  for (let n = KEYWORD_CJK_MIN_LEN; n < chars.length; n++) {
    for (let i = 0; i + n <= chars.length; i++) {
      const sub = chars.slice(i, i + n).join('')
      if ((covered.get(sub) ?? 0) < count) covered.set(sub, count)
    }
  }
}

/**
 * Keyword heuristic, deliberately simple:
 * - Latin: lowercase tokens, drop tokens shorter than 2 characters, pure numbers and
 *   stopwords. Keep words that appear at least twice.
 * - CJK: every 2- to 4-character window inside a contiguous CJK run, skipping windows
 *   made only of function characters. Keep those that appear at least three times.
 *   Drop an n-gram when a longer n-gram with an equal or higher count contains it
 *   ("人工" inside "人工智能").
 * Known limits: no word segmentation, so n-grams cross word boundaries. Fragments such as
 * "的人" can still rank when they recur. Results for short text are noisy.
 * ratio is count / (Latin tokens + CJK characters), stopwords included.
 */
export function topKeywords(text: string, limit = 20): KeywordItem[] {
  const max = Math.max(0, Math.floor(limit))
  if (max === 0 || text.trim() === '') return []

  const latinTokens = text.replace(CJK_PATTERN, ' ').match(LATIN_WORD_PATTERN) ?? []
  const latinCounts = new Map<string, number>()
  for (const token of latinTokens) {
    const word = normalizeLatinToken(token)
    if (word.length < 2 || LATIN_STOPWORDS.has(word) || DIGITS_ONLY.test(word)) continue
    latinCounts.set(word, (latinCounts.get(word) ?? 0) + 1)
  }

  const cjkCounts = new Map<string, number>()
  let cjkTotal = 0
  for (const run of text.match(CJK_RUN_PATTERN) ?? []) {
    const chars = Array.from(run)
    cjkTotal += chars.length
    countCjkGrams(chars, cjkCounts)
  }

  const candidates: Array<{ word: string; count: number }> = []
  for (const [word, count] of latinCounts) {
    if (count >= KEYWORD_MIN_LATIN) candidates.push({ word, count })
  }

  // Longest first, so a superstring is decided before its fragments.
  const cjkCandidates: Array<{ word: string; count: number }> = []
  for (const [word, count] of cjkCounts) {
    if (count >= KEYWORD_MIN_CJK) cjkCandidates.push({ word, count })
  }
  cjkCandidates.sort((a, b) => b.word.length - a.word.length || b.count - a.count)
  const covered = new Map<string, number>()
  for (const candidate of cjkCandidates) {
    if ((covered.get(candidate.word) ?? 0) >= candidate.count) continue
    candidates.push(candidate)
    markSubstrings(candidate.word, candidate.count, covered)
  }

  const slots = latinTokens.length + cjkTotal
  candidates.sort((a, b) => b.count - a.count || compareStrings(a.word, b.word))
  return candidates.slice(0, max).map(({ word, count }) => ({
    word,
    count,
    ratio: slots === 0 ? 0 : count / slots
  }))
}

/** Counts visible graphemes (Intl.Segmenter), so combined characters and emoji count once. */
export function characterFrequency(text: string, limit = 20): CharacterItem[] {
  const max = Math.max(0, Math.floor(limit))
  const counts = new Map<string, number>()
  let total = 0
  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (segment.trim() === '') continue
    total++
    counts.set(segment, (counts.get(segment) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))
    .slice(0, max)
    .map(([char, count]) => ({ char, count, ratio: count / total }))
}

export function lineStats(text: string): LineStats {
  return summarizeLines(splitLines(text))
}

/**
 * UTF-16 offsets of a zero-based line, excluding its line break, for selecting it in a textarea.
 * Returns null when the index is out of range.
 */
export function lineRange(text: string, index: number): { start: number; end: number } | null {
  if (index < 0) return null
  const breaks = new RegExp(LINE_BREAK.source, 'g')
  let start = 0
  for (let line = 0; ; line++) {
    const match = breaks.exec(text)
    const end = match ? match.index : text.length
    if (line === index) return { start, end }
    if (!match) return null
    start = match.index + match[0].length
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 秒'
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds === 0 ? `${minutes} 分钟` : `${minutes} 分 ${seconds} 秒`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes === 0 ? `${hours} 小时` : `${hours} 小时 ${restMinutes} 分`
}
