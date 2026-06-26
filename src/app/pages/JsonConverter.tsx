import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/json-converter.css'

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
  { id: 'yaml', label: 'JSON → YAML', outputLabel: 'YAML' },
]

const SAMPLE_TS = `{
  "name": "Alice",
  "age": 30,
  "email": "alice@ex.com",
  "isActive": true,
  "roles": ["admin", "user"],
  "address": {
    "city": "NYC",
    "zip": "10001"
  }
}`

const SAMPLE_TOML = `{
  "title": "TOML Example",
  "owner": {
    "name": "Tom",
    "dob": "1979-05-27"
  },
  "database": {
    "server": "192.168.1.1",
    "ports": [8001, 8001, 8002],
    "connection_max": 5000,
    "enabled": true
  }
}`

const SAMPLE_YAML = `{
  "name": "Alice",
  "age": 30,
  "roles": ["admin", "user"],
  "active": true,
  "score": null,
  "config": {
    "theme": "dark",
    "notifications": false
  }
}`

// ── JSON to TypeScript ─────────────────────────────────────────

function jsonToTS(obj: unknown, name = 'Root'): string {
  if (obj === null || obj === undefined) return `type ${name} = null`
  if (typeof obj !== 'object') return `type ${name} = ${typeof obj}`

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `type ${name} = unknown[]`
    const itemTypes = [...new Set(obj.map((item) => jsonToTS(item, name + 'Item')))]
    return `type ${name} = ${itemTypes.join(' | ')}[]`
  }

  const entries = Object.entries(obj as Record<string, unknown>)
  if (entries.length === 0) return `type ${name} = Record<string, unknown>`

  const props = entries.map(([key, val]) => {
    const typeName = toPascalCase(key) + 'Type'
    let typeStr = jsonToTS(val, typeName)
    // Clean up: if typeStr is a full type definition, extract just the name
    if (typeStr.startsWith('type ')) {
      const match = typeStr.match(/^type (\w+) = (.+)$/)
      if (match && match[1] !== name) {
        typeStr = match[2]
      }
    }
    return `  ${key}: ${typeStr}`
  })

  return `interface ${name} {\n${props.join('\n')}\n}`
}

function toPascalCase(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase())
}

// ── JSON to XML ────────────────────────────────────────────────

function jsonToXml(json: string): string {
  const data = JSON.parse(json)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + valToXml(data, 'root')
}

function valToXml(val: unknown, tag: string): string {
  if (val === null || val === undefined) return `<${tag} />`
  if (typeof val !== 'object') return `<${tag}>${escXml(String(val))}</${tag}>`

  if (Array.isArray(val)) {
    return val.map((item) => objToXml(item as Record<string, unknown>, tag.slice(0, -1) || 'item')).join('\n')
  }

  return objToXml(val as Record<string, unknown>, tag)
}

function objToXml(obj: Record<string, unknown>, tag: string): string {
  let attrs = ''
  let children = ''
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('@')) { attrs += ` ${k.slice(1)}="${escXml(String(v))}"`; continue }
    if (k === '#text') { children = escXml(String(v)); continue }
    if (Array.isArray(v)) {
      children += v.map((item) => valToXml(item, k)).join('\n') + '\n'
    } else if (typeof v === 'object' && v !== null) {
      children += valToXml(v, k) + '\n'
    } else {
      children += valToXml(v, k) + '\n'
    }
  }
  children = children.trimEnd()
  if (!children) return `<${tag}${attrs} />`
  return `<${tag}${attrs}>\n${children}\n</${tag}>`
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── JSON to TOML ───────────────────────────────────────────────

function jsonToToml(obj: unknown, prefix = ''): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj !== 'object') return `${prefix}= ${formatTomlValue(obj)}\n`

  if (Array.isArray(obj)) {
    if (obj.every((i) => typeof i !== 'object' || i === null)) {
      return `${prefix}= [${obj.map((i) => formatTomlValue(i)).join(', ')}]\n`
    }
    return obj.map((item) => jsonToToml(item, prefix)).join('')
  }

  const entries = Object.entries(obj as Record<string, unknown>)
  const primitives: string[] = []
  const tables: string[] = []

  for (const [k, v] of entries) {
    if (v === null || v === undefined) continue
    if (typeof v !== 'object' || (Array.isArray(v) && v.every((i) => typeof i !== 'object'))) {
      primitives.push(`${k}= ${formatTomlValue(v)}`)
    } else {
      tables.push(formatTomlTable(k, v, prefix ? prefix + '.' + k : k))
    }
  }

  let out = prefix ? `[${prefix}]\n` : ''
  out += primitives.join('\n')
  if (primitives.length > 0) out += '\n'
  out += tables.map((t) => '\n' + t).join('')
  return out
}

function formatTomlValue(v: unknown): string {
  if (v === null) return ''
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return `[${v.map((i) => formatTomlValue(i)).join(', ')}]`
  return String(v)
}

function formatTomlTable(key: string, val: unknown, path: string): string {
  if (typeof val !== 'object') return `${key}= ${formatTomlValue(val)}\n`
  if (Array.isArray(val)) {
    return val.map((item) => formatTomlTable(key, item, path)).join('\n')
  }
  return jsonToToml(val, path)
}

// ── JSON to YAML ───────────────────────────────────────────────

function jsonToYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(': ') || obj.includes('#')) {
      return JSON.stringify(obj)
    }
    return obj
  }
  if (typeof obj === 'boolean') return obj ? 'true' : 'false'
  if (typeof obj === 'number') return String(obj)

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item) => {
      if (typeof item === 'object' && item !== null) {
        return '\n' + pad + '- ' + jsonToYaml(item, indent + 1).trimStart()
      }
      return '\n' + pad + '- ' + jsonToYaml(item, indent)
    }).join('').trimStart()
  }

  const entries = Object.entries(obj as Record<string, unknown>)
  if (entries.length === 0) return '{}'

  return entries.map(([k, v]) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return `${k}:\n` + jsonToYaml(v, indent + 1)
    }
    return `${k}: ${jsonToYaml(v, indent)}`
  }).join('\n')
}

// ── Component ──────────────────────────────────────────────────

const SAMPLES: Record<ConvertMode, string> = {
  ts: SAMPLE_TS,
  toml: SAMPLE_TOML,
  xml: SAMPLE_TS,
  yaml: SAMPLE_YAML,
}

export default function JsonConverter(): React.JSX.Element {
  const [mode, setMode] = useState<ConvertMode>('ts')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const modeDef = MODES.find((m) => m.id === mode)!

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null }
    try {
      // Validate JSON first
      JSON.parse(input)
      let result = ''
      switch (mode) {
        case 'ts': result = jsonToTS(JSON.parse(input)); break
        case 'toml': result = jsonToToml(JSON.parse(input)).trim(); break
        case 'xml': result = jsonToXml(input); break
        case 'yaml': result = jsonToYaml(JSON.parse(input)); break
      }
      return { output: result, error: null }
    } catch (err) {
      return { output: '', error: (err as Error).message }
    }
  }, [input, mode])

  const loadSample = useCallback(() => setInput(SAMPLES[mode]), [mode])
  const clear = useCallback(() => setInput(''), [])
  const copy = useCallback(async () => {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }, [output])

  return (
    <div className="jc-page">
      <div className="jc-card">
        <div className="jc-header">
          <h2 className="jc-title">JSON Converter</h2>
          <p className="jc-subtitle">JSON → TypeScript · TOML · XML · YAML</p>
        </div>

        <div className="jc-tabs">
          {MODES.map((m) => (
            <button key={m.id} className={`jc-tab ${mode === m.id ? 'active' : ''}`} onClick={() => { setMode(m.id); setInput('') }}>{m.label}</button>
          ))}
        </div>

        <div className="jc-pane">
          <div className="jc-pane-header">
            <span className="jc-pane-label">JSON</span>
            <button className="jc-btn-ghost" onClick={loadSample}>示例</button>
          </div>
          <textarea className="jc-textarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder="粘贴 JSON..." rows={6} spellCheck={false} />
        </div>

        <div className="jc-actions">
          <button className="jc-btn jc-btn-ghost" onClick={clear}><RotateCcw size={13} />清空</button>
        </div>

        {error && <div className="jc-error">{error}</div>}

        {output && (
          <div className="jc-pane">
            <div className="jc-pane-header">
              <span className="jc-pane-label">{modeDef.outputLabel}</span>
              <button className="jc-btn-ghost" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button>
            </div>
            <pre className="jc-output">{output}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
