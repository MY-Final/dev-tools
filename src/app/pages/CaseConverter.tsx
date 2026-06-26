import { useState, useMemo, useCallback } from 'react'
import { CaseSensitive, Copy, Check, ArrowLeftRight, RotateCcw } from 'lucide-react'

interface CaseResult {
  label: string
  value: string
  hint: string
}

function toUpper(text: string): string {
  return text.toUpperCase()
}

function toLower(text: string): string {
  return text.toLowerCase()
}

function toTitleCase(text: string): string {
  return text
    .split(/(\s+)/)
    .map((word) => {
      if (/^\s+$/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}

function toSentenceCase(text: string): string {
  return text
    .replace(/(^|[.!?]\s+)([a-z])/g, (_match, sep, char) => sep + char.toUpperCase())
    .replace(/^([a-z])/, (_match, char) => char.toUpperCase())
}

function toCamelCase(text: string): string {
  const words = splitWords(text)
  return words
    .map((w, i) => {
      const lower = w.toLowerCase()
      if (i === 0) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

function toPascalCase(text: string): string {
  const words = splitWords(text)
  return words.map((w) => w.toLowerCase().charAt(0).toUpperCase() + w.toLowerCase().slice(1)).join('')
}

function toSnakeCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('_')
}

function toKebabCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('-')
}

function toConstantCase(text: string): string {
  return splitWords(text).map((w) => w.toUpperCase()).join('_')
}

function toDotCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('.')
}

function toToggleCase(text: string): string {
  return text
    .split('')
    .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
    .join('')
}

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase boundary
    .replace(/[_\-./]+/g, ' ') // separator chars
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function toAlternatingCase(text: string): string {
  let index = 0
  return text
    .split('')
    .map((c) => {
      if (/[a-zA-Z]/.test(c)) {
        const result = index % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
        index++
        return result
      }
      return c
    })
    .join('')
}

function toInverseCase(text: string): string {
  return text
    .split('')
    .map((c) => {
      if (c >= 'A' && c <= 'Z') return c.toLowerCase()
      if (c >= 'a' && c <= 'z') return c.toUpperCase()
      return c
    })
    .join('')
}

const CASE_TRANSFORMS: Array<{
  key: string
  label: string
  hint: string
  fn: (text: string) => string
}> = [
  { key: 'upper', label: 'UPPER CASE', hint: '所有字母转大写', fn: toUpper },
  { key: 'lower', label: 'lower case', hint: '所有字母转小写', fn: toLower },
  { key: 'title', label: 'Title Case', hint: '每个单词首字母大写', fn: toTitleCase },
  { key: 'sentence', label: 'Sentence case', hint: '句子首字母大写', fn: toSentenceCase },
  { key: 'camel', label: 'camelCase', hint: '驼峰命名，首单词小写', fn: toCamelCase },
  { key: 'pascal', label: 'PascalCase', hint: '大驼峰命名', fn: toPascalCase },
  { key: 'snake', label: 'snake_case', hint: '下划线分隔，全小写', fn: toSnakeCase },
  { key: 'kebab', label: 'kebab-case', hint: '短横线分隔，全小写', fn: toKebabCase },
  { key: 'constant', label: 'CONSTANT_CASE', hint: '下划线分隔，全大写', fn: toConstantCase },
  { key: 'dot', label: 'dot.case', hint: '点号分隔，全小写', fn: toDotCase },
  { key: 'alternating', label: 'aLtErNaTiNg', hint: '大小写交替', fn: toAlternatingCase },
  { key: 'inverse', label: 'iNVERSE cASE', hint: '反转每个字母的大小写', fn: toInverseCase },
  { key: 'toggle', label: 'tOGGLE cASE', hint: '反转大小写（同 inverse）', fn: toToggleCase }
]

const SAMPLES = [
  'Hello World from Dev Tools',
  'my-variable_name is great',
  'this is a sample sentence. and here is another.',
  'dev-tools-app-v2'
]

export default function CaseConverter(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const results: CaseResult[] = useMemo(() => {
    if (!input.trim()) return []
    return CASE_TRANSFORMS.map(({ label, hint, fn }) => ({
      label,
      hint,
      value: fn(input)
    }))
  }, [input])

  const clear = useCallback(() => {
    setInput('')
  }, [])

  const loadSample = useCallback((sample: string) => {
    setInput(sample)
  }, [])

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  const copyAll = useCallback(async () => {
    if (!results.length) return
    const all = results.map((r) => `${r.label}: ${r.value}`).join('\n')
    try {
      await navigator.clipboard.writeText(all)
      setCopiedKey('all')
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [results])

  const swapToInput = useCallback(
    (value: string) => {
      setInput(value)
    },
    []
  )

  return (
    <div className="cc-page">
      <div className="cc-card">
        <div className="cc-header">
          <h2 className="cc-title">Case Converter</h2>
          <p className="cc-subtitle">实时转换文本大小写与命名格式</p>
        </div>

        <div className="cc-input-area">
          <div className="cc-input-header">
            <span className="cc-input-label">输入文本</span>
            <div className="cc-samples">
              {SAMPLES.map((s, i) => (
                <button key={i} className="cc-sample-btn" onClick={() => loadSample(s)}>
                  示例 {i + 1}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="cc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要转换的文本..."
            rows={3}
            autoFocus
          />
        </div>

        <div className="cc-actions-bar">
          <button className="cc-btn cc-btn-ghost" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
          {results.length > 0 && (
            <button className="cc-btn cc-btn-primary" onClick={copyAll}>
              {copiedKey === 'all' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'all' ? '已复制全部' : '复制全部'}
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="cc-results">
            {results.map(({ label, value, hint }) => (
              <div key={label} className="cc-result-row">
                <div className="cc-result-info">
                  <span className="cc-result-label">{label}</span>
                  <span className="cc-result-hint">{hint}</span>
                </div>
                <div className="cc-result-value-wrap">
                  <code className="cc-result-value">{value}</code>
                  <div className="cc-result-actions">
                    <button
                      className="cc-icon-btn"
                      title="复制"
                      onClick={() => copyToClipboard(label, value)}
                    >
                      {copiedKey === label ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button
                      className="cc-icon-btn"
                      title="替换为输入"
                      onClick={() => swapToInput(value)}
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {input && (
          <div className="cc-hint-footer">
            <CaseSensitive size={14} />
            <span>输入 {input.length} 字符 · 拆分 {splitWords(input).length} 个单词 · {results.length} 种格式</span>
          </div>
        )}
      </div>
    </div>
  )
}
