import { useCallback, useMemo, useState } from 'react'
import { diffArrays, diffWordsWithSpace, type ChangeObject } from 'diff'
import { ArrowLeftRight, Check, Copy, FileText, FolderOpen, RotateCcw } from 'lucide-react'
import '../styles/diff-checker.css'

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  lineNumOld: number | null
  lineNumNew: number | null
  /** 旧侧文本；`added` 行则是新侧文本。 */
  text: string
  /** 仅相同行需要：忽略大小写等选项下两侧原文可能不同。 */
  rightText?: string
}

interface DiffRow {
  kind: 'same' | 'modified' | 'removed' | 'added'
  left: DiffLine | null
  right: DiffLine | null
}

interface DiffResult {
  lines: DiffLine[]
  /** 差异过大、计算超时：按整块删除 + 整块新增展示。 */
  aborted: boolean
}

interface DiffOptions {
  ignoreWhitespace: boolean
  ignoreCase: boolean
}

interface WordPart {
  text: string
  changed: boolean
}

interface WordDiff {
  oldParts: WordPart[]
  newParts: WordPart[]
}

type VisibleEntry =
  | { type: 'row'; row: DiffRow; index: number }
  | { type: 'gap'; key: string; start: number; end: number }

type Side = 'left' | 'right'
type ViewMode = 'split' | 'unified' | 'merge'
type CopyTarget = 'diff' | 'merge'

const CONTEXT_ROWS = 3
const DIFF_TIMEOUT_MS = 600
const WORD_DIFF_MAX_CHARS = 2000
const WORD_DIFF_MAX_ROWS = 400

const VIEW_TABS: Array<{ id: ViewMode; label: string }> = [
  { id: 'split', label: '并排' },
  { id: 'unified', label: '统一' },
  { id: 'merge', label: '合并结果' }
]

const SAMPLE_OLD = `function greet(name) {
  return "Hello, " + name + "!";
}

const users = ["Alice", "Bob", "Charlie"];
users.forEach(u => console.log(greet(u)));`

const SAMPLE_NEW = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const users = ["Alice", "Bob", "Charlie", "Diana"];
users.forEach(user => console.log(greet(user)));
console.log(\`Total: \${users.length} users\`);`

function splitLines(text: string): string[] {
  if (text === '') return []
  return text.replace(/\r\n?/g, '\n').split('\n')
}

function normalizeLine(line: string, options: DiffOptions): string {
  const spaced = options.ignoreWhitespace ? line.replace(/\s+/g, ' ').trim() : line
  return options.ignoreCase ? spaced.toLowerCase() : spaced
}

function blockDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  return [
    ...oldLines.map(
      (text, index): DiffLine => ({
        type: 'removed',
        lineNumOld: index + 1,
        lineNumNew: null,
        text
      })
    ),
    ...newLines.map(
      (text, index): DiffLine => ({
        type: 'added',
        lineNumOld: null,
        lineNumNew: index + 1,
        text
      })
    )
  ]
}

/**
 * 行级 diff。jsdiff 采用 Myers 算法并带有超时保护：超时后退化为
 * 「旧文本整体删除 + 新文本整体新增」，页面不会卡死。
 * 忽略选项只影响比较，展示的始终是原始行内容。
 */
function computeDiff(oldText: string, newText: string, options: DiffOptions): DiffResult {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)
  const oldKeys = oldLines.map((line) => normalizeLine(line, options))
  const newKeys = newLines.map((line) => normalizeLine(line, options))

  let changes: ChangeObject<string[]>[] | undefined
  try {
    changes = diffArrays(oldKeys, newKeys, { timeout: DIFF_TIMEOUT_MS })
  } catch {
    changes = undefined
  }

  if (!changes) return { lines: blockDiff(oldLines, newLines), aborted: true }

  const lines: DiffLine[] = []
  let oldIndex = 0
  let newIndex = 0

  for (const change of changes) {
    const count = change.value.length
    if (change.added) {
      for (let k = 0; k < count; k++) {
        newIndex++
        lines.push({
          type: 'added',
          lineNumOld: null,
          lineNumNew: newIndex,
          text: newLines[newIndex - 1] ?? ''
        })
      }
    } else if (change.removed) {
      for (let k = 0; k < count; k++) {
        oldIndex++
        lines.push({
          type: 'removed',
          lineNumOld: oldIndex,
          lineNumNew: null,
          text: oldLines[oldIndex - 1] ?? ''
        })
      }
    } else {
      for (let k = 0; k < count; k++) {
        oldIndex++
        newIndex++
        lines.push({
          type: 'same',
          lineNumOld: oldIndex,
          lineNumNew: newIndex,
          text: oldLines[oldIndex - 1] ?? '',
          rightText: newLines[newIndex - 1] ?? ''
        })
      }
    }
  }

  return { lines, aborted: false }
}

/** 把一段连续的删除/新增配对成「修改」行，并排视图才能左右对齐。 */
function buildRows(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'same') {
      rows.push({
        kind: 'same',
        left: line,
        right: {
          type: 'same',
          lineNumOld: null,
          lineNumNew: line.lineNumNew,
          text: line.rightText ?? line.text
        }
      })
      i++
      continue
    }

    const removed: DiffLine[] = []
    const added: DiffLine[] = []
    while (i < lines.length && lines[i].type !== 'same') {
      if (lines[i].type === 'removed') removed.push(lines[i])
      else added.push(lines[i])
      i++
    }

    const count = Math.max(removed.length, added.length)
    for (let k = 0; k < count; k++) {
      const left = removed[k] ?? null
      const right = added[k] ?? null
      rows.push({
        kind: left && right ? 'modified' : left ? 'removed' : 'added',
        left,
        right
      })
    }
  }

  return rows
}

function buildVisibleRows(rows: DiffRow[]): VisibleEntry[] {
  if (rows.length === 0) return []

  const visible = new Set<number>()
  rows.forEach((row, index) => {
    if (row.kind === 'same') return
    const start = Math.max(0, index - CONTEXT_ROWS)
    const end = Math.min(rows.length - 1, index + CONTEXT_ROWS)
    for (let i = start; i <= end; i++) visible.add(i)
  })

  if (visible.size === 0) return rows.map((row, index) => ({ type: 'row', row, index }))

  const result: VisibleEntry[] = []
  let previous = -1
  Array.from(visible)
    .sort((a, b) => a - b)
    .forEach((index) => {
      if (index > previous + 1) {
        result.push({
          type: 'gap',
          key: `gap-${previous + 1}-${index}`,
          start: previous + 1,
          end: index
        })
      }
      result.push({ type: 'row', row: rows[index], index })
      previous = index
    })

  if (previous < rows.length - 1) {
    result.push({
      type: 'gap',
      key: `gap-${previous + 1}-${rows.length}`,
      start: previous + 1,
      end: rows.length
    })
  }

  return result
}

/** 词级差异，用于在修改行里标出真正改动的那几个词。 */
function diffLineWords(oldText: string, newText: string): WordDiff | null {
  if (oldText.length + newText.length > WORD_DIFF_MAX_CHARS) return null
  if (oldText === newText) return null

  const changes = diffWordsWithSpace(oldText, newText)
  const oldParts: WordPart[] = []
  const newParts: WordPart[] = []

  for (const change of changes) {
    if (change.added) {
      newParts.push({ text: change.value, changed: true })
    } else if (change.removed) {
      oldParts.push({ text: change.value, changed: true })
    } else {
      oldParts.push({ text: change.value, changed: false })
      newParts.push({ text: change.value, changed: false })
    }
  }

  return { oldParts, newParts }
}

function countLines(value: string): number {
  return value === '' ? 0 : value.split('\n').length
}

function renderWordParts(parts: WordPart[], tone: 'add' | 'del'): React.JSX.Element[] {
  return parts
    .filter((part) => part.text !== '')
    .map((part, index) =>
      part.changed ? (
        <mark key={index} className={`df-word df-word-${tone}`}>
          {part.text}
        </mark>
      ) : (
        <span key={index}>{part.text}</span>
      )
    )
}

export default function DiffChecker(): React.JSX.Element {
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [mergedText, setMergedText] = useState('')
  const [view, setView] = useState<ViewMode>('split')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [expandedGaps, setExpandedGaps] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<CopyTarget | null>(null)
  const [leftName, setLeftName] = useState<string | null>(null)
  const [rightName, setRightName] = useState<string | null>(null)
  const [opening, setOpening] = useState<Side | null>(null)
  const [fileError, setFileError] = useState('')

  const diff = useMemo<DiffResult | null>(() => {
    if (leftText === '' && rightText === '') return null
    return computeDiff(leftText, rightText, { ignoreWhitespace, ignoreCase })
  }, [leftText, rightText, ignoreWhitespace, ignoreCase])

  const stats = useMemo(() => {
    if (!diff) return null
    let added = 0
    let removed = 0
    let same = 0
    for (const line of diff.lines) {
      if (line.type === 'added') added++
      else if (line.type === 'removed') removed++
      else same++
    }
    return { added, removed, same, changed: added + removed }
  }, [diff])

  const rows = useMemo(() => (diff ? buildRows(diff.lines) : []), [diff])
  const visibleRows = useMemo(() => buildVisibleRows(rows), [rows])

  const wordDiffs = useMemo(() => {
    const result = new Map<number, WordDiff | null>()
    // 超时退化后两侧行只是整块配对，词级标色没有意义，也不再耗时计算。
    if (diff?.aborted) return result
    for (const entry of visibleRows) {
      if (entry.type !== 'row' || entry.row.kind !== 'modified') continue
      if (result.size >= WORD_DIFF_MAX_ROWS) break
      const { left, right } = entry.row
      if (!left || !right) continue
      result.set(entry.index, diffLineWords(left.text, right.text))
    }
    return result
  }, [diff?.aborted, visibleRows])

  const changeLeftText = useCallback(
    (value: string) => {
      setLeftText(value)
      setMergedText(rightText)
      setExpandedGaps({})
    },
    [rightText]
  )

  const changeRightText = useCallback((value: string) => {
    setRightText(value)
    setMergedText(value)
    setExpandedGaps({})
  }, [])

  const loadSample = useCallback(() => {
    setLeftText(SAMPLE_OLD)
    setRightText(SAMPLE_NEW)
    setMergedText(SAMPLE_NEW)
    setLeftName(null)
    setRightName(null)
    setExpandedGaps({})
    setFileError('')
  }, [])

  const clear = useCallback(() => {
    setLeftText('')
    setRightText('')
    setMergedText('')
    setLeftName(null)
    setRightName(null)
    setExpandedGaps({})
    setFileError('')
  }, [])

  const swap = useCallback(() => {
    setLeftText(rightText)
    setRightText(leftText)
    setMergedText(leftText)
    setLeftName(rightName)
    setRightName(leftName)
    setExpandedGaps({})
  }, [leftText, rightText, leftName, rightName])

  const openFile = useCallback(
    async (side: Side): Promise<void> => {
      if (opening || !window.file) return
      setOpening(side)
      setFileError('')
      try {
        const opened = await window.file.open('auto')
        if (!opened) return
        const name = opened.truncated ? `${opened.name}（已截断）` : opened.name
        if (side === 'left') {
          setLeftName(name)
          changeLeftText(opened.content)
        } else {
          setRightName(name)
          changeRightText(opened.content)
        }
      } catch (error) {
        setFileError(error instanceof Error ? error.message : '打开文件失败')
      } finally {
        setOpening(null)
      }
    },
    [changeLeftText, changeRightText, opening]
  )

  const toggleGap = useCallback((key: string) => {
    setExpandedGaps((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const toggleOption = useCallback((option: 'whitespace' | 'case') => {
    if (option === 'whitespace') setIgnoreWhitespace((value) => !value)
    else setIgnoreCase((value) => !value)
    setExpandedGaps({})
  }, [])

  const copyDiff = useCallback(async (): Promise<void> => {
    if (!diff) return
    const text = diff.lines
      .map((line) => {
        if (line.type === 'added') return `+ ${line.text}`
        if (line.type === 'removed') return `- ${line.text}`
        return `  ${line.text}`
      })
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied('diff')
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // 剪贴板不可用时保持静默，与其它工具一致
    }
  }, [diff])

  const copyMerged = useCallback(async (): Promise<void> => {
    if (!mergedText) return
    try {
      await navigator.clipboard.writeText(mergedText)
      setCopied('merge')
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }, [mergedText])

  const renderSplitRow = (
    row: DiffRow,
    index: number,
    words: WordDiff | null
  ): React.JSX.Element => (
    <div key={index} className={`df-srow df-srow-${row.kind}`}>
      <span className="df-snum">{row.left?.lineNumOld ?? ''}</span>
      <span className="df-scell df-scell-old">
        {row.left && (words ? renderWordParts(words.oldParts, 'del') : row.left.text)}
      </span>
      <span className="df-snum">{row.right?.lineNumNew ?? ''}</span>
      <span className="df-scell df-scell-new">
        {row.right && (words ? renderWordParts(words.newParts, 'add') : row.right.text)}
      </span>
    </div>
  )

  const renderUnifiedRow = (
    row: DiffRow,
    index: number,
    words: WordDiff | null
  ): React.JSX.Element[] => {
    const nodes: React.JSX.Element[] = []

    if (row.kind === 'same' && row.left) {
      nodes.push(
        <div key={`${index}-same`} className="df-uline df-uline-same">
          <span className="df-line-num">{row.left.lineNumOld ?? ''}</span>
          <span className="df-line-num">{row.left.lineNumNew ?? ''}</span>
          <span className="df-line-sign"> </span>
          <span className="df-line-text">{row.left.text}</span>
        </div>
      )
      return nodes
    }

    if (row.left) {
      nodes.push(
        <div key={`${index}-del`} className="df-uline df-uline-removed">
          <span className="df-line-num">{row.left.lineNumOld ?? ''}</span>
          <span className="df-line-num">{''}</span>
          <span className="df-line-sign">-</span>
          <span className="df-line-text">
            {words ? renderWordParts(words.oldParts, 'del') : row.left.text}
          </span>
        </div>
      )
    }

    if (row.right) {
      nodes.push(
        <div key={`${index}-add`} className="df-uline df-uline-added">
          <span className="df-line-num">{''}</span>
          <span className="df-line-num">{row.right.lineNumNew ?? ''}</span>
          <span className="df-line-sign">+</span>
          <span className="df-line-text">
            {words ? renderWordParts(words.newParts, 'add') : row.right.text}
          </span>
        </div>
      )
    }

    return nodes
  }

  const renderRow = (row: DiffRow, index: number): React.JSX.Element[] => {
    const words = wordDiffs.get(index) ?? null
    if (view === 'unified') return renderUnifiedRow(row, index, words)
    return [renderSplitRow(row, index, words)]
  }

  const renderDiffBody = (): React.JSX.Element[] => {
    const nodes: React.JSX.Element[] = []

    for (const entry of visibleRows) {
      if (entry.type === 'gap') {
        const count = entry.end - entry.start
        const expanded = !!expandedGaps[entry.key]
        nodes.push(
          <button
            key={entry.key}
            type="button"
            className="df-gap"
            aria-expanded={expanded}
            onClick={() => toggleGap(entry.key)}
          >
            {expanded ? `收起 ${count} 行相同内容` : `展开 ${count} 行相同内容`}
          </button>
        )
        if (expanded) {
          for (let i = entry.start; i < entry.end; i++) {
            nodes.push(...renderRow(rows[i], i))
          }
        }
        continue
      }

      nodes.push(...renderRow(entry.row, entry.index))
    }

    return nodes
  }

  const hasInput = leftText !== '' || rightText !== ''
  const identical = stats !== null && stats.changed === 0
  const canCopyDiff = diff !== null && stats !== null && stats.changed > 0

  const renderInput = (side: Side): React.JSX.Element => {
    const isLeft = side === 'left'
    const value = isLeft ? leftText : rightText
    const file = isLeft ? leftName : rightName
    const commit = isLeft ? changeLeftText : changeRightText

    return (
      <div className="df-input-pane">
        <div className="df-input-head">
          <span className={`df-dot ${isLeft ? 'df-dot-old' : 'df-dot-new'}`} aria-hidden="true" />
          <span className="df-input-title">{isLeft ? '原始文本' : '修改后文本'}</span>
          {file && (
            <span className="df-input-file" title={file}>
              {file}
            </span>
          )}
          <span className="df-input-lines">{countLines(value)} 行</span>
          <button
            type="button"
            className="df-open-btn"
            onClick={() => void openFile(side)}
            disabled={opening !== null}
            title={`打开文件作为${isLeft ? '原始' : '修改后'}文本`}
          >
            <FolderOpen size={13} />
            {opening === side ? '读取中…' : '打开'}
          </button>
        </div>
        <textarea
          className="df-textarea"
          aria-label={isLeft ? '原始文本输入' : '修改后文本输入'}
          value={value}
          onChange={(event) => commit(event.target.value)}
          placeholder={isLeft ? '粘贴原始文本，或打开文件…' : '粘贴修改后文本，或打开文件…'}
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <div className="df-page">
      <div className="df-card">
        <header className="df-top">
          <div className="df-title-mark">
            <FileText size={17} />
          </div>
          <div>
            <h2 className="df-title">Diff Checker</h2>
            <p className="df-subtitle">逐行对比两段文本，新增与删除一目了然。</p>
          </div>
        </header>

        <div className="df-toolbar">
          <button type="button" className="df-btn df-btn-ghost" onClick={loadSample}>
            加载示例
          </button>
          <button
            type="button"
            className="df-btn df-btn-ghost"
            onClick={swap}
            disabled={!hasInput}
            title="交换左右两侧文本"
          >
            <ArrowLeftRight size={14} />
            交换左右
          </button>
          <div className="df-toolbar-spacer" />
          <button
            type="button"
            className="df-toggle"
            aria-pressed={ignoreWhitespace}
            onClick={() => toggleOption('whitespace')}
            title="行内空白差异不计入对比"
          >
            忽略空白
          </button>
          <button
            type="button"
            className="df-toggle"
            aria-pressed={ignoreCase}
            onClick={() => toggleOption('case')}
            title="大小写差异不计入对比"
          >
            忽略大小写
          </button>
          <button
            type="button"
            className="df-btn df-btn-ghost"
            onClick={clear}
            disabled={!hasInput}
          >
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {fileError && (
          <div className="df-file-error" role="alert">
            {fileError}
          </div>
        )}

        <section className="df-inputs" aria-label="输入文本">
          {renderInput('left')}
          {renderInput('right')}
        </section>

        <section className="df-result-card" aria-label="对比结果">
          <div className="df-result-header">
            <div className="df-view-tabs" role="tablist" aria-label="结果视图">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={view === tab.id}
                  className="df-view-tab"
                  onClick={() => setView(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {view !== 'merge' && stats && (
              <div className="df-stats">
                <span className="df-stat df-stat-add" title="新增行">
                  +{stats.added}
                </span>
                <span className="df-stat df-stat-rem" title="删除行">
                  -{stats.removed}
                </span>
                <span className="df-stat df-stat-same">{stats.same} 行相同</span>
              </div>
            )}

            {view !== 'merge' && diff?.aborted && (
              <span className="df-warn">差异过大，已简化对比</span>
            )}

            {view === 'merge' ? (
              <button
                type="button"
                className="df-btn df-btn-ghost df-copy"
                onClick={() => void copyMerged()}
                disabled={!mergedText}
              >
                {copied === 'merge' ? <Check size={13} /> : <Copy size={13} />}
                {copied === 'merge' ? '已复制' : '复制结果'}
              </button>
            ) : (
              <button
                type="button"
                className="df-btn df-btn-ghost df-copy"
                onClick={() => void copyDiff()}
                disabled={!canCopyDiff}
              >
                {copied === 'diff' ? <Check size={13} /> : <Copy size={13} />}
                {copied === 'diff' ? '已复制' : '复制 diff'}
              </button>
            )}
          </div>

          {view === 'merge' ? (
            <div className="df-merge">
              <div className="df-merge-bar">
                <button
                  type="button"
                  className="df-btn df-btn-ghost"
                  onClick={() => setMergedText(leftText)}
                  disabled={!leftText}
                >
                  采用原始文本
                </button>
                <button
                  type="button"
                  className="df-btn df-btn-ghost"
                  onClick={() => setMergedText(rightText)}
                  disabled={!rightText}
                >
                  采用修改后文本
                </button>
                <span className="df-merge-hint">以修改后文本为起点，可直接编辑</span>
              </div>
              <textarea
                className="df-merge-textarea"
                aria-label="合并结果"
                value={mergedText}
                onChange={(event) => setMergedText(event.target.value)}
                placeholder="合并结果会显示在这里…"
                spellCheck={false}
              />
            </div>
          ) : !diff || !stats ? (
            <div className="df-empty-result">
              <FileText size={28} strokeWidth={1.5} />
              <strong>等待输入差异</strong>
              <p>在上方粘贴两段文本，或点击「加载示例」看看效果。</p>
            </div>
          ) : identical ? (
            <div className="df-same-state">
              <Check size={26} />
              <strong>两段文本完全一致</strong>
              <span>{stats.same} 行，没有需要合并的差异</span>
            </div>
          ) : (
            <div className="df-diff">
              {view === 'split' ? (
                <div className="df-diff-head df-diff-head-split">
                  <span className="df-snum">行</span>
                  <span className="df-scell">
                    <span className="df-dot df-dot-old" aria-hidden="true" />
                    原始文本
                  </span>
                  <span className="df-snum">行</span>
                  <span className="df-scell">
                    <span className="df-dot df-dot-new" aria-hidden="true" />
                    修改后文本
                  </span>
                </div>
              ) : (
                <div className="df-diff-head df-diff-head-unified">
                  <span className="df-line-num" title="原始行号">
                    旧
                  </span>
                  <span className="df-line-num" title="修改后行号">
                    新
                  </span>
                  <span className="df-line-sign" />
                  <span className="df-line-text">内容</span>
                </div>
              )}
              <div className="df-diff-output">{renderDiffBody()}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
