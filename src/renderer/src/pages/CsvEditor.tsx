import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Table,
  Copy,
  Check,
  Plus,
  Trash2,
  Download,
  ArrowUpDown,
  Search,
  Columns3,
  FileJson
} from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import {
  parseCsvTable,
  stringifyCsvTable,
  csvTableToRecords,
  stringifyJsonDocument,
  type CsvTableData
} from '@renderer/lib/data-formats'
import '../styles/csv-editor.css'

const SAMPLE_CSV =
  'name,age,city,note\nAlice,30,New York,"Engineer, backend"\nBob,25,Los Angeles,Designer\nCharlie,35,Chicago,"Says ""hi"" often"'

type DelimiterChoice = 'auto' | ',' | ';' | '\t' | '|'

interface CsvNotice {
  key: string
  tone: 'warn' | 'info'
  text: string
}

const DELIMITER_LABELS: Record<string, string> = {
  ',': '逗号 ,',
  ';': '分号 ;',
  '\t': 'Tab',
  '|': '竖线 |'
}

// Beyond this many body rows the table renders a window and warns, because
// every row is a live DOM subtree with per-cell handlers.
const RENDER_WINDOW = 500

/**
 * Counts candidate delimiters outside quotes on the first line. Deliberately
 * cheaper than a full parse so it can run on every keystroke.
 */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>([
    [',', 0],
    [';', 0],
    ['\t', 0],
    ['|', 0]
  ])
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') i++
        else inQuotes = false
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === '\n' || char === '\r') break
    if (counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1)
  }

  let best = ','
  let bestCount = 0
  for (const [candidate, count] of counts) {
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

export default function CsvEditor(): React.JSX.Element {
  const [input, setInput] = useState(SAMPLE_CSV)
  const [copied, setCopied] = useState<'csv' | 'json' | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>('auto')
  const [withBom, setWithBom] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ column: number; direction: 'asc' | 'desc' } | null>(null)
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set())
  const [showAllRows, setShowAllRows] = useState(false)
  const [fileEncoding, setFileEncoding] = useState<'auto' | 'utf-8' | 'gbk'>('auto')
  const tableRef = useRef<HTMLDivElement>(null)

  const detectedDelimiter = useMemo(() => detectDelimiter(input), [input])
  const delimiter = delimiterChoice === 'auto' ? detectedDelimiter : delimiterChoice

  const parsed = useMemo(() => parseCsvTable(input, { delimiter }), [input, delimiter])
  const data = parsed.data as CsvTableData | null

  // Replacing the document wholesale invalidates the column-based view state.
  const loadDocument = useCallback((text: string) => {
    setInput(text)
    setQuery('')
    setSort(null)
    setHiddenColumns(new Set())
    setShowAllRows(false)
    setEditingCell(null)
  }, [])

  const visibleColumns = useMemo(() => {
    if (!data) return []
    return data.headers
      .map((header, index) => ({ header, index }))
      .filter((column) => !hiddenColumns.has(column.index))
  }, [data, hiddenColumns])

  const displayRows = useMemo(() => {
    if (!data) return []
    let rows = data.rows.map((row, index) => ({ row, index }))

    if (query.trim()) {
      const needle = query.trim().toLowerCase()
      rows = rows.filter(({ row }) => row.some((cell) => cell.toLowerCase().includes(needle)))
    }

    if (sort) {
      const { column, direction } = sort
      const factor = direction === 'asc' ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const left = a.row[column] ?? ''
        const right = b.row[column] ?? ''
        const leftNumber = Number(left)
        const rightNumber = Number(right)
        const bothNumeric =
          left.trim() !== '' &&
          right.trim() !== '' &&
          Number.isFinite(leftNumber) &&
          Number.isFinite(rightNumber)
        if (bothNumeric) return (leftNumber - rightNumber) * factor
        return left.localeCompare(right, 'zh-CN', { numeric: true }) * factor
      })
    }

    return rows
  }, [data, query, sort])

  const windowed = !showAllRows && displayRows.length > RENDER_WINDOW
  const renderedRows = windowed ? displayRows.slice(0, RENDER_WINDOW) : displayRows

  const notices = useMemo(() => {
    const list: CsvNotice[] = []
    if (parsed.error) list.push({ key: 'parse', tone: 'warn', text: parsed.error })
    for (const warning of parsed.warnings) {
      list.push({ key: warning, tone: 'warn', text: warning })
    }
    if (data && data.renamedHeaders.length > 0) {
      list.push({
        key: 'renamed',
        tone: 'info',
        text: `空或重复表头已自动重命名：${data.renamedHeaders
          .map((h) => `${h.from || '(空)'} → ${h.to}`)
          .join('，')}`
      })
    }
    if (windowed) {
      list.push({
        key: 'window',
        tone: 'info',
        text: `共 ${displayRows.length} 行，表格仅渲染前 ${RENDER_WINDOW} 行以保证流畅；导出不受影响`
      })
    }
    return list
  }, [parsed, data, displayRows.length, windowed])

  const updateRows = useCallback(
    (rows: string[][]) => {
      if (!data) return
      setInput(stringifyCsvTable({ headers: data.headers, rows }, { delimiter }))
    },
    [data, delimiter]
  )

  const handleCellSave = useCallback(() => {
    if (!editingCell || !data) return
    const rows = data.rows.map((row) => [...row])
    const target = rows[editingCell.row]
    if (!target) return
    while (target.length <= editingCell.col) target.push('')
    target[editingCell.col] = editValue
    updateRows(rows)
    setEditingCell(null)
    setEditValue('')
  }, [data, editingCell, editValue, updateRows])

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCellSave()
      else if (e.key === 'Escape') {
        setEditingCell(null)
        setEditValue('')
      }
    },
    [handleCellSave]
  )

  const handleAddRow = useCallback(() => {
    if (!data) return
    updateRows([...data.rows, data.headers.map(() => '')])
  }, [data, updateRows])

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      if (!data) return
      updateRows(data.rows.filter((_row, index) => index !== rowIndex))
    },
    [data, updateRows]
  )

  const handleAddColumn = useCallback(() => {
    if (!data) return
    const headers = [...data.headers, `column_${data.headers.length + 1}`]
    const rows = data.rows.map((row) => [...row, ''])
    setInput(stringifyCsvTable({ headers, rows }, { delimiter }))
  }, [data, delimiter])

  const handleDeleteColumn = useCallback(
    (column: number) => {
      if (!data) return
      const headers = data.headers.filter((_h, index) => index !== column)
      const rows = data.rows.map((row) => row.filter((_c, index) => index !== column))
      setInput(stringifyCsvTable({ headers, rows }, { delimiter }))
      setHiddenColumns(new Set())
    },
    [data, delimiter]
  )

  const toggleSort = useCallback((column: number) => {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, direction: 'asc' }
      if (prev.direction === 'asc') return { column, direction: 'desc' }
      return null
    })
  }, [])

  const toggleColumn = useCallback((column: number) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }, [])

  const copyText = useCallback(async (kind: 'csv' | 'json', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const handleCopyCSV = useCallback(() => {
    if (!data) return
    void copyText('csv', stringifyCsvTable(data, { delimiter }))
  }, [data, delimiter, copyText])

  const handleCopyJSON = useCallback(() => {
    if (!data) return
    void copyText('json', stringifyJsonDocument(csvTableToRecords(data)))
  }, [data, copyText])

  const handleDownloadCsv = useCallback(() => {
    if (!data) return
    const body = stringifyCsvTable(data, { delimiter })
    const content = withBom ? `\uFEFF${body}` : body
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'data.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [data, delimiter, withBom])

  const cellCount = data ? data.rows.length * data.headers.length : 0

  return (
    <div className="csv-page">
      <div className="csv-card">
        <div className="csv-header">
          <h2 className="csv-title">CSV Editor</h2>
          <p className="csv-subtitle">解析、编辑并转换 CSV / TSV，支持引号、换行与转义</p>
        </div>

        <TextFileBar
          value={input}
          onOpened={(file) => loadDocument(file.content)}
          onNew={() => loadDocument('')}
          suggestedName="data.csv"
        >
          <label className="csv-field">
            <span className="csv-field-label">导入编码</span>
            <select
              className="csv-select"
              value={fileEncoding}
              onChange={(e) => setFileEncoding(e.target.value as typeof fileEncoding)}
            >
              <option value="auto">自动（UTF-8 / GBK）</option>
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
            </select>
          </label>
        </TextFileBar>

        {/* Source text */}
        <div className="csv-section">
          <div className="csv-section-header">
            <span className="csv-section-label">原始文本</span>
            <button className="csv-btn" onClick={() => loadDocument(SAMPLE_CSV)}>
              重置示例
            </button>
          </div>
          <textarea
            className="csv-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 CSV 数据…"
            spellCheck={false}
          />
        </div>

        {/* Toolbar */}
        <div className="csv-actions">
          <button className="csv-btn" onClick={handleAddRow} disabled={!data}>
            <Plus size={13} />
            添加行
          </button>
          <button className="csv-btn" onClick={handleAddColumn} disabled={!data}>
            <Columns3 size={13} />
            添加列
          </button>
          <label className="csv-field">
            <span className="csv-field-label">分隔符</span>
            <select
              className="csv-select"
              value={delimiterChoice}
              onChange={(e) => setDelimiterChoice(e.target.value as DelimiterChoice)}
            >
              <option value="auto">
                自动（{DELIMITER_LABELS[detectedDelimiter] ?? detectedDelimiter}）
              </option>
              {Object.entries(DELIMITER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="csv-check">
            <input
              type="checkbox"
              checked={withBom}
              onChange={(e) => setWithBom(e.target.checked)}
            />
            导出带 BOM
          </label>
          <span className="csv-spacer" />
          <button className="csv-btn" onClick={handleCopyCSV} disabled={!data}>
            {copied === 'csv' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'csv' ? '已复制' : '复制 CSV'}
          </button>
          <button className="csv-btn" onClick={handleCopyJSON} disabled={!data}>
            <FileJson size={13} />
            {copied === 'json' ? '已复制' : '复制 JSON'}
          </button>
          <button className="csv-btn csv-btn-primary" onClick={handleDownloadCsv} disabled={!data}>
            <Download size={13} />
            导出 CSV
          </button>
        </div>

        {notices.length > 0 && (
          <div className="csv-notices" role="status">
            {notices.map((notice) => (
              <div key={notice.key} className={`csv-notice csv-notice-${notice.tone}`}>
                {notice.text}
              </div>
            ))}
          </div>
        )}

        {/* Table controls */}
        {data && data.headers.length > 0 && (
          <>
            <div className="csv-table-controls">
              <label className="csv-search">
                <Search size={13} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="筛选行…"
                />
              </label>
              <span className="csv-table-meta">
                {displayRows.length === data.rows.length
                  ? `${data.rows.length} 行 × ${data.headers.length} 列`
                  : `${displayRows.length} / ${data.rows.length} 行 · ${cellCount} 单元格`}
              </span>
              {(query || sort || hiddenColumns.size > 0) && (
                <button
                  className="csv-btn csv-btn-quiet"
                  onClick={() => {
                    setQuery('')
                    setSort(null)
                    setHiddenColumns(new Set())
                  }}
                >
                  清除筛选
                </button>
              )}
            </div>

            <div className="csv-table-wrapper" ref={tableRef}>
              <table className="csv-table">
                <thead>
                  <tr>
                    <th className="csv-row-num">#</th>
                    {visibleColumns.map(({ header, index }) => (
                      <th key={index}>
                        <div className="csv-th">
                          <button
                            className="csv-th-sort"
                            onClick={() => toggleSort(index)}
                            title="点击排序"
                          >
                            {header || <span className="csv-cell-empty">&mdash;</span>}
                            <ArrowUpDown
                              size={11}
                              className={
                                sort?.column === index
                                  ? `csv-sort-icon csv-sort-${sort.direction}`
                                  : 'csv-sort-icon'
                              }
                            />
                          </button>
                          <button
                            className="csv-th-hide"
                            onClick={() => toggleColumn(index)}
                            title="隐藏此列"
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="csv-row-action" />
                  </tr>
                </thead>
                <tbody>
                  {renderedRows.map(({ row, index: ri }) => {
                    const ragged = data.ragged.includes(ri)
                    return (
                      <tr key={ri} className={ragged ? 'csv-row-ragged' : undefined}>
                        <td className="csv-row-num">{ri + 1}</td>
                        {visibleColumns.map(({ index: ci }) => {
                          const cell = row[ci] ?? ''
                          const editing = editingCell?.row === ri && editingCell?.col === ci
                          return (
                            <td key={ci}>
                              {editing ? (
                                <input
                                  className="csv-cell-input"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellSave}
                                  onKeyDown={handleCellKeyDown}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="csv-cell-text"
                                  onClick={() => {
                                    setEditingCell({ row: ri, col: ci })
                                    setEditValue(cell)
                                  }}
                                  title={cell || '点击编辑'}
                                >
                                  {cell || <span className="csv-cell-empty">&mdash;</span>}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td className="csv-row-action">
                          <button
                            className="csv-btn-icon"
                            onClick={() => handleDeleteRow(ri)}
                            title="删除行"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {windowed && (
              <button className="csv-btn csv-show-more" onClick={() => setShowAllRows(true)}>
                显示全部 {displayRows.length} 行
              </button>
            )}

            {hiddenColumns.size > 0 && (
              <div className="csv-hidden-columns">
                <span>已隐藏列：</span>
                {[...hiddenColumns].map((index) => (
                  <button
                    key={index}
                    className="csv-chip"
                    onClick={() => toggleColumn(index)}
                    title="点击恢复"
                  >
                    {data.headers[index] || `第 ${index + 1} 列`} ×
                  </button>
                ))}
                <button
                  className="csv-btn csv-btn-quiet"
                  onClick={() => setHiddenColumns(new Set())}
                >
                  全部恢复
                </button>
              </div>
            )}

            {hiddenColumns.size === 0 && data.headers.length > 1 && (
              <div className="csv-hidden-columns">
                <span>列操作：</span>
                {data.headers.map((header, index) => (
                  <button
                    key={index}
                    className="csv-chip csv-chip-danger"
                    onClick={() => handleDeleteColumn(index)}
                    title="删除此列"
                  >
                    {header || `第 ${index + 1} 列`} ×
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {(!data || data.headers.length === 0) && (
          <div className="csv-empty">
            <Table size={28} className="csv-empty-icon" />
            <p>粘贴 CSV 数据，或用文件栏打开本地文件</p>
          </div>
        )}
      </div>
    </div>
  )
}
