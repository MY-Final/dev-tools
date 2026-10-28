import Papa from 'papaparse'
import { parse as parseYamlText, stringify as stringifyYamlData, YAMLParseError } from 'yaml'
import { parse as parseTomlText, stringify as stringifyTomlData, TomlError } from 'smol-toml'
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser'

// ── Data Formats ───────────────────────────────────────────────
// One conversion core shared by the data tools, so a document converted
// CSV → JSON → YAML → TOML keeps the same shape everywhere. Every parser
// reports its own errors instead of throwing, because tool pages need a
// message next to the input, not a crashed render.

export type FormatId = 'json' | 'yaml' | 'toml' | 'xml' | 'csv' | 'tsv'

export interface FormatInfo {
  id: FormatId
  label: string
  extension: string
  /** True when the format is row/column shaped rather than a tree. */
  tabular: boolean
}

export const DATA_FORMATS: readonly FormatInfo[] = [
  { id: 'json', label: 'JSON', extension: 'json', tabular: false },
  { id: 'yaml', label: 'YAML', extension: 'yaml', tabular: false },
  { id: 'toml', label: 'TOML', extension: 'toml', tabular: false },
  { id: 'xml', label: 'XML', extension: 'xml', tabular: false },
  { id: 'csv', label: 'CSV', extension: 'csv', tabular: true },
  { id: 'tsv', label: 'TSV', extension: 'tsv', tabular: true }
]

export function getFormatInfo(id: FormatId): FormatInfo {
  return DATA_FORMATS.find((format) => format.id === id) ?? DATA_FORMATS[0]
}

export interface ParseOutcome {
  ok: boolean
  data: unknown
  error: string
  warnings: string[]
  /** Delimiter Papa detected for CSV/TSV input. */
  delimiter?: string
}

function failure(error: string, warnings: string[] = []): ParseOutcome {
  return { ok: false, data: null, error, warnings }
}

function success(data: unknown, warnings: string[] = []): ParseOutcome {
  return { ok: true, data, error: '', warnings }
}

// ── CSV / TSV ─────────────────────────────────────────────────
// Papa handles quoted delimiters, embedded newlines and escaped quotes;
// this wrapper only adds the shape the table views expect.

export interface CsvTableData {
  headers: string[]
  rows: string[][]
  /** Widest row, so a table can render trailing empty cells. */
  width: number
  /** Data-row indices whose cell count differs from the header. */
  ragged: number[]
  /** Headers that were empty or duplicated and had to be renamed. */
  renamedHeaders: Array<{ from: string; to: string }>
}

export interface CsvReadOptions {
  delimiter?: string
  /** Treat the first record as the header row. Defaults to true. */
  header?: boolean
  skipEmptyLines?: boolean
}

const MAX_CSV_ERRORS = 5

interface RawCsvResult {
  data: string[][]
  errors: string[]
  delimiter: string
}

function readCsv(text: string, options: CsvReadOptions = {}): RawCsvResult {
  const parsed = Papa.parse<string[]>(text, {
    delimiter: options.delimiter ?? '',
    header: false,
    skipEmptyLines: options.skipEmptyLines === false ? false : 'greedy',
    dynamicTyping: false,
    transform: (value) => value
  })

  const errors = parsed.errors
    .slice(0, MAX_CSV_ERRORS)
    .map((issue) =>
      issue.row === undefined ? issue.message : `第 ${issue.row + 1} 行：${issue.message}`
    )

  const rows: string[][] = []
  for (const row of parsed.data) {
    if (!Array.isArray(row)) continue
    // Papa emits [""] for blank lines that survive skipEmptyLines.
    if (row.length === 1 && row[0] === '') continue
    rows.push(row.map((cell) => (cell == null ? '' : String(cell))))
  }

  return { data: rows, errors, delimiter: parsed.meta.delimiter || ',' }
}

function makeUniqueHeaders(raw: string[]): {
  headers: string[]
  renamed: Array<{ from: string; to: string }>
} {
  const headers: string[] = []
  const renamed: Array<{ from: string; to: string }> = []
  const seen = new Map<string, number>()

  raw.forEach((name, index) => {
    let next = name.trim()
    if (!next) next = `column_${index + 1}`
    const count = seen.get(next) ?? 0
    seen.set(next, count + 1)
    if (count > 0) {
      let suffix = count + 1
      let candidate = `${next}_${suffix}`
      while (seen.has(candidate)) {
        suffix++
        candidate = `${next}_${suffix}`
      }
      seen.set(candidate, 1)
      renamed.push({ from: next, to: candidate })
      next = candidate
    }
    headers.push(next)
  })

  return { headers, renamed }
}

export function parseCsvTable(text: string, options: CsvReadOptions = {}): ParseOutcome {
  const { data, errors, delimiter } = readCsv(text, options)
  if (data.length === 0) {
    return failure(errors[0] ?? '没有可解析的数据行')
  }

  const useHeader = options.header !== false
  const rawHeaders = useHeader ? data[0] : data[0].map((_, index) => `column_${index + 1}`)
  const body = useHeader ? data.slice(1) : data
  const { headers, renamed } = makeUniqueHeaders(rawHeaders)

  let width = headers.length
  const ragged: number[] = []
  body.forEach((row, index) => {
    if (row.length !== headers.length) ragged.push(index)
    if (row.length > width) width = row.length
  })

  // Extra columns beyond the header still need a name to round-trip.
  while (headers.length < width) headers.push(`column_${headers.length + 1}`)

  const table: CsvTableData = { headers, rows: body, width, ragged, renamedHeaders: renamed }
  const warnings = errors.length > 0 ? [`分隔符 "${delimiter}" 解析告警：${errors.join('；')}`] : []
  if (ragged.length > 0) {
    warnings.push(`${ragged.length} 行的列数与表头不一致（第 ${ragged[0] + 1} 行起）`)
  }

  const result = success(table, warnings)
  // Surfaced separately so the editor can show it without calling it an error.
  result.delimiter = delimiter
  return result
}

export function stringifyCsvTable(
  table: { headers: string[]; rows: string[][] },
  options: { delimiter?: string; quoteAll?: boolean; newline?: string } = {}
): string {
  const delimiter = options.delimiter ?? ','
  const newline = options.newline ?? '\n'
  const quoteAll = options.quoteAll === true

  const needsQuotes = (value: string): boolean =>
    quoteAll ||
    value.includes('"') ||
    value.includes(delimiter) ||
    value.includes('\n') ||
    value.includes('\r')

  const encode = (value: string): string => {
    const text = value ?? ''
    if (!needsQuotes(text)) return text
    return `"${text.replace(/"/g, '""')}"`
  }

  const lines: string[] = []
  if (table.headers.length > 0) lines.push(table.headers.map(encode).join(delimiter))
  for (const row of table.rows) lines.push(row.map(encode).join(delimiter))
  return lines.join(newline)
}

/** Converts a table to an array of row objects, the shape JSON/YAML expect. */
export function csvTableToRecords(table: { headers: string[]; rows: string[][] }): unknown[] {
  return table.rows.map((row) => {
    const record: Record<string, string> = {}
    table.headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })
}

// ── XML ───────────────────────────────────────────────────────
// The parser runs in preserveOrder mode and the result is compacted here:
// a plain object would silently keep only the last of several sibling tags,
// which is exactly what real XML exports (repeated <item>, <row>) rely on.

const XML_PARSER_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  commentPropName: '#comment',
  cdataPropName: '#cdata',
  parseTagValue: true,
  parseAttributeValue: false,
  // Real whitespace inside mixed content matters; pretty-print indentation is
  // dropped later because those text nodes are whitespace-only.
  trimValues: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  allowBooleanAttributes: true
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// preserveOrder keeps every text node as a string, so text-only elements are
// typed here. Leading zeros stay strings so ids and zip codes survive.
const XML_NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/

function parseXmlScalar(text: string): unknown {
  if (text !== text.trim()) return text
  if (text === 'true') return true
  if (text === 'false') return false
  if (XML_NUMBER_RE.test(text)) return Number(text)
  return text
}

function textOf(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => textOf(item)).join('')
  if (isPlainObject(value)) return '#text' in value ? String(value['#text'] ?? '') : ''
  return value === null || value === undefined ? '' : String(value)
}

/**
 * Turns preserveOrder children into the usual JSON shape: repeated tags become
 * arrays, attributes keep their `@_` prefix, and text lands in `#text` when the
 * element also has children.
 */
function compactChildren(nodes: unknown[], attrs: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {}
  const children = new Map<string, unknown[]>()
  let text = ''
  let hasText = false

  for (const node of nodes) {
    if (!isPlainObject(node)) continue
    if ('#comment' in node) continue
    if ('#text' in node || '#cdata' in node) {
      const piece = textOf(node['#text'] ?? node['#cdata'])
      if (piece.trim() !== '' || hasText) {
        text += piece
        hasText = true
      }
      continue
    }

    const ownAttrs = isPlainObject(node[':@']) ? node[':@'] : {}
    for (const [tag, value] of Object.entries(node)) {
      if (tag === ':@') continue
      const compacted = compactChildren(Array.isArray(value) ? value : [], ownAttrs)
      const list = children.get(tag) ?? []
      list.push(compacted)
      children.set(tag, list)
    }
  }

  for (const [tag, list] of children) {
    out[tag] = list.length === 1 ? list[0] : list
  }
  Object.assign(out, attrs)
  if (hasText) out['#text'] = children.size > 0 ? text.trim() : parseXmlScalar(text)

  const keys = Object.keys(out)
  if (keys.length === 0) return text
  if (keys.length === 1 && keys[0] === '#text') return parseXmlScalar(text)
  return out
}

function compactDocument(nodes: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const node of nodes) {
    if (!isPlainObject(node)) continue
    const attrs = isPlainObject(node[':@']) ? node[':@'] : {}
    for (const [tag, value] of Object.entries(node)) {
      if (tag === ':@' || tag.startsWith('#')) continue
      const compacted = compactChildren(Array.isArray(value) ? value : [], attrs)
      const existing = out[tag]
      if (existing === undefined) out[tag] = compacted
      else if (Array.isArray(existing)) existing.push(compacted)
      else out[tag] = [existing, compacted]
    }
  }

  return out
}

function builderOptions(pretty: boolean): ConstructorParameters<typeof XMLBuilder>[0] {
  return {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    commentPropName: '#comment',
    cdataPropName: '#cdata',
    format: pretty,
    indentBy: '  ',
    suppressEmptyNode: false,
    suppressBooleanAttributes: false
  }
}

export function parseXmlDocument(text: string): ParseOutcome {
  const trimmed = text.trim()
  if (!trimmed) return failure('XML 内容为空')

  const validation = XMLValidator.validate(trimmed, { allowBooleanAttributes: true })
  if (validation !== true) {
    const issue = validation.err
    const where = issue.line ? `第 ${issue.line} 行第 ${issue.col} 列` : ''
    return failure(`XML 格式错误${where ? `（${where}）` : ''}：${issue.msg}`)
  }

  try {
    const parser = new XMLParser(XML_PARSER_OPTIONS)
    const data = compactDocument(parser.parse(trimmed))
    const warnings: string[] = []
    if (trimmed.includes('<!--')) warnings.push('XML 注释在转换为 JSON 时会被忽略')
    const roots = Object.keys(data)
    if (roots.length > 1) warnings.push(`文档包含 ${roots.length} 个根节点：${roots.join('、')}`)
    return success(data, warnings)
  } catch (err) {
    return failure(`XML 解析失败：${(err as Error).message}`)
  }
}

/**
 * XML needs exactly one root element. A single object/scalar key already names
 * it; anything else (arrays, multiple keys) is wrapped so the output stays valid.
 */
function ensureXmlRoot(data: unknown): unknown {
  if (isPlainObject(data)) {
    const keys = Object.keys(data).filter((key) => key !== '#text')
    if (keys.length === 1 && !Array.isArray(data[keys[0]])) return data
  }
  if (Array.isArray(data)) return { root: { item: data } }
  return { root: data }
}

export function stringifyXmlDocument(data: unknown, pretty = true): string {
  const builder = new XMLBuilder(builderOptions(pretty))
  const body = builder.build(ensureXmlRoot(data))

  // fast-xml-parser flattens a one-key root object to its tag, which is what
  // we want, but it also drops the declaration; keep documents self-contained.
  if (typeof body !== 'string') return ''
  if (/^\s*<\?xml/.test(body)) return body
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
}

// ── YAML / TOML / JSON ────────────────────────────────────────

export function parseYamlDocument(text: string): ParseOutcome {
  if (!text.trim()) return failure('YAML 内容为空')
  try {
    const data = parseYamlText(text, { strict: false, uniqueKeys: false })
    return success(data ?? null)
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const line = err.linePos?.[0]?.line
      // yaml appends "at line N, column M:" to the message; the position is
      // reported separately, so trim the duplicate for the inline error.
      const message = err.message.split('\n')[0].replace(/\s+at line \d+, column \d+:?$/, '')
      return failure(`YAML 格式错误${line ? `（第 ${line} 行）` : ''}：${message}`)
    }
    return failure(`YAML 解析失败：${(err as Error).message}`)
  }
}

export function stringifyYamlDocument(data: unknown): string {
  return stringifyYamlData(data, { lineWidth: 0, indent: 2 })
}

export function parseTomlDocument(text: string): ParseOutcome {
  if (!text.trim()) return failure('TOML 内容为空')
  try {
    return success(parseTomlText(text))
  } catch (err) {
    if (err instanceof TomlError) {
      const line = err.line ? `（第 ${err.line} 行）` : ''
      return failure(`TOML 格式错误${line}：${err.message}`)
    }
    return failure(`TOML 解析失败：${(err as Error).message}`)
  }
}

export function stringifyTomlDocument(data: unknown): string {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('TOML 的顶层必须是表（对象）')
  }
  return stringifyTomlData(data as Record<string, unknown>)
}

export function parseJsonDocument(text: string): ParseOutcome {
  if (!text.trim()) return failure('JSON 内容为空')
  try {
    return success(JSON.parse(text))
  } catch (err) {
    return failure(formatJsonError(text, err as Error))
  }
}

/** Turns V8's position offset into a line/column message. */
export function formatJsonError(text: string, err: Error): string {
  const match = /position (\d+)/.exec(err.message)
  if (!match) return `JSON 格式错误：${err.message}`

  const position = Number(match[1])
  const before = text.slice(0, position)
  const line = before.split('\n').length
  const column = position - before.lastIndexOf('\n')
  const snippet = text.split('\n')[line - 1]?.slice(0, 80) ?? ''
  return `JSON 格式错误（第 ${line} 行第 ${column} 列）：${snippet.trim()}`
}

export function stringifyJsonDocument(data: unknown, indent = 2): string {
  return JSON.stringify(data, null, indent)
}

// ── Dispatch ──────────────────────────────────────────────────

export function parseDocument(format: FormatId, text: string): ParseOutcome {
  switch (format) {
    case 'json':
      return parseJsonDocument(text)
    case 'yaml':
      return parseYamlDocument(text)
    case 'toml':
      return parseTomlDocument(text)
    case 'xml':
      return parseXmlDocument(text)
    case 'csv':
      return parseCsvTable(text, { delimiter: ',' })
    case 'tsv':
      return parseCsvTable(text, { delimiter: '\t' })
    default:
      return failure('不支持的格式')
  }
}

export interface SerializeOptions {
  indent?: number
  pretty?: boolean
  delimiter?: string
  quoteAll?: boolean
}

export function serializeDocument(
  format: FormatId,
  data: unknown,
  options: SerializeOptions = {}
): string {
  switch (format) {
    case 'json':
      return stringifyJsonDocument(data, options.indent ?? 2)
    case 'yaml':
      return stringifyYamlDocument(data)
    case 'toml':
      return stringifyTomlDocument(data)
    case 'xml':
      return stringifyXmlDocument(data, options.pretty !== false)
    case 'csv':
      return stringifyCsvTable(toTable(data), {
        delimiter: options.delimiter ?? ',',
        quoteAll: options.quoteAll
      })
    case 'tsv':
      return stringifyCsvTable(toTable(data), { delimiter: '\t', quoteAll: options.quoteAll })
    default:
      return ''
  }
}

function toTable(data: unknown): { headers: string[]; rows: string[][] } {
  if (isCsvTableData(data)) {
    return { headers: data.headers, rows: data.rows }
  }

  const records = Array.isArray(data) ? data : [data]
  const headers: string[] = []
  const seen = new Set<string>()

  for (const record of records) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('CSV 只接受对象数组，当前结构包含标量或嵌套数组')
    }
    for (const key of Object.keys(record)) {
      if (seen.has(key)) continue
      seen.add(key)
      headers.push(key)
    }
  }

  const rows = records.map((record) =>
    headers.map((header) => stringifyCell((record as Record<string, unknown>)[header]))
  )
  return { headers, rows }
}

function isCsvTableData(value: unknown): value is CsvTableData {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as CsvTableData).headers) &&
    Array.isArray((value as CsvTableData).rows)
  )
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export interface ConvertOutcome {
  ok: boolean
  output: string
  error: string
  warnings: string[]
}

/**
 * Parses `text` as `from`, then writes it back out as `to`.
 *
 * Row-shaped formats get an intermediate table rather than a record array so
 * CSV → CSV keeps its original header casing and column order.
 */
export function convertDocument(
  text: string,
  from: FormatId,
  to: FormatId,
  options: SerializeOptions = {}
): ConvertOutcome {
  if (from === to) return { ok: true, output: text, error: '', warnings: [] }

  const parsed = parseDocument(from, text)
  if (!parsed.ok) return { ok: false, output: '', error: parsed.error, warnings: parsed.warnings }

  const warnings = [...parsed.warnings]
  if (from === 'xml') {
    warnings.push('XML 转出会丢弃注释位置与原始空白；同名重复元素会被合并为数组')
  }

  try {
    let output: string
    if (getFormatInfo(from).tabular && getFormatInfo(to).tabular) {
      output = serializeDocument(to, parsed.data, options)
    } else if (getFormatInfo(from).tabular && to !== 'xml') {
      output = serializeDocument(to, csvTableToRecords(parsed.data as CsvTableData), options)
    } else {
      output = serializeDocument(to, parsed.data, options)
    }
    return { ok: true, output, error: '', warnings }
  } catch (err) {
    return { ok: false, output: '', error: (err as Error).message, warnings }
  }
}
