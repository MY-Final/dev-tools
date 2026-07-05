import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Copy, Check, RotateCcw, ArrowLeftRight, Minus, Plus, ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import '../styles/diff-checker.css'

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  lineNumOld: number | null
  lineNumNew: number | null
  text: string
}

type MergeSource = 'left' | 'right'
type VisibleDiffLine = { type: 'line'; line: DiffLine; index: number } | { type: 'gap'; key: string; count: number }

interface MergeToast {
  id: number
  message: string
}

// ── Simple LCS-based line diff ─────────────────────────────────

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  // LCS table
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack
  const result: DiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'same',
        lineNumOld: i,
        lineNumNew: j,
        text: oldLines[i - 1]
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        lineNumOld: null,
        lineNumNew: j,
        text: newLines[j - 1]
      })
      j--
    } else {
      result.unshift({
        type: 'removed',
        lineNumOld: i,
        lineNumNew: null,
        text: oldLines[i - 1]
      })
      i--
    }
  }

  return result
}

// ── Component ──────────────────────────────────────────────────

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

export default function DiffChecker(): React.JSX.Element {
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [mergedText, setMergedText] = useState('')
  const [mergeChoices, setMergeChoices] = useState<Record<number, MergeSource>>({})
  const [copied, setCopied] = useState(false)
  const [copiedMerged, setCopiedMerged] = useState(false)
  const [mergeTip, setMergeTip] = useState<MergeToast | null>(null)
  const mergeTipTimer = useRef<number | null>(null)
  const leftEditorRef = useRef<HTMLTextAreaElement>(null)
  const mergedEditorRef = useRef<HTMLTextAreaElement>(null)
  const rightEditorRef = useRef<HTMLTextAreaElement>(null)
  const isSyncingScroll = useRef(false)

  const diffLines = useMemo(() => {
    if (!leftText && !rightText) return null
    return computeDiff(leftText, rightText)
  }, [leftText, rightText])

  const loadSample = useCallback(() => {
    setLeftText(SAMPLE_OLD)
    setRightText(SAMPLE_NEW)
    setMergedText(SAMPLE_NEW)
    setMergeChoices({})
  }, [])

  const clear = useCallback(() => {
    setLeftText('')
    setRightText('')
    setMergedText('')
    setMergeChoices({})
  }, [])

  useEffect(() => {
    setMergedText(rightText)
    setMergeChoices({})
  }, [leftText, rightText])

  useEffect(() => {
    return () => {
      if (mergeTipTimer.current !== null) {
        window.clearTimeout(mergeTipTimer.current)
      }
    }
  }, [])

  const copyUnified = useCallback(async () => {
    if (!diffLines) return
    const out = diffLines
      .map((l) => {
        if (l.type === 'added') return `+ ${l.text}`
        if (l.type === 'removed') return `- ${l.text}`
        return `  ${l.text}`
      })
      .join('\n')
    try {
      await navigator.clipboard.writeText(out)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [diffLines])

  const swap = useCallback(() => {
    setLeftText(rightText)
    setRightText(leftText)
    setMergedText(leftText)
    setMergeChoices({})
  }, [leftText, rightText])

  const showMergeTip = useCallback((message: string) => {
    if (mergeTipTimer.current !== null) {
      window.clearTimeout(mergeTipTimer.current)
    }
    setMergeTip({ id: Date.now(), message })
    mergeTipTimer.current = window.setTimeout(() => setMergeTip(null), 1800)
  }, [])

  const buildMergedText = useCallback((choices: Record<number, MergeSource>): string => {
    if (!diffLines) return ''

    return diffLines
      .flatMap((line, index) => {
        const source = choices[index] ?? 'right'
        if (line.type === 'same') return [line.text]
        if (line.type === 'removed') return source === 'left' ? [line.text] : []
        return source === 'right' ? [line.text] : []
      })
      .join('\n')
  }, [diffLines])

  const applyLineMerge = useCallback((lineIndex: number, source: MergeSource) => {
    if (!diffLines) return
    const nextChoices = { ...mergeChoices, [lineIndex]: source }
    setMergeChoices(nextChoices)
    setMergedText(buildMergedText(nextChoices))
    showMergeTip(source === 'left' ? '已将左侧这一行应用到合并结果' : '已将右侧这一行应用到合并结果')
  }, [buildMergedText, diffLines, mergeChoices, showMergeTip])

  const applyAllMerge = useCallback((source: MergeSource) => {
    setMergedText(source === 'left' ? leftText : rightText)
    setMergeChoices({})
    showMergeTip(source === 'left' ? '合并结果已完全采用左侧' : '合并结果已完全采用右侧')
  }, [leftText, rightText, showMergeTip])

  const copyMerged = useCallback(async () => {
    if (!mergedText) return
    await navigator.clipboard.writeText(mergedText)
    setCopiedMerged(true)
    setTimeout(() => setCopiedMerged(false), 1500)
  }, [mergedText])

  const stats = useMemo(() => {
    if (!diffLines) return null
    const added = diffLines.filter((l) => l.type === 'added').length
    const removed = diffLines.filter((l) => l.type === 'removed').length
    const same = diffLines.filter((l) => l.type === 'same').length
    return { added, removed, same, changed: added + removed }
  }, [diffLines])

  const visibleDiffLines = useMemo<VisibleDiffLine[]>(() => {
    if (!diffLines) return []
    const context = 3
    const visible = new Set<number>()
    diffLines.forEach((line, index) => {
      if (line.type === 'same') return
      const start = Math.max(0, index - context)
      const end = Math.min(diffLines.length - 1, index + context)
      for (let i = start; i <= end; i += 1) visible.add(i)
    })

    if (!visible.size) return diffLines.map((line, index) => ({ type: 'line', line, index }))

    const result: VisibleDiffLine[] = []
    let previous = -1
    Array.from(visible)
      .sort((a, b) => a - b)
      .forEach((index) => {
        if (previous !== -1 && index - previous > 1) {
          result.push({ type: 'gap', key: `${previous}-${index}`, count: index - previous - 1 })
        }
        result.push({ type: 'line', line: diffLines[index], index })
        previous = index
      })
    return result
  }, [diffLines])

  const syncEditorScroll = useCallback((source: HTMLTextAreaElement) => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true

    const scrollableHeight = source.scrollHeight - source.clientHeight
    const scrollableWidth = source.scrollWidth - source.clientWidth
    const topRatio = scrollableHeight > 0 ? source.scrollTop / scrollableHeight : 0
    const leftRatio = scrollableWidth > 0 ? source.scrollLeft / scrollableWidth : 0

    ;[leftEditorRef.current, mergedEditorRef.current, rightEditorRef.current].forEach((target) => {
      if (!target || target === source) return
      const targetScrollableHeight = target.scrollHeight - target.clientHeight
      const targetScrollableWidth = target.scrollWidth - target.clientWidth
      target.scrollTop = targetScrollableHeight * topRatio
      target.scrollLeft = targetScrollableWidth * leftRatio
    })

    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [])

  return (
    <div className="df-page">
      <div className="df-card">
        <div className="df-header">
          <div className="df-title-mark">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="df-title">Diff Checker</h2>
            <p className="df-subtitle">逐行对比文本差异，快速合并代码片段、配置文件和文档改动。</p>
          </div>
          <div className="df-header-meta">
            <span>{leftText.split('\n').filter(Boolean).length} left lines</span>
            <span>{rightText.split('\n').filter(Boolean).length} right lines</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="df-toolbar">
          <button className="df-btn df-btn-primary" onClick={loadSample}>
            加载示例
          </button>
          <div className="df-toolbar-spacer" />
          <button className="df-btn df-btn-ghost" onClick={swap} title="交换左右">
            <ArrowLeftRight size={14} />
            交换
          </button>
          <button className="df-btn df-btn-ghost" onClick={() => applyAllMerge('left')} disabled={!leftText && !rightText} title="合并结果完全采用左侧">
            <ArrowRight size={14} />
            左 → 中
          </button>
          <button className="df-btn df-btn-ghost" onClick={() => applyAllMerge('right')} disabled={!leftText && !rightText} title="合并结果完全采用右侧">
            <ArrowLeft size={14} />
            中 ← 右
          </button>
          <button className="df-btn df-btn-ghost" onClick={copyMerged} disabled={!mergedText}>
            {copiedMerged ? <Check size={14} /> : <Copy size={14} />}
            {copiedMerged ? '已复制结果' : '复制结果'}
          </button>
          <button className="df-btn df-btn-ghost" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
          {mergeTip && <div key={mergeTip.id} className="df-merge-tip">{mergeTip.message}</div>}
        </div>

        {/* Editors */}
        <div className="df-editors-wrap">
          <div className="df-editors-head">
            <span>输入区</span>
            <em>左右为来源版本，中间为可编辑合并结果</em>
          </div>
          <div className="df-editors">
          <div className="df-editor-pane">
            <div className="df-editor-label">
              <Minus size={12} />
              原始文本
            </div>
            <textarea
              ref={leftEditorRef}
              className="df-textarea"
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              onScroll={(e) => syncEditorScroll(e.currentTarget)}
              placeholder="粘贴原始文本..."
              spellCheck={false}
            />
          </div>

          <div className="df-editor-pane df-editor-pane-merged">
            <div className="df-editor-label">
              <ArrowLeftRight size={12} />
              合并结果
            </div>
            <textarea
              ref={mergedEditorRef}
              className="df-textarea"
              value={mergedText}
              onChange={(e) => setMergedText(e.target.value)}
              onScroll={(e) => syncEditorScroll(e.currentTarget)}
              placeholder="从左右差异选择内容，或直接编辑合并结果..."
              spellCheck={false}
            />
          </div>

          <div className="df-editor-pane">
            <div className="df-editor-label">
              <Plus size={12} />
              修改后文本
            </div>
            <textarea
              ref={rightEditorRef}
              className="df-textarea"
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              onScroll={(e) => syncEditorScroll(e.currentTarget)}
              placeholder="粘贴修改后文本..."
              spellCheck={false}
            />
          </div>
          </div>
        </div>

        {/* Diff result */}
        <section className="df-result-card">
          {diffLines && stats ? (
            <>
            <div className="df-result-header">
              <div className="df-stats">
                <span className="df-stat df-stat-add">+{stats.added}</span>
                <span className="df-stat df-stat-rem">-{stats.removed}</span>
                <span className="df-stat df-stat-change">{stats.changed} 行差异</span>
                <span className="df-stat df-stat-same">{stats.same} 行相同</span>
              </div>
              <button className="df-btn df-btn-ghost" onClick={copyUnified}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制 diff'}
              </button>
            </div>

            <div className="df-diff-output">
              {visibleDiffLines.map((entry) => entry.type === 'gap' ? (
                <div key={entry.key} className="df-diff-gap">隐藏 {entry.count} 行相同内容</div>
              ) : (
                <div key={entry.index} className={`df-diff-line df-diff-${entry.line.type}`}>
                  <span className="df-line-num df-line-num-old">
                    {entry.line.lineNumOld ?? ''}
                  </span>
                  <span className="df-line-num df-line-num-new">
                    {entry.line.lineNumNew ?? ''}
                  </span>
                  <span className="df-line-sign">
                    {entry.line.type === 'added' ? '+' : entry.line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="df-line-text">{entry.line.text}</span>
                  {entry.line.type !== 'same' && (
                    <span className="df-line-actions">
                      <button className={`df-line-merge ${mergeChoices[entry.index] === 'left' ? 'active' : ''}`} onClick={() => applyLineMerge(entry.index, 'left')} title="把左侧这行应用到合并结果">
                        <ArrowRight size={12} />
                      </button>
                      <button className={`df-line-merge ${mergeChoices[entry.index] === 'right' ? 'active' : ''}`} onClick={() => applyLineMerge(entry.index, 'right')} title="把右侧这行应用到合并结果">
                        <ArrowLeft size={12} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
          ) : (
            <div className="df-empty-result">
              <FileText size={32} strokeWidth={1.5} />
              <strong>等待输入差异</strong>
              <p>粘贴两段文本，或点击“加载示例”查看完整 diff 与合并操作。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
