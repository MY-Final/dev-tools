import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import {
  Copy,
  Check,
  Trash2,
  FileJson,
  Code,
  TreePine,
  Wand2,
  Download,
  Braces,
  CopyPlus,
  Route,
  Key,
  BracesIcon,
  ArrowUpDown
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { JsonView, collapseAllNested, defaultStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { useJsonFormatter, type Indent } from '@renderer/tools/json-formatter/useJsonFormatter'

const INDENTS: Indent[] = [2, 4, 6, 8]

const customTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--color-text)',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace"
  },
  '.cm-content': {
    caretColor: 'var(--color-accent-soft)',
    padding: '12px 0',
    color: 'var(--color-text)'
  },
  '.cm-line': {
    color: 'var(--color-text)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent-soft)',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--color-accent-soft-subtle) !important'
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--color-surface-hover)'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    fontSize: '11px'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text-secondary)'
  },
  '.cm-foldGutter': {
    color: 'var(--color-text-muted)'
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--color-accent-soft)'
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--color-text)'
  },
  '.cm-panels': {
    backgroundColor: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)'
  },
  '.cm-panel.cm-search': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)'
  },
  '.cm-placeholder': {
    color: 'var(--color-text-muted)'
  }
})

const jsonHighlight = EditorView.baseTheme({
  '.ͼb': { color: '#7C6BC4' },
  '.ͼc': { color: '#2DA44E' },
  '.ͼd': { color: '#BF8700' },
  '.ͼe': { color: '#CF222E' }
})

interface ContextMenuInfo {
  x: number
  y: number
  value: string
  key: string
  path: string
}

function getNodePath(el: HTMLElement): { key: string; path: string } {
  const pathParts: string[] = []
  let current: HTMLElement | null = el

  while (current) {
    const li: HTMLElement | null = current.closest('li')
    if (!li) break

    const keyEl = li.querySelector('[class*="jf-tree-key"]')
    if (keyEl) {
      const keyText = keyEl.textContent?.replace(/"/g, '').replace(/:$/, '') || ''
      if (keyText) {
        pathParts.unshift(keyText)
      }
    }

    current = li.parentElement?.closest('li') || null
  }

  const key = pathParts[pathParts.length - 1] || ''
  const path = pathParts.join('.')
  return { key, path }
}

export default function JsonFormatter(): React.JSX.Element {
  const {
    input,
    setInput,
    output,
    error,
    indent,
    viewMode,
    copied,
    parsedData,
    handleFormat,
    handleMinify,
    handleSortKeys,
    handleCopy,
    handleClear,
    handleLoadSample,
    handleIndentChange,
    handleViewModeChange
  } = useJsonFormatter()

  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuInfo | null>(null)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)

  // Stats
  const stats = useMemo(() => {
    if (!output) return null
    const lines = output.split('\n').length
    const bytes = new Blob([output]).size
    const data = JSON.parse(output)
    const countKeys = (obj: unknown): number => {
      if (Array.isArray(obj)) return obj.reduce((acc, item) => acc + countKeys(item), 0)
      if (obj !== null && typeof obj === 'object') {
        const keys = Object.keys(obj as Record<string, unknown>)
        return keys.length + keys.reduce((acc, k) => acc + countKeys((obj as Record<string, unknown>)[k]), 0)
      }
      return 0
    }
    const keys = countKeys(data)
    const maxDepth = (obj: unknown, depth = 0): number => {
      if (Array.isArray(obj)) return obj.length ? Math.max(...obj.map((item) => maxDepth(item, depth + 1))) : depth
      if (obj !== null && typeof obj === 'object') {
        const vals = Object.values(obj as Record<string, unknown>)
        return vals.length ? Math.max(...vals.map((v) => maxDepth(v, depth + 1))) : depth
      }
      return depth
    }
    const depth = maxDepth(data)
    return { lines, bytes, keys, depth }
  }, [output])

  // Keyboard shortcut
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleFormat()
      }
    },
    [handleFormat]
  )

  const handleEditorChange = useCallback(
    (value: string) => {
      setInput(value)
    },
    [setInput]
  )

  // 同步滚动
  const handleLeftScroll = useCallback(() => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (leftPanelRef.current && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop
      rightPanelRef.current.scrollLeft = leftPanelRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [])

  const handleRightScroll = useCallback(() => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (leftPanelRef.current && rightPanelRef.current) {
      leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop
      leftPanelRef.current.scrollLeft = rightPanelRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [])

  // 绑定滚动事件
  useEffect(() => {
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return

    const leftScroller = left.querySelector('.cm-scroller')
    const rightScroller = right.querySelector('.cm-scroller')

    if (leftScroller) {
      leftScroller.addEventListener('scroll', handleLeftScroll)
    }
    if (rightScroller) {
      rightScroller.addEventListener('scroll', handleRightScroll)
    }

    return () => {
      if (leftScroller) {
        leftScroller.removeEventListener('scroll', handleLeftScroll)
      }
      if (rightScroller) {
        rightScroller.removeEventListener('scroll', handleRightScroll)
      }
    }
  }, [handleLeftScroll, handleRightScroll, viewMode])

  // 树形视图右键菜单
  const handleTreeContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as HTMLElement

    const valueEl = target.closest(
      '[class*="jf-tree-string"], [class*="jf-tree-number"], [class*="jf-tree-boolean"], [class*="jf-tree-null"]'
    ) as HTMLElement | null

    if (valueEl) {
      const value = valueEl.textContent || ''
      const { key, path } = getNodePath(valueEl)
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        value,
        key,
        path
      })
    } else {
      const keyEl = target.closest('[class*="jf-tree-key"]') as HTMLElement | null
      if (keyEl) {
        const keyText = keyEl.textContent?.replace(/"/g, '').replace(/:$/, '') || ''
        const { path } = getNodePath(keyEl)
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          value: keyText,
          key: keyText,
          path
        })
      }
    }
  }, [])

  const handleCopyValue = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.value)
      setCopiedItem('value')
      setTimeout(() => setCopiedItem(null), 1500)
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleCopyKey = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.key)
      setCopiedItem('key')
      setTimeout(() => setCopiedItem(null), 1500)
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleCopyPath = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.path)
      setCopiedItem('path')
      setTimeout(() => setCopiedItem(null), 1500)
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleCopyJsonPath = useCallback(() => {
    if (contextMenu) {
      const jsonPath = '$.' + contextMenu.path
      navigator.clipboard.writeText(jsonPath)
      setCopiedItem('jsonpath')
      setTimeout(() => setCopiedItem(null), 1500)
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (): void => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  return (
    <div className="jf-page" onClick={handleCloseContextMenu} onKeyDown={handleKeyDown}>
      <div className="jf-container">
        {/* 顶部操作区 */}
        <div className="jf-topbar">
          <div className="jf-topbar-left">
            <div className="jf-logo">
              <Braces size={20} />
            </div>
            <h1 className="jf-title">JSON Formatter</h1>
          </div>

          <div className="jf-topbar-center">
            <div className="jf-indent-group">
              <span className="jf-label">缩进</span>
              <div className="jf-indent-tabs">
                {INDENTS.map((i) => (
                  <button
                    key={i}
                    className={`jf-tab ${indent === i ? 'active' : ''}`}
                    onClick={() => handleIndentChange(i)}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="jf-divider" />

            <div className="jf-primary-actions">
              <button className="jf-btn jf-btn-primary" onClick={handleFormat}>
                <Wand2 size={14} />
                <span>格式化</span>
              </button>
              <button className="jf-btn jf-btn-secondary" onClick={handleMinify}>
                <Code size={14} />
                <span>压缩</span>
              </button>
              <button className="jf-btn jf-btn-secondary" onClick={handleSortKeys} title="按键名排序">
                <ArrowUpDown size={14} />
                <span>排序</span>
              </button>
            </div>

            <div className="jf-divider" />

            <div className="jf-view-tabs">
              <button
                className={`jf-tab ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('editor')}
                title="代码视图"
              >
                <Code size={14} />
              </button>
              <button
                className={`jf-tab ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('tree')}
                title="树形视图"
              >
                <TreePine size={14} />
              </button>
            </div>
          </div>

          <div className="jf-topbar-right">
            {error && (
              <div className="jf-error-badge">
                <span className="jf-error-dot" />
                <span>格式错误</span>
              </div>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="jf-error">
            <span className="jf-error-text">
              {error.message}
              {error.line && error.column && (
                <span className="jf-error-pos">
                  &nbsp;at line {error.line}, col {error.column}
                </span>
              )}
            </span>
          </div>
        )}

        {/* 左右编辑区 */}
        <div className="jf-panels">
          {/* 输入面板 */}
          <div className="jf-panel">
            <div className="jf-panel-header">
              <div className="jf-panel-title">
                <FileJson size={14} />
                <span>输入</span>
              </div>
              <div className="jf-panel-actions">
                <button className="jf-icon-btn" onClick={handleLoadSample} title="加载示例">
                  <Download size={14} />
                </button>
                <button
                  className="jf-icon-btn"
                  onClick={handleClear}
                  title="清空"
                  disabled={!input}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="jf-editor-area" ref={leftPanelRef}>
              <CodeMirror
                value={input}
                onChange={handleEditorChange}
                extensions={[json(), customTheme, jsonHighlight]}
                placeholder="粘贴或输入 JSON..."
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: false
                }}
              />
            </div>
          </div>

          {/* 输出面板 */}
          <div className="jf-panel">
            <div className="jf-panel-header">
              <div className="jf-panel-title">
                {viewMode === 'editor' ? <Code size={14} /> : <TreePine size={14} />}
                <span>{viewMode === 'editor' ? '输出' : '树形视图'}</span>
              </div>
              <div className="jf-panel-actions">
                <button
                  className={`jf-icon-btn ${copied ? 'success' : ''}`}
                  onClick={handleCopy}
                  disabled={!output}
                  title="复制全部"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div
              className="jf-editor-area"
              ref={rightPanelRef}
              onContextMenu={viewMode === 'tree' ? handleTreeContextMenu : undefined}
            >
              {viewMode === 'editor' ? (
                <CodeMirror
                  value={output}
                  readOnly
                  extensions={[json(), customTheme, jsonHighlight]}
                  placeholder="格式化结果..."
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: false,
                    bracketMatching: true
                  }}
                />
              ) : (
                <div className="jf-tree-area">
                  {parsedData ? (
                    <JsonView
                      data={parsedData}
                      shouldExpandNode={collapseAllNested}
                      clickToExpandNode={true}
                      style={{
                        ...defaultStyles,
                        container: 'jf-tree',
                        label: 'jf-tree-key',
                        stringValue: 'jf-tree-string',
                        numberValue: 'jf-tree-number',
                        booleanValue: 'jf-tree-boolean',
                        nullValue: 'jf-tree-null',
                        expandIcon: 'jf-tree-expand',
                        collapseIcon: 'jf-tree-collapse',
                        collapsedContent: 'jf-tree-collapsed'
                      }}
                    />
                  ) : (
                    <div className="jf-empty">
                      <Braces size={28} strokeWidth={1.5} />
                      <p>{error ? 'JSON 格式错误' : '等待输入...'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="jf-stats">
            <span className="jf-stat">{stats.lines} 行</span>
            <span className="jf-stat">{stats.bytes.toLocaleString()} B</span>
            <span className="jf-stat">{stats.keys} 键</span>
            <span className="jf-stat">深度 {stats.depth}</span>
            <span className="jf-stat-hint">Ctrl+Enter 格式化</span>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="jf-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="jf-context-header">
            <span className="jf-context-label">{contextMenu.key || '(root)'}</span>
          </div>

          <div className="jf-context-divider" />

          <button className="jf-context-item" onClick={handleCopyValue}>
            <CopyPlus size={14} />
            <span>复制值</span>
            <code className="jf-context-preview">
              {contextMenu.value.length > 25
                ? contextMenu.value.slice(0, 25) + '...'
                : contextMenu.value}
            </code>
          </button>

          {contextMenu.key && (
            <button className="jf-context-item" onClick={handleCopyKey}>
              <Key size={14} />
              <span>复制键名</span>
              <code className="jf-context-preview">{contextMenu.key}</code>
            </button>
          )}

          {contextMenu.path && (
            <>
              <button className="jf-context-item" onClick={handleCopyPath}>
                <Route size={14} />
                <span>复制路径</span>
                <code className="jf-context-preview">{contextMenu.path}</code>
              </button>

              <button className="jf-context-item" onClick={handleCopyJsonPath}>
                <BracesIcon size={14} />
                <span>复制 JSONPath</span>
                <code className="jf-context-preview">$.{contextMenu.path}</code>
              </button>
            </>
          )}
        </div>
      )}

      {/* Toast */}
      {copiedItem && (
        <div className="jf-toast">
          <Check size={14} />
          <span>
            {copiedItem === 'value' && '已复制值'}
            {copiedItem === 'key' && '已复制键名'}
            {copiedItem === 'path' && '已复制路径'}
            {copiedItem === 'jsonpath' && '已复制 JSONPath'}
          </span>
        </div>
      )}
    </div>
  )
}
