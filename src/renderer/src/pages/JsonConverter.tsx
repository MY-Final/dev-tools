import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowRight } from 'lucide-react'
import '../styles/json-converter.css'
import { jsonToTypeScript } from '@renderer/lib/data-format-utils'

type ConvertMode = 'ts' | 'toml' | 'xml' | 'yaml'

interface ModeDef {
  id: ConvertMode
  label: string
  outputLabel: string
}

const MODES: ModeDef[] = [
  { id: 'ts', label: 'JSON → TypeScript', outputLabel: 'TypeScript' },
  { id: 'toml', label: 'JSON → TOML', outputLabel: 'TOML' },
  { id: 'xml', label: 'JSON → XML', outputLabel: 'XML' },
  { id: 'yaml', label: 'JSON → YAML', outputLabel: 'YAML' }
]

const SAMPLE_TS = JSON.stringify(
  {
    name: 'Alice',
    age: 30,
    email: 'alice@ex.com',
    isActive: true,
    roles: ['admin', 'user'],
    address: { city: 'NYC', zip: '10001' }
  },
  null,
  2
)

const SAMPLE_TOML = JSON.stringify(
  {
    title: 'TOML Example',
    owner: { name: 'Tom', dob: '1979-05-27' },
    database: {
      server: '192.168.1.1',
      ports: [8001, 8001, 8002],
      connection_max: 5000,
      enabled: true
    }
  },
  null,
  2
)

const SAMPLE_YAML = JSON.stringify(
  {
    name: 'Alice',
    age: 30,
    roles: ['admin', 'user'],
    active: true,
    score: null,
    config: { theme: 'dark', notifications: false }
  },
  null,
  2
)

const SAMPLES: Record<ConvertMode, string> = {
  ts: SAMPLE_TS,
  toml: SAMPLE_TOML,
  xml: SAMPLE_TS,
  yaml: SAMPLE_YAML
}

// ── 纯转换函数（与 DataConverter 中的 XML 生成保持一致）──────────

type JsonObject = Record<string, unknown>

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyContainer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return isPlainObject(value) && Object.keys(value).length > 0
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── JSON → XML ─────────────────────────────────────────────────

/**
 * 数组元素的标签名：取数组所在键名的单数形式。
 * 只处理能安全判断的情况，无法判断时返回 null，调用方回退为 item。
 */
function singularizeTag(tag: string): string | null {
  if (!tag || /(ss|us|is)$/i.test(tag)) return null
  let singular: string
  if (/ies$/i.test(tag))
    singular = tag.slice(0, -3) + 'y' // companies -> company
  else if (/sses$/i.test(tag))
    singular = tag.slice(0, -2) // addresses -> address
  else if (/(x|ch|sh|z)es$/i.test(tag))
    singular = tag.slice(0, -2) // boxes -> box
  else if (/s$/i.test(tag))
    singular = tag.slice(0, -1) // items -> item
  else return null
  return singular || null
}

/** 把任意键名修正为合法 XML 名称（非法字符替换为 _，开头不合法时加 _ 前缀）。 */
function xmlName(raw: string): string {
  const name = raw.replace(/[^\p{L}\p{N}_.-]/gu, '_')
  return /^[\p{L}_]/u.test(name) ? name : `_${name}`
}

function xmlText(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return escXml(text)
}

/** 键 name 对应的节点：数组展开为重复元素，元素名取单数形式或 item。 */
function xmlNodes(name: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `<${xmlName(name)} />`
    const itemName = singularizeTag(name) ?? 'item'
    return value.map((item) => xmlElement(itemName, item)).join('\n')
  }
  return xmlElement(name, value)
}

function xmlElement(name: string, value: unknown): string {
  const tag = xmlName(name)
  if (value === null || value === undefined) return `<${tag} />`
  if (Array.isArray(value)) {
    if (value.length === 0) return `<${tag} />`
    return `<${tag}>\n${xmlNodes(name, value)}\n</${tag}>`
  }
  if (typeof value !== 'object') return `<${tag}>${xmlText(value)}</${tag}>`
  return objToXml(tag, value as JsonObject)
}

function objToXml(tag: string, obj: JsonObject): string {
  let attrs = ''
  let text: string | null = null
  const children: string[] = []

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('@')) {
      attrs += ` ${xmlName(key.slice(1))}="${xmlText(val)}"`
    } else if (key === '#text') {
      text = xmlText(val)
    } else {
      children.push(xmlNodes(key, val))
    }
  }

  if (children.length === 0) {
    if (text === null) return `<${tag}${attrs} />`
    return `<${tag}${attrs}>${text}</${tag}>`
  }
  const lines = text === null ? children : [text, ...children]
  return `<${tag}${attrs}>\n${lines.join('\n')}\n</${tag}>`
}

/** 顶层固定包一层 <root>；数组元素统一为 item（根节点名无法单数化）。 */
function jsonToXml(data: unknown): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlElement('root', data)
}

// ── JSON → TOML ────────────────────────────────────────────────

function tomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key)
}

function tomlInline(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('TOML 不支持非有限数字')
    return String(value)
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      if (item === null) throw new Error('TOML 数组不支持 null 元素')
      if (isPlainObject(item)) throw new Error('TOML 数组不能同时包含对象和普通值')
      return tomlInline(item)
    })
    return `[${items.join(', ')}]`
  }
  throw new Error('TOML 不支持该值')
}

function tomlSection(obj: JsonObject, path: string[], isArrayItem: boolean): string {
  const lines: string[] = []
  const subSections: string[] = []

  for (const [key, child] of Object.entries(obj)) {
    const name = tomlKey(key)
    if (child === null) {
      // TOML 没有 null 类型，保留为注释而不是静默丢弃
      lines.push(`# ${name} = null  # TOML 无 null 类型，此处仅作注释保留`)
    } else if (isPlainObject(child)) {
      subSections.push(tomlSection(child, [...path, key], false))
    } else if (
      Array.isArray(child) &&
      child.length > 0 &&
      child.every((item) => isPlainObject(item))
    ) {
      for (const item of child as JsonObject[]) {
        subSections.push(tomlSection(item, [...path, key], true))
      }
    } else {
      lines.push(`${name} = ${tomlInline(child)}`)
    }
  }

  const header = path.length > 0 ? path.map(tomlKey).join('.') : ''
  const headerLine = header ? (isArrayItem ? `[[${header}]]` : `[${header}]`) : ''
  const own = [headerLine, ...lines].filter(Boolean).join('\n')
  return [own, ...subSections].filter(Boolean).join('\n\n')
}

function jsonToToml(data: unknown): string {
  if (!isPlainObject(data)) throw new Error('JSON 根节点必须是对象才能转换为 TOML')
  return tomlSection(data, [], false)
}

// ── JSON → YAML ────────────────────────────────────────────────

const YAML_INDICATOR = /[:#{}[\],&*!|>'"%@`]/
const YAML_RESERVED = /^(?:~|null|true|false|yes|no|on|off|y|n)$/i
const YAML_NUMBER_LIKE =
  /^(?:[-+]?(?:\d[\d_]*(?:\.\d*)?(?:e[-+]?\d+)?|\.\d+(?:e[-+]?\d+)?|\.(?:inf|nan))|0[xo][0-9a-f]+)$/i
const YAML_DATE_LIKE = /^\d{4}-\d{1,2}-\d{1,2}/

function yamlNeedsQuote(s: string): boolean {
  if (s === '') return true
  if (/^\s|\s$/.test(s)) return true
  if (/^[-?]/.test(s)) return true
  if ([...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return true
  return (
    YAML_INDICATOR.test(s) ||
    YAML_RESERVED.test(s) ||
    YAML_NUMBER_LIKE.test(s) ||
    YAML_DATE_LIKE.test(s)
  )
}

/** 只对需要的字符串加双引号，其余裸写（键名同样适用）。 */
function yamlString(s: string): string {
  return yamlNeedsQuote(s) ? JSON.stringify(s) : s
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return yamlString(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('YAML 不支持非有限数字')
    return String(value)
  }
  if (Array.isArray(value)) return '[]'
  return '{}'
}

function yamlLines(value: unknown, pad: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item): string[] => {
      if (isNonEmptyContainer(item)) {
        // 首行并入 "- "，其余行保持缩进
        const [first, ...rest] = yamlLines(item, `${pad}  `)
        return [`${pad}- ${first.slice(pad.length + 2)}`, ...rest]
      }
      return [`${pad}- ${yamlScalar(item)}`]
    })
  }
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, item]): string[] => {
      const yamlKey = yamlString(key)
      if (isNonEmptyContainer(item)) return [`${pad}${yamlKey}:`, ...yamlLines(item, `${pad}  `)]
      return [`${pad}${yamlKey}: ${yamlScalar(item)}`]
    })
  }
  return [`${pad}${yamlScalar(value)}`]
}

function jsonToYaml(data: unknown): string {
  if (isNonEmptyContainer(data)) return yamlLines(data, '').join('\n')
  return yamlScalar(data)
}

// ── Component ──────────────────────────────────────────────────

export default function JsonConverter(): React.JSX.Element {
  const [mode, setMode] = useState<ConvertMode>('ts')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const modeDef = MODES.find((m) => m.id === mode)!

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null }
    try {
      const parsed: unknown = JSON.parse(input)
      let result = ''
      switch (mode) {
        case 'ts':
          result = jsonToTypeScript(parsed)
          break
        case 'toml':
          result = jsonToToml(parsed).trim()
          break
        case 'xml':
          result = jsonToXml(parsed)
          break
        case 'yaml':
          result = jsonToYaml(parsed)
          break
      }
      return { output: result, error: null }
    } catch (err) {
      const message =
        err instanceof SyntaxError ? `JSON 格式错误：${err.message}` : (err as Error).message
      return { output: '', error: message }
    }
  }, [input, mode])

  const loadSample = useCallback(() => setInput(SAMPLES[mode]), [mode])
  const clear = useCallback(() => setInput(''), [])
  const copy = useCallback(async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [output])

  return (
    <div className="jc-page">
      {/* Mode tabs */}
      <div className="jc-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`jc-tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Split panes */}
      <div className="jc-panes">
        {/* Input */}
        <div className="jc-pane">
          <div className="jc-pane-header">
            <span className="jc-pane-label">
              <span className="jc-label-dot" style={{ background: '#06b6d4' }} />
              JSON
            </span>
            <button className="jc-btn-ghost" onClick={loadSample}>
              加载示例
            </button>
          </div>
          <textarea
            className="jc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="在此粘贴 JSON 数据..."
            spellCheck={false}
          />
        </div>

        {/* Arrow connector */}
        <div className="jc-arrow">
          <ArrowRight size={18} />
        </div>

        {/* Output */}
        <div className="jc-pane">
          <div className="jc-pane-header">
            <span className="jc-pane-label">
              <span className="jc-label-dot" style={{ background: '#22c55e' }} />
              {modeDef.outputLabel}
            </span>
            <div className="jc-pane-actions">
              <button className="jc-btn-ghost" onClick={clear}>
                <RotateCcw size={12} /> 清空
              </button>
              {output && (
                <button className="jc-btn-ghost" onClick={copy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制'}
                </button>
              )}
            </div>
          </div>
          {error ? (
            <div className="jc-error">{error}</div>
          ) : (
            <pre className="jc-output">
              {output || <span className="jc-placeholder">转换结果将显示在这里</span>}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
