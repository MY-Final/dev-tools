import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowRight, FileText } from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import {
  parseJsonDocument,
  stringifyTomlDocument,
  stringifyXmlDocument,
  stringifyYamlDocument
} from '@renderer/lib/data-formats'
import { jsonToTypeScript } from '@renderer/lib/data-format-utils'
import '../styles/json-converter.css'

type ConvertMode = 'ts' | 'toml' | 'xml' | 'yaml'

interface ModeDef {
  id: ConvertMode
  label: string
  outputLabel: string
  extension: string
}

const MODES: ModeDef[] = [
  { id: 'ts', label: 'JSON → TypeScript', outputLabel: 'TypeScript', extension: 'ts' },
  { id: 'toml', label: 'JSON → TOML', outputLabel: 'TOML', extension: 'toml' },
  { id: 'xml', label: 'JSON → XML', outputLabel: 'XML', extension: 'xml' },
  { id: 'yaml', label: 'JSON → YAML', outputLabel: 'YAML', extension: 'yaml' }
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

const SAMPLE_XML = JSON.stringify(
  {
    person: {
      '@_id': '1',
      name: 'Alice',
      tags: { tag: ['admin', 'user'] }
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
  xml: SAMPLE_XML,
  yaml: SAMPLE_YAML
}

/** Counts null-valued keys anywhere in the tree; TOML has no null type. */
function countNulls(value: unknown): number {
  if (value === null) return 1
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countNulls(item), 0)
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, item) => sum + countNulls(item),
      0
    )
  }
  return 0
}

interface Conversion {
  output: string
  error: string
  warnings: string[]
}

const EMPTY: Conversion = { output: '', error: '', warnings: [] }

function convert(input: string, mode: ConvertMode): Conversion {
  const parsed = parseJsonDocument(input)
  if (!parsed.ok) return { output: '', error: parsed.error, warnings: [] }

  try {
    switch (mode) {
      case 'ts':
        return { output: jsonToTypeScript(parsed.data), error: '', warnings: [] }
      case 'toml': {
        const nulls = countNulls(parsed.data)
        return {
          output: stringifyTomlDocument(parsed.data).trimEnd(),
          error: '',
          warnings: nulls > 0 ? [`TOML 没有 null 类型，已省略 ${nulls} 个值为 null 的字段`] : []
        }
      }
      case 'xml':
        return { output: stringifyXmlDocument(parsed.data), error: '', warnings: [] }
      case 'yaml':
        return { output: stringifyYamlDocument(parsed.data).trimEnd(), error: '', warnings: [] }
    }
  } catch (err) {
    return { output: '', error: (err as Error).message, warnings: [] }
  }
}

export default function JsonConverter(): React.JSX.Element {
  const [mode, setMode] = useState<ConvertMode>('ts')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const modeDef = MODES.find((m) => m.id === mode) ?? MODES[0]

  const result = useMemo(() => (input.trim() ? convert(input, mode) : EMPTY), [input, mode])

  const loadSample = useCallback(() => setInput(SAMPLES[mode]), [mode])
  const clear = useCallback(() => setInput(''), [])
  const copy = useCallback(async () => {
    if (!result.output) return
    try {
      await navigator.clipboard.writeText(result.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard permissions can be denied; the text stays selectable */
    }
  }, [result.output])

  return (
    <div className="jc-page">
      <div className="jc-card">
        <div className="jc-header">
          <FileText size={20} />
          <h1 className="jc-title">JSON Converter</h1>
          <p className="jc-subtitle">JSON 转 TypeScript 类型、TOML、XML、YAML</p>
        </div>

        <TextFileBar
          value={input}
          onOpened={(file) => setInput(file.content)}
          onNew={clear}
          suggestedName={`converted.${modeDef.extension}`}
        />

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

        <div className="jc-panes">
          <div className="jc-pane">
            <div className="jc-pane-header">
              <span className="jc-pane-label">
                <span className="jc-label-dot jc-dot-input" />
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

          <div className="jc-arrow">
            <ArrowRight size={18} />
          </div>

          <div className="jc-pane">
            <div className="jc-pane-header">
              <span className="jc-pane-label">
                <span className="jc-label-dot jc-dot-output" />
                {modeDef.outputLabel}
              </span>
              <div className="jc-pane-actions">
                <button className="jc-btn-ghost" onClick={clear}>
                  <RotateCcw size={12} /> 清空
                </button>
                {result.output && (
                  <button className="jc-btn-ghost" onClick={copy}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                )}
              </div>
            </div>
            {result.error ? (
              <div className="jc-error">{result.error}</div>
            ) : (
              <pre className="jc-output">
                {result.output || <span className="jc-placeholder">转换结果将显示在这里</span>}
              </pre>
            )}
          </div>
        </div>

        {result.warnings.length > 0 && (
          <ul className="jc-warnings">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
