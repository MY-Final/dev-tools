import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowRight, ArrowLeftRight, FileText } from 'lucide-react'
import {
  DATA_FORMATS,
  convertDocument,
  getFormatInfo,
  type FormatId
} from '@renderer/lib/data-formats'
import TextFileBar from '@renderer/components/TextFileBar'
import '../styles/data-converter.css'

const SAMPLES: Record<FormatId, string> = {
  json: '{\n  "name": "Alice",\n  "age": 30,\n  "roles": ["admin", "user"],\n  "address": {\n    "city": "NYC",\n    "zip": "10001"\n  }\n}',
  yaml: 'name: Alice\nage: 30\nroles:\n  - admin\n  - user\naddress:\n  city: NYC\n  zip: "10001"',
  toml: 'name = "Alice"\nage = 30\nroles = [ "admin", "user" ]\n\n[address]\ncity = "NYC"\nzip = "10001"',
  xml: '<person id="1">\n  <name>Alice</name>\n  <age>30</age>\n  <roles>admin</roles>\n  <roles>user</roles>\n</person>',
  csv: 'name,age,city,role\nAlice,30,New York,Engineer\nBob,25,Los Angeles,Designer\nCharlie,35,Chicago,Manager',
  tsv: 'name\tage\tcity\nAlice\t30\tNew York\nBob\t25\tLos Angeles'
}

const PAIRS: Array<{ from: FormatId; to: FormatId; label: string }> = [
  { from: 'csv', to: 'json', label: 'CSV → JSON' },
  { from: 'json', to: 'csv', label: 'JSON → CSV' },
  { from: 'json', to: 'yaml', label: 'JSON → YAML' },
  { from: 'yaml', to: 'json', label: 'YAML → JSON' },
  { from: 'json', to: 'toml', label: 'JSON → TOML' },
  { from: 'xml', to: 'json', label: 'XML → JSON' }
]

function FormatSelect({
  value,
  onChange,
  label,
  exclude
}: {
  value: FormatId
  onChange: (next: FormatId) => void
  label: string
  exclude?: FormatId
}): React.JSX.Element {
  return (
    <label className="dc-select-field">
      <span className="dc-select-label">{label}</span>
      <select
        className="dc-select"
        value={value}
        onChange={(e) => onChange(e.target.value as FormatId)}
      >
        {DATA_FORMATS.filter((format) => format.id !== exclude).map((format) => (
          <option key={format.id} value={format.id}>
            {format.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function DataConverter(): React.JSX.Element {
  const [from, setFrom] = useState<FormatId>('csv')
  const [to, setTo] = useState<FormatId>('json')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const conversion = useMemo(() => {
    if (!input.trim()) return null
    return convertDocument(input, from, to)
  }, [input, from, to])

  const output = conversion?.ok ? conversion.output : ''
  const error = conversion && !conversion.ok ? conversion.error : ''
  const warnings = conversion?.warnings ?? []

  const loadSample = useCallback(() => setInput(SAMPLES[from]), [from])

  const openFile = useCallback((content: string) => {
    setInput(content)
    // Guess the source format from the first non-empty line so opening a
    // file does not silently convert it with the wrong reader.
    const head = content.trimStart().slice(0, 200)
    if (/^[[{]/.test(head)) setFrom('json')
    else if (/^<\?xml|^<[A-Za-z_]/i.test(head)) setFrom('xml')
    else if (/^[^:\n]+:\s/m.test(head) && !head.includes(',')) setFrom('yaml')
    else if (/^[A-Za-z0-9_.-]+\s*=\s*/m.test(head)) setFrom('toml')
    else if (head.split('\n')[0]?.includes('\t')) setFrom('tsv')
    else setFrom('csv')
  }, [])

  const swap = useCallback(() => {
    if (output) setInput(output)
    setFrom(to)
    setTo(from)
  }, [output, from, to])

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

  const fromInfo = getFormatInfo(from)
  const toInfo = getFormatInfo(to)

  return (
    <div className="dc-page">
      <div className="dc-card">
        <div className="dc-header">
          <h2 className="dc-title">Data Format Converter</h2>
          <p className="dc-subtitle">
            在 JSON、YAML、TOML、XML、CSV、TSV 之间互转，保留数值与嵌套结构
          </p>
        </div>

        <TextFileBar
          value={input}
          onOpened={(file) => openFile(file.content)}
          onNew={clear}
          suggestedName={`converted.${toInfo.extension}`}
        />

        {/* Quick pairs */}
        <div className="dc-tabs">
          {PAIRS.map((pair) => (
            <button
              key={`${pair.from}-${pair.to}`}
              className={`dc-tab ${from === pair.from && to === pair.to ? 'active' : ''}`}
              onClick={() => {
                setFrom(pair.from)
                setTo(pair.to)
              }}
            >
              {pair.label}
            </button>
          ))}
        </div>

        {/* Format row */}
        <div className="dc-format-row">
          <FormatSelect value={from} onChange={setFrom} label="源格式" />
          <button className="dc-swap-btn" onClick={swap} title="交换源格式与目标格式">
            {output ? <ArrowLeftRight size={15} /> : <ArrowRight size={15} />}
          </button>
          <FormatSelect value={to} onChange={setTo} label="目标格式" exclude={from} />
          <button className="dc-btn-ghost" onClick={loadSample}>
            <FileText size={13} />
            载入示例
          </button>
        </div>

        {from === to && <p className="dc-note">源格式与目标格式相同，输出将与输入一致。</p>}

        {/* Panes */}
        <div className="dc-panes">
          <div className="dc-pane">
            <div className="dc-pane-header">
              <span className="dc-pane-label">{fromInfo.label}</span>
              <span className="dc-pane-meta">{input.length} 字符</span>
            </div>
            <textarea
              className="dc-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={SAMPLES[from]}
              spellCheck={false}
            />
          </div>

          <div className="dc-pane">
            <div className="dc-pane-header">
              <span className="dc-pane-label">{toInfo.label}</span>
              <div className="dc-pane-actions">
                <button className="dc-btn-ghost" onClick={clear}>
                  <RotateCcw size={12} />
                  清空
                </button>
                {output && (
                  <button className="dc-btn-ghost" onClick={copy}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                )}
              </div>
            </div>
            {error ? (
              <div className="dc-error">{error}</div>
            ) : (
              <pre className="dc-output">
                {output || <span className="dc-placeholder">转换结果将显示在这里</span>}
              </pre>
            )}
          </div>
        </div>

        {warnings.length > 0 && (
          <ul className="dc-warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
