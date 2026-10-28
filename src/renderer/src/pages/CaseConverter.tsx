import { useMemo, useRef, useState } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import { CASE_FORMATS, splitWords, type CaseFormat } from '@renderer/lib/case-transform'

type CopyStatus = 'idle' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyStatus, string> = {
  idle: '复制',
  copied: '已复制',
  failed: '复制失败'
}

const COPY_ALL_LABEL: Record<CopyStatus, string> = {
  idle: '复制全部',
  copied: '已复制全部',
  failed: '复制失败'
}

const SAMPLES = ['XMLHttpRequest', 'user_profile_id', '你好 world, Hello World']

/** Copy state for one button. Each row owns its own, so feedback never shows on other rows. */
function useCopy(): [CopyStatus, (text: string) => Promise<void>] {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const timer = useRef(0)

  const copy = async (text: string): Promise<void> => {
    let next: CopyStatus = 'copied'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      next = 'failed'
    }
    setStatus(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('idle'), 1500)
  }

  return [status, copy]
}

interface ResultRowProps {
  format: CaseFormat
  value: string
  unchanged: boolean
  onUse: (value: string) => void
}

function ResultRow({ format, value, unchanged, onUse }: ResultRowProps): React.JSX.Element {
  const [status, copy] = useCopy()

  return (
    <div className={unchanged ? 'cc-row cc-row-same' : 'cc-row'}>
      <div className="cc-row-info">
        <span className="cc-row-label">{format.label}</span>
        <span className="cc-row-desc">{format.description}</span>
      </div>
      {value ? (
        <code className="cc-row-value">{value}</code>
      ) : (
        <span className="cc-row-empty">（空）</span>
      )}
      <div className="cc-row-actions">
        <button type="button" className="cc-btn" onClick={() => void copy(value)}>
          {status === 'copied' ? <Check size={13} /> : <Copy size={13} />}
          {COPY_LABEL[status]}
        </button>
        <button type="button" className="cc-btn" onClick={() => onUse(value)}>
          用作输入
        </button>
      </div>
    </div>
  )
}

export default function CaseConverter(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [allStatus, copyText] = useCopy()

  const hasText = input.trim() !== ''

  const rows = useMemo(
    () => (hasText ? CASE_FORMATS.map((format) => ({ format, value: format.convert(input) })) : []),
    [hasText, input]
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      ({ format, value }) =>
        (!onlyChanged || value !== input) &&
        (q === '' ||
          format.label.toLowerCase().includes(q) ||
          format.description.toLowerCase().includes(q))
    )
  }, [rows, query, onlyChanged, input])

  const charCount = [...input].length
  const wordCount = hasText ? splitWords(input).length : 0
  const lineCount = input === '' ? 0 : input.split('\n').length

  const copyVisible = (): void => {
    const text = visible.map(({ format, value }) => `${format.label}: ${value}`).join('\n')
    void copyText(text)
  }

  return (
    <div className="cc-page">
      <div className="cc-card">
        <div className="cc-header">
          <h2 className="cc-title">Case Converter</h2>
          <p className="cc-subtitle">实时转换文本大小写与命名格式</p>
        </div>

        <TextFileBar
          value={input}
          onOpened={(file) => setInput(file.content)}
          onNew={() => setInput('')}
          suggestedName="case-converted.txt"
        />

        <div className="cc-input-area">
          <div className="cc-input-head">
            <label className="cc-label" htmlFor="cc-input">
              输入文本
            </label>
            <span className="cc-stats">
              字符 {charCount} · 词 {wordCount} · 行 {lineCount}
            </span>
            <button
              type="button"
              className="cc-btn cc-btn-quiet"
              onClick={() => setInput('')}
              disabled={input === ''}
            >
              <RotateCcw size={13} />
              清空
            </button>
          </div>
          <textarea
            id="cc-input"
            className="cc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要转换的文本，例如 XMLHttpRequest 或 user_profile_id"
            rows={3}
            spellCheck={false}
            autoFocus
          />
        </div>

        {hasText ? (
          <>
            <div className="cc-toolbar">
              <input
                type="search"
                className="cc-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="筛选格式名称或说明"
                aria-label="筛选格式"
              />
              <label className="cc-check">
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                只显示有变化的格式
              </label>
              <button
                type="button"
                className="cc-btn cc-btn-primary"
                onClick={copyVisible}
                disabled={visible.length === 0}
              >
                {allStatus === 'copied' ? <Check size={13} /> : <Copy size={13} />}
                {COPY_ALL_LABEL[allStatus]}
              </button>
            </div>

            {visible.length > 0 ? (
              <div className="cc-results">
                {visible.map(({ format, value }) => (
                  <ResultRow
                    key={format.key}
                    format={format}
                    value={value}
                    unchanged={value === input}
                    onUse={setInput}
                  />
                ))}
              </div>
            ) : (
              <p className="cc-no-match">
                没有符合条件的格式，可以清除筛选或关闭“只显示有变化的格式”。
              </p>
            )}
          </>
        ) : (
          <div className="cc-empty">
            <p>在上方输入文本，或选一个示例开始转换。</p>
            <div className="cc-chips">
              {SAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className="cc-chip"
                  onClick={() => setInput(sample)}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
