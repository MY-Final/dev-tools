import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, ArrowLeftRight, Minus, Plus } from 'lucide-react'
import '../styles/diff-checker.css'

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  lineNumOld: number | null
  lineNumNew: number | null
  text: string
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
  const [copied, setCopied] = useState(false)

  const diffLines = useMemo(() => {
    if (!leftText && !rightText) return null
    return computeDiff(leftText, rightText)
  }, [leftText, rightText])

  const loadSample = useCallback(() => {
    setLeftText(SAMPLE_OLD)
    setRightText(SAMPLE_NEW)
  }, [])

  const clear = useCallback(() => {
    setLeftText('')
    setRightText('')
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
  }, [leftText, rightText])

  const stats = useMemo(() => {
    if (!diffLines) return null
    const added = diffLines.filter((l) => l.type === 'added').length
    const removed = diffLines.filter((l) => l.type === 'removed').length
    const same = diffLines.filter((l) => l.type === 'same').length
    return { added, removed, same }
  }, [diffLines])

  return (
    <div className="df-page">
      <div className="df-card">
        <div className="df-header">
          <h2 className="df-title">Diff Checker</h2>
          <p className="df-subtitle">逐行对比文本差异</p>
        </div>

        {/* Toolbar */}
        <div className="df-toolbar">
          <button className="df-btn df-btn-ghost" onClick={loadSample}>
            加载示例
          </button>
          <div className="df-toolbar-spacer" />
          <button className="df-btn df-btn-ghost" onClick={swap} title="交换左右">
            <ArrowLeftRight size={14} />
            交换
          </button>
          <button className="df-btn df-btn-ghost" onClick={clear}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {/* Editors */}
        <div className="df-editors">
          <div className="df-editor-pane">
            <div className="df-editor-label">
              <Minus size={12} />
              原始文本
            </div>
            <textarea
              className="df-textarea"
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              placeholder="粘贴原始文本..."
              spellCheck={false}
            />
          </div>

          <div className="df-editor-pane">
            <div className="df-editor-label">
              <Plus size={12} />
              修改后文本
            </div>
            <textarea
              className="df-textarea"
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder="粘贴修改后文本..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Diff result */}
        {diffLines && stats && (
          <>
            <div className="df-result-header">
              <div className="df-stats">
                <span className="df-stat df-stat-add">+{stats.added}</span>
                <span className="df-stat df-stat-rem">-{stats.removed}</span>
                <span className="df-stat df-stat-same">{stats.same} 行相同</span>
              </div>
              <button className="df-btn df-btn-ghost" onClick={copyUnified}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? '已复制' : '复制 diff'}
              </button>
            </div>

            <div className="df-diff-output">
              {diffLines.map((line, i) => (
                <div
                  key={i}
                  className={`df-diff-line df-diff-${line.type}`}
                >
                  <span className="df-line-num df-line-num-old">
                    {line.lineNumOld ?? ''}
                  </span>
                  <span className="df-line-num df-line-num-new">
                    {line.lineNumNew ?? ''}
                  </span>
                  <span className="df-line-sign">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="df-line-text">{line.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
