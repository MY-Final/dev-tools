export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface JsonRepairResult {
  original: string
  repaired: string
  changes: string[]
  ok: boolean
  error: string
}

export interface CsvRenamedHeader {
  from: string
  to: string
}

export interface CsvTable {
  headers: string[]
  /** 数据行保留原始列数，可能与 headers 长度不同 */
  rows: string[][]
  /** 最大列数（表头与所有数据行的最大值），仅 parseCsvTable 填充 */
  width?: number
  /** 列数与原始表头不一致的数据行下标（不含表头），仅 parseCsvTable 填充 */
  ragged?: number[]
  /** 因重复被自动改名的表头，仅 parseCsvTable 填充 */
  renamedHeaders?: CsvRenamedHeader[]
}

export interface JsonToTypeScriptOptions {
  exportInterfaces?: boolean
  rootAlias?: string
  rootFirst?: boolean
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyContainer(value: JsonValue): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (isJsonObject(value)) return Object.keys(value).length > 0
  return false
}

function findJsonBlock(value: string): { start: number; end: number } | null {
  let start = -1
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '{' || value[i] === '[') {
      start = i
      break
    }
  }

  if (start === -1) return null

  const opening = value[start]
  const closing = opening === '{' ? '}' : ']'
  let depth = 0
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let i = start; i < value.length; i++) {
    const char = value[i]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === opening) {
      depth++
    } else if (char === closing) {
      depth--
      if (depth === 0) return { start, end: i }
    }
  }

  return { start, end: value.length - 1 }
}

function removeJsonComments(value: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      continue
    }

    if (char === '/' && value[i + 1] === '/') {
      i += 2
      while (i < value.length && value[i] !== '\n' && value[i] !== '\r') i++
      output += '\n'
      continue
    }

    if (char === '/' && value[i + 1] === '*') {
      i += 2
      while (i < value.length && !(value[i] === '*' && value[i + 1] === '/')) i++
      if (i < value.length) i++
      output += ' '
      continue
    }

    output += char
  }

  return output
}

function removeTrailingCommas(value: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      continue
    }

    if (char === ',') {
      let cursor = i + 1
      while (/\s/.test(value[cursor] ?? '')) cursor++
      if (value[cursor] === '}' || value[cursor] === ']') continue
    }

    output += char
  }

  return output
}

function quoteUnquotedKeys(value: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let escaped = false
  let i = 0

  while (i < value.length) {
    const char = value[i]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      i++
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      i++
      continue
    }

    if (char === '{' || char === ',') {
      const match = /^(\s*)([A-Za-z_$][\w$-]*)(\s*):/.exec(value.slice(i + 1))
      if (match) {
        output += char + match[1] + JSON.stringify(match[2]) + match[3] + ':'
        i += match[0].length + 1
        continue
      }
    }

    output += char
    i++
  }

  return output
}

function decodeSingleQuotedString(value: string): string {
  let output = ''

  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (char !== '\\' || i + 1 >= value.length) {
      output += char
      continue
    }

    const next = value[i + 1]
    i++

    switch (next) {
      case "'": output += "'"; break
      case '"': output += '"'; break
      case '\\': output += '\\'; break
      case 'n': output += '\n'; break
      case 'r': output += '\r'; break
      case 't': output += '\t'; break
      case 'b': output += '\b'; break
      case 'f': output += '\f'; break
      case 'u': {
        const hex = value.slice(i + 1, i + 5)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          output += String.fromCharCode(Number.parseInt(hex, 16))
          i += 4
        } else {
          output += 'u'
        }
        break
      }
      default: output += next; break
    }
  }

  return output
}

function convertSingleQuotedStrings(value: string): string {
  let output = ''
  let i = 0

  while (i < value.length) {
    const char = value[i]

    if (char === '"') {
      output += char
      i++
      let escaped = false
      while (i < value.length) {
        const inner = value[i]
        output += inner
        i++
        if (escaped) {
          escaped = false
        } else if (inner === '\\') {
          escaped = true
        } else if (inner === '"') {
          break
        }
      }
      continue
    }

    if (char !== "'") {
      output += char
      i++
      continue
    }

    let cursor = i + 1
    let escaped = false
    while (cursor < value.length) {
      const inner = value[cursor]
      if (escaped) {
        escaped = false
      } else if (inner === '\\') {
        escaped = true
      } else if (inner === "'") {
        break
      }
      cursor++
    }

    if (cursor >= value.length) {
      output += char
      i++
      continue
    }

    output += JSON.stringify(decodeSingleQuotedString(value.slice(i + 1, cursor)))
    i = cursor + 1
  }

  return output
}

function replacePythonLiterals(value: string): string {
  let output = ''
  let quote: '"' | null = null
  let escaped = false
  let i = 0

  while (i < value.length) {
    const char = value[i]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        quote = null
      }
      i++
      continue
    }

    if (char === '"') {
      quote = '"'
      output += char
      i++
      continue
    }

    if (value.startsWith('True', i) && !/[\w$]/.test(value[i - 1] ?? '') && !/[\w$]/.test(value[i + 4] ?? '')) {
      output += 'true'
      i += 4
      continue
    }

    if (value.startsWith('False', i) && !/[\w$]/.test(value[i - 1] ?? '') && !/[\w$]/.test(value[i + 5] ?? '')) {
      output += 'false'
      i += 5
      continue
    }

    if (value.startsWith('None', i) && !/[\w$]/.test(value[i - 1] ?? '') && !/[\w$]/.test(value[i + 4] ?? '')) {
      output += 'null'
      i += 4
      continue
    }

    output += char
    i++
  }

  return output
}

export function repairJsonText(value: string): JsonRepairResult {
  const changes: string[] = []
  const block = findJsonBlock(value)
  let repaired = block ? value.slice(block.start, block.end + 1) : value

  if (repaired !== value) changes.push('提取文本中的 JSON 块')

  const applyRule = (label: string, replacer: (text: string) => string): void => {
    const next = replacer(repaired)
    if (next !== repaired) changes.push(label)
    repaired = next
  }

  applyRule('移除 JSON 注释', removeJsonComments)
  applyRule('移除 trailing comma', removeTrailingCommas)
  applyRule('给未加引号的 key 补双引号', quoteUnquotedKeys)
  applyRule('单引号字符串转双引号', convertSingleQuotedStrings)
  applyRule('Python 布尔/空值转 JSON', replacePythonLiterals)

  let ok = false
  let error = ''
  try {
    JSON.parse(repaired)
    ok = true
  } catch (err) {
    error = err instanceof Error ? err.message : '修复后仍不是合法 JSON'
  }

  return { original: value, repaired, changes, ok, error }
}

function sanitizeTypeName(value: string): string {
  const parts = value.split(/[^A-Za-z0-9_$]+/).filter(Boolean)
  const name = parts
    .map((part) => part.replace(/^[a-z]/, (char) => char.toUpperCase()))
    .join('')
  if (!name) return 'Type'
  return /^[A-Za-z_$]/.test(name) ? name : `Type${name}`
}

function singularizeTypeName(value: string): string {
  if (/ies$/i.test(value)) return value.replace(/ies$/i, 'y')
  if (/(ss|us|is)$/i.test(value)) return value
  if (/s$/i.test(value) && value.length > 1) return value.slice(0, -1)
  return value
}

function formatTsKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
}

function mergeTypeNames(types: string[]): string {
  const unique = [...new Set(types)]
  return unique.length === 1 ? unique[0] : unique.join(' | ')
}

export function jsonToTypeScript(input: unknown, rootName = 'Root', options: JsonToTypeScriptOptions = {}): string {
  const definitions: { name: string; signature: string; code: string }[] = []
  const usedNames = new Set<string>()
  const exportPrefix = options.exportInterfaces ? 'export ' : ''

  const createTypeName = (hint: string): string => {
    const base = sanitizeTypeName(hint)
    let candidate = base
    let suffix = 2
    while (usedNames.has(candidate)) {
      candidate = `${base}${suffix}`
      suffix++
    }
    usedNames.add(candidate)
    return candidate
  }

  const infer = (value: unknown, hint: string): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return 'string'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'

    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]'
      const singularHint = singularizeTypeName(hint)
      const itemHint = singularHint === hint ? `${hint}Item` : singularHint
      const itemTypes = value.map((item) => infer(item, itemHint))
      return `Array<${mergeTypeNames(itemTypes)}>`
    }

    if (typeof value !== 'object') return 'unknown'

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return 'Record<string, unknown>'

    const fields = entries.map(([key, item]) => {
      const childHint = sanitizeTypeName(key)
      return `  ${formatTsKey(key)}: ${infer(item, childHint)}`
    })
    const signature = fields.join('\n')
    const existing = definitions.find((definition) => definition.signature === signature)
    if (existing) return existing.name

    const typeName = createTypeName(hint)
    definitions.push({
      name: typeName,
      signature,
      code: `${exportPrefix}interface ${typeName} {\n${signature}\n}`
    })
    return typeName
  }

  const rootType = infer(input, rootName)
  const orderedDefinitions = options.rootFirst ? [...definitions].reverse() : definitions
  const interfaceCode = orderedDefinitions.map((definition) => definition.code).join('\n\n')
  const rootDeclaration = options.rootAlias ? `${exportPrefix}type ${options.rootAlias} = ${rootType}` : ''
  return [interfaceCode, rootDeclaration].filter(Boolean).join('\n\n')
}

function formatTomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key)
}

function isTomlPrimitive(value: JsonValue): boolean {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function formatTomlValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('TOML 不支持非有限数字')
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatTomlValue(item)).join(', ')}]`
  }
  throw new Error('TOML 不支持该值')
}

function serializeTomlTable(value: { [key: string]: JsonValue }, path: string[], tableKind: 'table' | 'array' = 'table'): string {
  const primitiveLines: string[] = []
  const tableBlocks: string[] = []

  for (const [key, child] of Object.entries(value)) {
    if (child === null) continue

    if (Array.isArray(child)) {
      if (child.length === 0 || child.every((item) => item !== null && !isJsonObject(item))) {
        primitiveLines.push(`${formatTomlKey(key)} = ${formatTomlValue(child)}`)
        continue
      }

      if (!child.every(isJsonObject)) {
        throw new Error(`TOML 数组 ${key} 不能混合对象和普通值`)
      }

      for (const item of child) {
        tableBlocks.push(serializeTomlTable(item, [...path, key], 'array'))
      }
      continue
    }

    if (isJsonObject(child)) {
      tableBlocks.push(serializeTomlTable(child, [...path, key]))
      continue
    }

    if (!isTomlPrimitive(child)) {
      throw new Error(`TOML 不支持字段 ${key}`)
    }

    primitiveLines.push(`${formatTomlKey(key)} = ${formatTomlValue(child)}`)
  }

  const sections: string[] = []
  if (path.length > 0) {
    const header = path.map((part) => formatTomlKey(part)).join('.')
    sections.push(tableKind === 'array' ? `[[${header}]]` : `[${header}]`)
  }
  if (primitiveLines.length > 0) sections.push(primitiveLines.join('\n'))
  sections.push(...tableBlocks)

  return sections.filter(Boolean).join('\n\n')
}

export function jsonToToml(input: unknown): string {
  const value = input as JsonValue
  if (!isJsonObject(value)) throw new Error('JSON 根节点必须是对象才能转换为 TOML')
  return serializeTomlTable(value, [])
}

function formatYamlString(value: string): string {
  return JSON.stringify(value)
}

export function jsonToYaml(input: unknown, indent = 0): string {
  const value = input as JsonValue
  const pad = '  '.repeat(indent)

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return formatYamlString(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('YAML 不支持非有限数字')
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return value
      .map((item) => {
        if (isNonEmptyContainer(item)) return `${pad}-\n${jsonToYaml(item, indent + 1)}`
        return `${pad}- ${jsonToYaml(item, indent)}`
      })
      .join('\n')
  }

  if (isJsonObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    return entries
      .map(([key, item]) => {
        const yamlKey = JSON.stringify(key)
        if (isNonEmptyContainer(item)) return `${pad}${yamlKey}:\n${jsonToYaml(item, indent + 1)}`
        return `${pad}${yamlKey}: ${jsonToYaml(item, indent)}`
      })
      .join('\n')
  }

  return formatYamlString(String(value))
}

export type CsvDelimiter = ',' | ';' | '\t' | '|'

export const CSV_DELIMITERS: readonly CsvDelimiter[] = [',', ';', '\t', '|']

const CSV_BOM = '\uFEFF'

/**
 * 统计首行（引号外）各候选分隔符的出现次数，取最多者。
 * 平局时按 CSV_DELIMITERS 顺序优先，即逗号优先。
 */
export function detectCsvDelimiter(value: string): CsvDelimiter {
  const text = value.startsWith(CSV_BOM) ? value.slice(1) : value
  const counts = new Map<CsvDelimiter, number>(CSV_DELIMITERS.map((d) => [d, 0]))
  let inQuotes = false
  let fieldStart = true

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') i++
        else inQuotes = false
      }
      continue
    }

    if (char === '\n' || char === '\r') break

    if (char === '"' && fieldStart) {
      inQuotes = true
      fieldStart = false
      continue
    }

    const delimiter = CSV_DELIMITERS.find((d) => d === char)
    if (delimiter) {
      counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1)
      fieldStart = true
    } else {
      fieldStart = false
    }
  }

  let best: CsvDelimiter = ','
  let bestCount = counts.get(',') ?? 0
  for (const delimiter of CSV_DELIMITERS) {
    const count = counts.get(delimiter) ?? 0
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/**
 * 按记录解析 CSV。引号规则：只有字段开头（文件开头、分隔符或换行之后）的 " 才进入引号模式；
 * 非引号状态下出现在字段中间的 " 按普通字符处理（例如 5" screen）。
 */
export function parseCsvRecords(value: string, delimiter: CsvDelimiter = ','): string[][] {
  const text = value.startsWith(CSV_BOM) ? value.slice(1) : value
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStart = true
  let recordStarted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && fieldStart) {
      inQuotes = true
      fieldStart = false
      recordStarted = true
      continue
    }

    if (char === delimiter) {
      row.push(field)
      field = ''
      fieldStart = true
      recordStarted = true
      continue
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      if (recordStarted || row.length > 0 || field.length > 0) {
        row.push(field)
        records.push(row)
      }
      row = []
      field = ''
      fieldStart = true
      recordStarted = false
      continue
    }

    field += char
    fieldStart = false
    recordStarted = true
  }

  if (recordStarted || row.length > 0 || field.length > 0) {
    row.push(field)
    records.push(row)
  }

  return records
}

/** 重复名称自动追加 _2、_3 后缀；空名不参与去重（保持为空，由调用方决定占位名）。 */
function dedupeCsvNames(names: string[]): { names: string[]; renamed: CsvRenamedHeader[] } {
  const originals = new Set(names)
  const used = new Set<string>()
  const result: string[] = []
  const renamed: CsvRenamedHeader[] = []

  for (const name of names) {
    if (name === '' || !used.has(name)) {
      used.add(name)
      result.push(name)
      continue
    }
    let suffix = 2
    let candidate = `${name}_${suffix}`
    while (used.has(candidate) || originals.has(candidate)) {
      suffix++
      candidate = `${name}_${suffix}`
    }
    used.add(candidate)
    result.push(candidate)
    renamed.push({ from: name, to: candidate })
  }

  return { names: result, renamed }
}

export interface CsvParseOptions {
  /** 不传则自动识别（见 detectCsvDelimiter） */
  delimiter?: CsvDelimiter
}

/**
 * 解析为表格。rows 保留各行原始列数，不做截断；表头不足时用空字符串补齐到 width。
 * ragged 记录与原始表头列数不一致的数据行下标；renamedHeaders 记录因重复被改名的表头。
 */
export function parseCsvTable(value: string, options: CsvParseOptions = {}): CsvTable {
  const delimiter = options.delimiter ?? detectCsvDelimiter(value)
  const records = parseCsvRecords(value, delimiter)
  if (records.length === 0)
    return { headers: [], rows: [], width: 0, ragged: [], renamedHeaders: [] }

  const [headerRecord, ...rows] = records
  const headerCount = headerRecord.length
  const width = rows.reduce((max, row) => Math.max(max, row.length), headerCount)
  const paddedHeaders = Array.from({ length: width }, (_header, index) => headerRecord[index] ?? '')
  const { names, renamed } = dedupeCsvNames(paddedHeaders)

  const ragged: number[] = []
  rows.forEach((row, index) => {
    if (row.length !== headerCount) ragged.push(index)
  })

  return { headers: names, rows, width, ragged, renamedHeaders: renamed }
}

export function escapeCsvCell(value: string, delimiter: CsvDelimiter = ','): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCsvLine(cells: string[], delimiter: CsvDelimiter): string {
  // 单个空字段的记录必须写成 ""，否则空行会在解析时被跳过，导致整行丢失
  if (cells.length === 1 && cells[0] === '') return '""'
  return cells.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter)
}

/** 序列化时不截断、不补齐数据行，保证原始列都被写回。 */
export function stringifyCsv(data: CsvTable, delimiter: CsvDelimiter = ','): string {
  const lines: string[] = []
  if (data.headers.length > 0) lines.push(formatCsvLine(data.headers, delimiter))
  for (const row of data.rows) lines.push(formatCsvLine(row, delimiter))
  return lines.join('\n')
}

function formatCsvValue(value: JsonValue): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/** 超出表头的列以 column_N 作为键保留，避免 JSON 导出丢数据。 */
export function csvTableToJson(table: CsvTable): string {
  const width = table.rows.reduce((max, row) => Math.max(max, row.length), table.headers.length)
  if (width === 0) return '[]'

  const keys = dedupeCsvNames(
    Array.from({ length: width }, (_key, index) => table.headers[index] || `column_${index + 1}`)
  ).names

  const rows = table.rows.map((row) => {
    const item: Record<string, string> = {}
    keys.forEach((key, index) => {
      item[key] = row[index] ?? ''
    })
    return item
  })

  return JSON.stringify(rows, null, 2)
}

export function csvToJson(value: string): string {
  return csvTableToJson(parseCsvTable(value))
}

export function jsonToCsv(value: string): string {
  const parsed = JSON.parse(value) as JsonValue
  const records = Array.isArray(parsed) ? parsed : [parsed]
  if (records.length === 0) return ''

  if (!records.every(isJsonObject)) {
    throw new Error('JSON → CSV 需要对象或对象数组')
  }

  const headers: string[] = []
  const seen = new Set<string>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }

  const lines = [headers.map((header) => escapeCsvCell(header)).join(',')]
  for (const record of records) {
    lines.push(
      headers
        .map((header) => escapeCsvCell(formatCsvValue(record[header] ?? null)))
        .join(',')
    )
  }

  return lines.join('\n')
}