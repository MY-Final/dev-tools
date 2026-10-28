/**
 * Pure helpers behind the Regex Tester page. Nothing here touches React, and
 * nothing mutates a RegExp it receives: every iteration works on a fresh copy
 * so `lastIndex` state held elsewhere is never disturbed.
 */

/** Upper bound on collected matches, so pathological input cannot flood the UI. */
export const MAX_MATCHES = 10000

export interface CompileResult {
  regex: RegExp | null
  /** Empty string when the pattern is empty or compiles successfully. */
  error: string
}

export interface GroupInfo {
  /** 1-based capture index, matching `$1`, `$2`, ... */
  index: number
  name?: string
  value: string | undefined
  /** Code-unit offsets; only present when the `d` flag is active and the group participated. */
  start?: number
  end?: number
}

export interface MatchInfo {
  index: number
  value: string
  groups: GroupInfo[]
  namedGroups: Record<string, string | undefined>
}

export interface CollectResult {
  matches: MatchInfo[]
  truncated: boolean
}

export interface HighlightSegment {
  text: string
  kind: 'plain' | 'match'
  matchIndex?: number
  groupIndex?: number
}

export interface ReplaceResult {
  output: string
  count: number
  /** Non-fatal notice (for example, the replacement cap was reached) or a failure message. */
  error: string
}

/**
 * Compiles a pattern without throwing. An empty pattern yields no regex and no
 * error, so the UI can show its placeholder state instead of an error.
 */
export function compileRegex(pattern: string, flags: string): CompileResult {
  if (pattern === '') return { regex: null, error: '' }
  try {
    return { regex: new RegExp(pattern, flags), error: '' }
  } catch (err) {
    return { regex: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Lists capture-group names in capture order (undefined for unnamed groups).
 * Only needed because the engine does not expose the number-to-name mapping.
 * Skips escaped characters, character classes, and non-capturing constructs.
 */
export function getGroupNames(source: string): Array<string | undefined> {
  const names: Array<string | undefined> = []
  let inClass = false
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i)
    if (ch === '\\') {
      i++
      continue
    }
    if (inClass) {
      if (ch === ']') inClass = false
      continue
    }
    if (ch === '[') {
      inClass = true
      continue
    }
    if (ch !== '(') continue
    if (source.charAt(i + 1) !== '?') {
      names.push(undefined)
      continue
    }
    const kind = source.charAt(i + 2)
    const after = source.charAt(i + 3)
    if (kind === '<' && after !== '=' && after !== '!') {
      const close = source.indexOf('>', i + 3)
      names.push(close === -1 ? undefined : source.slice(i + 3, close))
    }
  }
  return names
}

/**
 * Next scan position after an empty match. Unicode-aware patterns step over a
 * whole surrogate pair so they never start a match between the two halves.
 * Non-unicode patterns work in code units, so they advance by one.
 */
function advanceIndex(input: string, index: number, unicode: boolean): number {
  if (unicode) {
    const high = input.charCodeAt(index)
    const low = input.charCodeAt(index + 1)
    if (high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) return index + 2
  }
  return index + 1
}

function toMatchInfo(m: RegExpExecArray, names: Array<string | undefined>): MatchInfo {
  const indices = (m as RegExpExecArray & { indices?: RegExpIndicesArray }).indices
  const groupCount = m.length - 1
  const groups: GroupInfo[] = []
  for (let i = 1; i <= groupCount; i++) {
    const group: GroupInfo = { index: i, value: m[i] }
    const name = names[i - 1]
    if (name !== undefined) group.name = name
    const range = indices?.[i]
    if (range) {
      group.start = range[0]
      group.end = range[1]
    }
    groups.push(group)
  }
  const namedGroups: Record<string, string | undefined> = {}
  if (m.groups) {
    for (const [key, value] of Object.entries(m.groups)) namedGroups[key] = value
  }
  return { index: m.index, value: m[0], groups, namedGroups }
}

/**
 * Collects matches the way a global replace would, with a cap. Non-global,
 * non-sticky regexes yield at most one match (their first). Sticky-only regexes
 * attempt a single match at offset 0, as the engine does.
 */
export function collectMatchesResult(
  regex: RegExp,
  input: string,
  limit: number = MAX_MATCHES
): CollectResult {
  const names = getGroupNames(regex.source)
  const engine = new RegExp(regex.source, regex.flags)
  const matches: MatchInfo[] = []

  if (!regex.global) {
    const m = engine.exec(input)
    if (m) matches.push(toMatchInfo(m, names))
    return { matches, truncated: false }
  }

  const unicode = regex.unicode || regex.unicodeSets
  let m: RegExpExecArray | null
  while ((m = engine.exec(input)) !== null) {
    if (matches.length >= limit) return { matches, truncated: true }
    matches.push(toMatchInfo(m, names))
    if (m[0].length === 0) {
      engine.lastIndex = advanceIndex(input, engine.lastIndex, unicode)
    }
  }
  return { matches, truncated: false }
}

export function collectMatches(
  regex: RegExp,
  input: string,
  limit: number = MAX_MATCHES
): MatchInfo[] {
  return collectMatchesResult(regex, input, limit).matches
}

/**
 * Splits the input into plain and match segments. With `groupIndex`, the
 * matching capture group's range is split out so it can be styled separately
 * (requires the `d` flag; otherwise the match stays whole).
 */
export function buildHighlightSegments(
  input: string,
  matches: MatchInfo[],
  options: { groupIndex?: number } = {}
): HighlightSegment[] {
  const segments: HighlightSegment[] = []
  let cursor = 0

  const pushPlain = (text: string): void => {
    if (text) segments.push({ text, kind: 'plain' })
  }
  // Empty matches still get a segment so the UI can mark their position.
  const pushMatch = (text: string, matchIndex: number, groupIndex?: number): void => {
    const segment: HighlightSegment = { text, kind: 'match', matchIndex }
    if (groupIndex !== undefined) segment.groupIndex = groupIndex
    segments.push(segment)
  }

  matches.forEach((m, matchIndex) => {
    const start = m.index
    const end = m.index + m.value.length
    if (start < cursor) return
    pushPlain(input.slice(cursor, start))

    const group =
      options.groupIndex !== undefined
        ? m.groups.find((g) => g.index === options.groupIndex)
        : undefined
    const range = group && group.start !== undefined && group.end !== undefined ? group : undefined
    if (range && range.start !== undefined && range.end !== undefined) {
      const groupStart = range.start
      const groupEnd = range.end
      if (groupStart >= start && groupEnd <= end && groupEnd > groupStart) {
        if (groupStart > start) pushMatch(input.slice(start, groupStart), matchIndex)
        pushMatch(input.slice(groupStart, groupEnd), matchIndex, range.index)
        if (end > groupEnd) pushMatch(input.slice(groupEnd, end), matchIndex)
        cursor = end
        return
      }
    }
    pushMatch(m.value, matchIndex)
    cursor = end
  })

  pushPlain(input.slice(cursor))
  return segments
}

/**
 * Expands a replacement template for one match. Mirrors the engine's
 * GetSubstitution rules so output matches `String.prototype.replace`.
 */
function expandReplacement(template: string, args: unknown[]): string {
  const last = args[args.length - 1]
  const hasNamed = typeof last === 'object' && last !== null
  const endIdx = hasNamed ? args.length - 1 : args.length
  const match = String(args[0])
  const offset = Number(args[endIdx - 2])
  const subject = String(args[endIdx - 1])
  const captures = args.slice(1, endIdx - 2) as Array<string | undefined>
  const named = hasNamed ? (last as Record<string, string | undefined>) : undefined
  const prefix = subject.slice(0, offset)
  const suffix = subject.slice(offset + match.length)
  const m = captures.length

  let out = ''
  let i = 0
  while (i < template.length) {
    const ch = template.charAt(i)
    if (ch !== '$' || i + 1 >= template.length) {
      out += ch
      i++
      continue
    }
    const next = template.charAt(i + 1)
    if (next === '$') {
      out += '$'
      i += 2
    } else if (next === '&') {
      out += match
      i += 2
    } else if (next === '`') {
      out += prefix
      i += 2
    } else if (next === "'") {
      out += suffix
      i += 2
    } else if (next >= '0' && next <= '9') {
      const two = template.slice(i + 1, i + 3)
      if (/^\d\d$/.test(two) && Number(two) >= 1 && Number(two) <= m) {
        out += captures[Number(two) - 1] ?? ''
        i += 3
      } else if (next !== '0' && Number(next) <= m) {
        out += captures[Number(next) - 1] ?? ''
        i += 2
      } else {
        out += ch
        i++
      }
    } else if (next === '<' && named !== undefined) {
      const close = template.indexOf('>', i + 2)
      if (close === -1) {
        out += ch
        i++
      } else {
        out += named[template.slice(i + 2, close)] ?? ''
        i = close + 1
      }
    } else {
      out += ch
      i++
    }
  }
  return out
}

/**
 * Replaces matches with a template ($1, $&, $<name>, $$ ...) and counts how many
 * replacements happened. Non-global regexes replace only the first match.
 */
export function applyReplacement(
  input: string,
  regex: RegExp,
  replacement: string,
  limit: number = MAX_MATCHES
): ReplaceResult {
  let count = 0
  let capped = false
  try {
    const engine = new RegExp(regex.source, regex.flags)
    const output = input.replace(engine, (...args: unknown[]) => {
      const matched = String(args[0])
      if (count >= limit) {
        capped = true
        return matched
      }
      count++
      return expandReplacement(replacement, args)
    })
    const error = capped ? `替换次数超过 ${limit}，仅替换前 ${limit} 处` : ''
    return { output, count, error }
  } catch (err) {
    return {
      output: input,
      count: 0,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Builds a copyable JavaScript regex literal. Escapes unescaped `/` outside
 * character classes and turns raw line breaks into `\n`/`\r`.
 */
export function formatRegexLiteral(pattern: string, flags: string): string {
  let body = ''
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern.charAt(i)
    if (ch === '\\') {
      body += ch + pattern.charAt(i + 1)
      i++
      continue
    }
    if (ch === '[') inClass = true
    else if (ch === ']') inClass = false

    if (ch === '/' && !inClass) body += '\\/'
    else if (ch === '\n') body += '\\n'
    else if (ch === '\r') body += '\\r'
    else body += ch
  }
  return `/${body}/${flags}`
}
