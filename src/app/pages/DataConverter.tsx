import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowRightLeft } from 'lucide-react'
import '../styles/data-converter.css'

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
    inputPlaceholder: '{"root":{"item":[{"name":"Alice","age":30}]}}'
  }
]

// ── Converters ─────────────────────────────────────────────────

function csvToJson(csv: string): string {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return '[]'

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = values[j] || '' })
    rows.push(row)
  }

  return JSON.stringify(rows, null, 2)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current.trim()); current = '' }
      else current += ch
    }
  }
  result.push(current.trim())
  return result
}

function jsonToCsv(json: string): string {
  const data = JSON.parse(json)
  const arr = Array.isArray(data) ? data : [data]
  if (arr.length === 0) return ''

  const headers = Object.keys(arr[0])
  const lines = [headers.join(',')]

  for (const row of arr) {
    const values = headers.map((h) => {
      const v = row[h]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

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

function jsonToXml(json: string): string {
  const data = JSON.parse(json)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + valueToXml(data, 'root')
}

function valueToXml(value: unknown, tag: string): string {
  if (value === null || value === undefined) return `<${tag} />`
  if (typeof value !== 'object') return `<${tag}>${escapeXml(String(value))}</${tag}>`

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'object' && !Array.isArray(item)) {
        const keys = Object.keys(item)
        const subTag = keys.length === 1 ? keys[0] : tag.slice(0, -1)
        return objectToXml(item as Record<string, unknown>, subTag)
      }
      return valueToXml(item, tag.slice(0, -1))
    }).join('\n')
  }

  return objectToXml(value as Record<string, unknown>, tag)
}

function objectToXml(obj: Record<string, unknown>, tag: string): string {
  let attrs = ''
  let children = ''

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('@')) {
      attrs += ` ${key.slice(1)}="${escapeXml(String(val))}"`
    } else if (key === '#text') {
      children = escapeXml(String(val))
    } else {
      children += valueToXml(val, key) + '\n'
    }
  }

  children = children.trimEnd()
  if (!children) return `<${tag}${attrs} />`
  return `<${tag}${attrs}>\n${children}\n</${tag}>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Samples ────────────────────────────────────────────────────

const SAMPLES: Record<ConvertMode, string> = {
  csv2json: 'name,age,city,role\nAlice,30,New York,Engineer\nBob,25,Los Angeles,Designer\nCharlie,35,Chicago,Manager',
  json2csv: '[{"name":"Alice","age":30,"city":"New York"},{"name":"Bob","age":25,"city":"Los Angeles"},{"name":"Charlie","age":35,"city":"Chicago"}]',
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
  json2xml: '{"root":{"person":[{"@id":"1","name":"Alice","age":30},{"@id":"2","name":"Bob","age":25}]}}'
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
        case 'csv2json': result = csvToJson(input); break
        case 'json2csv': result = jsonToCsv(input); break
        case 'xml2json': result = xmlToJson(input); break
        case 'json2xml': result = jsonToXml(input); break
      }
      return { output: result, error: null }
    } catch (err) {
      return { output: '', error: (err as Error).message }
    }
  }, [input, mode])

  const loadSample = useCallback(() => {
    setInput(SAMPLES[mode])
  }, [mode])

  const swap = useCallback(() => {
    if (!output || error) return
    setInput(output)
  }, [output, error])

  const clear = useCallback(() => setInput(''), [])

  const copy = useCallback(async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
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
              onClick={() => { setMode(m.id); setInput('') }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="dc-pane">
          <div className="dc-pane-header">
            <span className="dc-pane-label">{modeDef.inputLabel}</span>
            <button className="dc-btn-ghost" onClick={loadSample}>示例</button>
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
