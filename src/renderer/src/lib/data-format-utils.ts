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

export interface JsonToTypeScriptOptions {
  exportInterfaces?: boolean
  rootAlias?: string
  rootFirst?: boolean
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
