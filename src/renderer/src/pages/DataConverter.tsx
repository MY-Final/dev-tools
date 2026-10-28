import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowRightLeft } from 'lucide-react'
import '../styles/data-converter.css'
import { csvToJson, jsonToCsv } from '@renderer/lib/data-format-utils'

type ConvertMode = 'csv2json' | 'json2csv' | 'xml2json' | 'json2xml'

interface ModeDef {
  id: ConvertMode
  label: string
  inputLabel: string
  outputLabel: string
  inputPlaceholder: string
}

const MODES: ModeDef[] = [
  {
    id: 'csv2json',
    label: 'CSV → JSON',
    inputLabel: 'CSV',
    outputLabel: 'JSON',
    inputPlaceholder: 'name,age,city\nAlice,30,NYC\nBob,25,LA'
  },
  {
    id: 'json2csv',
    label: 'JSON → CSV',
    inputLabel: 'JSON',
    outputLabel: 'CSV',
    inputPlaceholder: '[{"name":"Alice","age":30},{"name":"Bob","age":25}]'
  },
  {
    id: 'xml2json',
    label: 'XML → JSON',
    inputLabel: 'XML',
    outputLabel: 'JSON',
    inputPlaceholder: '<root><item><name>Alice</name><age>30</age></item></root>'
  },
  {
    id: 'json2xml',
    label: 'JSON → XML',
    inputLabel: 'JSON',
    outputLabel: 'XML',
    inputPlaceholder: '{"persons":[{"@id":"1","name":"Alice","age":30}]}'
  }
]

// 反向模式：把输出替换为输入时切换到对应的逆向转换
const REVERSE_MODE: Record<ConvertMode, ConvertMode> = {
  csv2json: 'json2csv',
  json2csv: 'csv2json',
  xml2json: 'json2xml',
  json2xml: 'xml2json'
}

// ── Converters ─────────────────────────────────────────────────

function xmlToJson(xml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('XML 解析错误')

  const result = nodeToJson(doc.documentElement)
  return JSON.stringify(result, null, 2)
}

function nodeToJson(node: Element): unknown {
  const obj: Record<string, unknown> = {}

  // Attributes
  if (node.attributes.length > 0) {
    for (let i = 0; i < node.attributes.length; i++) {
      obj['@' + node.attributes[i].name] = node.attributes[i].value
    }
  }

  // Children
  const childElements = Array.from(node.children)
  const textContent = node.textContent?.trim() || ''

  if (childElements.length === 0) {
    return textContent || ''
  }

  // Group children by tag name
  const groups: Map<string, Element[]> = new Map()
  for (const child of childElements) {
    const name = child.tagName
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name)!.push(child)
  }

  for (const [name, children] of groups) {
    const values = children.map(nodeToJson)
    obj[name] = values.length === 1 ? values[0] : values
  }

  // Text content
  if (textContent && childElements.length > 0) {
    const textOnly = node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE
    if (!textOnly) obj['#text'] = textContent
  }

  return obj
}

// ── JSON → XML（与 JsonConverter 中的实现保持一致）─────────────

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

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
  return objToXml(tag, value as Record<string, unknown>)
}

function objToXml(tag: string, obj: Record<string, unknown>): string {
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

// ── Samples ────────────────────────────────────────────────────

const SAMPLES: Record<ConvertMode, string> = {
  csv2json:
    'name,age,city,role\nAlice,30,New York,Engineer\nBob,25,Los Angeles,Designer\nCharlie,35,Chicago,Manager',
  json2csv:
    '[{"name":"Alice","age":30,"city":"New York"},{"name":"Bob","age":25,"city":"Los Angeles"},{"name":"Charlie","age":35,"city":"Chicago"}]',
  xml2json: `<root>
  <person id="1">
    <name>Alice</name>
    <age>30</age>
    <city>New York</city>
  </person>
  <person id="2">
    <name>Bob</name>
    <age>25</age>
    <city>Los Angeles</city>
  </person>
</root>`,
  json2xml: '{"persons":[{"@id":"1","name":"Alice","age":30},{"@id":"2","name":"Bob","age":25}]}'
}

// ── Component ──────────────────────────────────────────────────

export default function DataConverter(): React.JSX.Element {
  const [mode, setMode] = useState<ConvertMode>('csv2json')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const modeDef = MODES.find((m) => m.id === mode)!

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null }
    try {
      let result = ''
      switch (mode) {
        case 'csv2json':
          result = csvToJson(input)
          break
        case 'json2csv':
          result = jsonToCsv(input)
          break
        case 'xml2json':
          result = xmlToJson(input)
          break
        case 'json2xml':
          result = jsonToXml(JSON.parse(input))
          break
      }
      return { output: result, error: null }
    } catch (err) {
      const message =
        err instanceof SyntaxError ? `JSON 格式错误：${err.message}` : (err as Error).message
      return { output: '', error: message }
    }
  }, [input, mode])

  const loadSample = useCallback(() => {
    setInput(SAMPLES[mode])
  }, [mode])

  const swap = useCallback(() => {
    if (!output || error) return
    setInput(output)
    setMode(REVERSE_MODE[mode])
  }, [output, error, mode])

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
    <div className="dc-page">
      <div className="dc-card">
        <div className="dc-header">
          <h2 className="dc-title">Data Format Converter</h2>
          <p className="dc-subtitle">CSV · JSON · XML 互转</p>
        </div>

        {/* Mode tabs */}
        <div className="dc-tabs">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`dc-tab ${mode === m.id ? 'active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="dc-pane">
          <div className="dc-pane-header">
            <span className="dc-pane-label">{modeDef.inputLabel}</span>
            <button className="dc-btn-ghost" onClick={loadSample}>
              示例
            </button>
          </div>
          <textarea
            className="dc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={modeDef.inputPlaceholder}
            rows={8}
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="dc-actions">
          <button className="dc-btn dc-btn-ghost" onClick={clear}>
            <RotateCcw size={13} />
            清空
          </button>
          {output && (
            <button className="dc-btn dc-btn-ghost" onClick={swap}>
              <ArrowRightLeft size={13} />
              替换为输入
            </button>
          )}
        </div>

        {/* Error */}
        {error && <div className="dc-error">{error}</div>}

        {/* Output */}
        {output && (
          <div className="dc-pane">
            <div className="dc-pane-header">
              <span className="dc-pane-label">{modeDef.outputLabel}</span>
              <button className="dc-btn-ghost" onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <pre className="dc-output">{output}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
