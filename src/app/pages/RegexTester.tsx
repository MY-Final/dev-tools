import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/regex-tester.css'

interface MatchResult {
  index: number
  value: string
  groups: (string | undefined)[]
}

const FLAG_OPTIONS = [
  { flag: 'g', label: '全局', hint: '匹配所有出现' },
  { flag: 'i', label: '忽略大小写', hint: '不区分大小写' },
  { flag: 'm', label: '多行', hint: '^ 和 $ 匹配每行首尾' },
  { flag: 's', label: '点全匹配', hint: '. 也匹配换行符' },
  { flag: 'u', label: 'Unicode', hint: '支持 Unicode 属性' }
]

export default function RegexTester(): React.JSX.Element {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [testString, setTestString] = useState('')
  const [replacement, setReplacement] = useState('')
  const [mode, setMode] = useState<'match' | 'replace'>('match')
  const [copied, setCopied] = useState(false)

  const toggleFlag = useCallback((flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, '') : prev + flag))
  }, [])

  const { regex, error } = useMemo(() => {
    if (!pattern) return { regex: null, error: null }
    try {
      return { regex: new RegExp(pattern, flags), error: null }
    } catch (err) {
      return { regex: null, error: (err as Error).message }
    }
  }, [pattern, flags])

  const matches = useMemo((): MatchResult[] | null => {
    if (!regex || !testString) return null
    const results: MatchResult[] = []
    if (flags.includes('g')) {
      let m: RegExpExecArray | null
      while ((m = regex.exec(testString)) !== null) {
        results.push({ index: m.index, value: m[0], groups: m.slice(1) })
        if (m[0].length === 0) {
          regex.lastIndex++
        }
      }
    } else {
      const m = regex.exec(testString)
      if (m) {
        results.push({ index: m.index, value: m[0], groups: m.slice(1) })
      }
    }
    return results
  }, [regex, testString, flags])

  const replacedText = useMemo(() => {
    if (!regex || !testString || mode !== 'replace') return null
    try {
      return testString.replace(regex, replacement)
    } catch {
      return null
    }
  }, [regex, testString, replacement, mode])

  const highlightedText = useMemo(() => {
    if (!testString || !matches || matches.length === 0 || mode !== 'match') return null
    const parts: { text: string; match: boolean; index: number }[] = []
    let lastIndex = 0
    for (const m of matches) {
      if (m.index > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, m.index), match: false, index: lastIndex })
      }
      parts.push({ text: m.value, match: true, index: m.index })
      lastIndex = m.index + m.value.length
    }
    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), match: false, index: lastIndex })
    }
    return parts
  }, [testString, matches, mode])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [])

  const clear = useCallback(() => {
    setPattern('')
    setFlags('g')
    setTestString('')
    setReplacement('')
  }, [])

  const hasGroups = matches && matches.some((m) => m.groups.some((g) => g !== undefined))

  return (
    <div className="rx-page">
      <div className="rx-card">
        <div className="rx-header">
          <h2 className="rx-title">Regex Tester</h2>
          <p className="rx-subtitle">正则表达式实时测试与替换</p>
        </div>

        {/* Pattern */}
        <div className="rx-input-group">
          <label className="rx-label">正则表达式</label>
          <div className="rx-pattern-row">
            <span className="rx-regex-delimiter">/</span>
            <input
              className="rx-pattern-input"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="输入正则..."
              autoFocus
            />
            <span className="rx-regex-delimiter">/</span>
            <span className="rx-flags-display">{flags || ' '}</span>
          </div>

          {/* Flags */}
          <div className="rx-flags">
            {FLAG_OPTIONS.map(({ flag, label, hint }) => (
              <button
                key={flag}
                className={`rx-flag ${flags.includes(flag) ? 'active' : ''}`}
                onClick={() => toggleFlag(flag)}
                title={hint}
              >
                {flag}
                <span className="rx-flag-label">{label}</span>
              </button>
            ))}
          </div>

          {error && <div className="rx-error">{error}</div>}
        </div>

        {/* Test string */}
        <div className="rx-input-group">
          <div className="rx-input-header">
            <label className="rx-label">测试文本</label>
            <div className="rx-mode-switch">
              <button
                className={`rx-mode-btn ${mode === 'match' ? 'active' : ''}`}
                onClick={() => setMode('match')}
              >
                匹配
              </button>
              <button
                className={`rx-mode-btn ${mode === 'replace' ? 'active' : ''}`}
                onClick={() => setMode('replace')}
              >
                替换
              </button>
            </div>
          </div>
          <textarea
            className="rx-textarea"
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="输入要测试的文本..."
            rows={6}
          />
        </div>

        {/* Replacement (replace mode) */}
        {mode === 'replace' && (
          <div className="rx-input-group">
            <label className="rx-label">替换为</label>
            <input
              className="rx-replace-input"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="$1 $2 或替换文本..."
            />
          </div>
        )}

        {/* Actions */}
        <div className="rx-actions">
          <button className="rx-btn rx-btn-ghost" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {/* Results */}
        {mode === 'match' && (
          <>
            {/* Highlighted text */}
            {highlightedText && (
              <div className="rx-result-section">
                <div className="rx-result-header">
                  <span className="rx-result-title">
                    匹配结果 <span className="rx-count">{matches!.length} 个</span>
                  </span>
                  <button
                    className="rx-btn rx-btn-ghost"
                    onClick={() => copyToClipboard(JSON.stringify(matches!.map((m) => m.value), null, 2))}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? '已复制' : '复制匹配'}
                  </button>
                </div>
                <div className="rx-highlight-box">
                  {highlightedText.map((part, i) =>
                    part.match ? (
                      <mark key={i} className="rx-highlight-match">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Match list */}
            {matches && matches.length > 0 && (
              <div className="rx-match-list">
                {matches.map((m, i) => (
                  <div key={i} className="rx-match-item">
                    <span className="rx-match-index">#{i}</span>
                    <code className="rx-match-value">{m.value || '(空)'}</code>
                    {m.groups.length > 0 && hasGroups && (
                      <span className="rx-match-groups">
                        {m.groups.map((g, gi) => (
                          <span key={gi} className="rx-match-group">
                            ${gi + 1}: {g ?? '(未匹配)'}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {regex && testString && matches && matches.length === 0 && (
              <div className="rx-no-match">没有匹配结果</div>
            )}
          </>
        )}

        {/* Replace result */}
        {mode === 'replace' && replacedText !== null && testString && (
          <div className="rx-result-section">
            <div className="rx-result-header">
              <span className="rx-result-title">替换结果</span>
              <button
                className="rx-btn rx-btn-ghost"
                onClick={() => copyToClipboard(replacedText!)}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="rx-highlight-box rx-replace-result">{replacedText}</div>
          </div>
        )}
      </div>
    </div>
  )
}
