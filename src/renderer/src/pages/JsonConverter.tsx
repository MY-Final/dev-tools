import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowRight } from 'lucide-react'
import '../styles/json-converter.css'
import { jsonToToml, jsonToTypeScript, jsonToYaml } from '@renderer/lib/data-format-utils'

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

const SAMPLE_TS = JSON.stringify({
  name: 'Alice',
  age: 30,
  email: 'alice@ex.com',
  isActive: true,
  roles: ['admin', 'user'],
  address: { city: 'NYC', zip: '10001' }
}, null, 2)

const SAMPLE_TOML = JSON.stringify({
  title: 'TOML Example',
  owner: { name: 'Tom', dob: '1979-05-27' },
  database: {
    server: '192.168.1.1',
    ports: [8001, 8001, 8002],
    connection_max: 5000,
    enabled: true
  }
}, null, 2)

const SAMPLE_YAML = JSON.stringify({
  name: 'Alice',
  age: 30,
  roles: ['admin', 'user'],
  active: true,
  score: null,
  config: { theme: 'dark', notifications: false }
}, null, 2)

const SAMPLES: Record<ConvertMode, string> = {
  ts: SAMPLE_TS,
  toml: SAMPLE_TOML,
  xml: SAMPLE_TS,
  yaml: SAMPLE_YAML,
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

// ── Component ──────────────────────────────────────────────────

export default function JsonConverter(): React.JSX.Element {
  const [mode, setMode] = useState<ConvertMode>('ts')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const modeDef = MODES.find((m) => m.id === mode)!

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null }
    try {
      const parsed = JSON.parse(input)
      let result = ''
      switch (mode) {
        case 'ts': result = jsonToTypeScript(parsed); break
        case 'toml': result = jsonToToml(parsed).trim(); break
        case 'xml': result = jsonToXml(input); break
        case 'yaml': result = jsonToYaml(parsed); break
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
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }, [output])

  return (
    <div className="jc-page">
      {/* Mode tabs */}
      <div className="jc-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`jc-tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => { setMode(m.id); setInput('') }}
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
            <button className="jc-btn-ghost" onClick={loadSample}>加载示例</button>
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
            <pre className="jc-output">{output || <span className="jc-placeholder">转换结果将显示在这里</span>}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
