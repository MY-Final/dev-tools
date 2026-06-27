import { useState, useMemo, useCallback, useRef } from 'react'
import { Table, Copy, Check, Plus, Trash2, Upload } from 'lucide-react'
import '../styles/csv-editor.css'

interface CSVData {
  headers: string[]
  rows: string[][]
}

function parseCSV(text: string): CSVData {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map((line) => parseCSVLine(line))

  return { headers, rows }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}

function toCSV(data: CSVData): string {
  const lines: string[] = []
  lines.push(data.headers.map(escapeCSVCell).join(','))
  for (const row of data.rows) {
    lines.push(row.map(escapeCSVCell).join(','))
  }
  return lines.join('\n')
}

function escapeCSVCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

function toJSON(data: CSVData): string {
  return JSON.stringify(
    data.rows.map((row) => {
      const obj: Record<string, string> = {}
      data.headers.forEach((h, i) => {
        obj[h] = row[i] || ''
      })
      return obj
    }),
    null,
    2
  )
}

export default function CsvEditor(): React.JSX.Element {
  const [input, setInput] = useState('name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF')
  const [copied, setCopied] = useState<'csv' | 'json' | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const data = useMemo(() => parseCSV(input), [input])

  const handleCellClick = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setEditingCell({ row: rowIndex, col: colIndex })
    setEditValue(value)
  }, [])

  const handleCellSave = useCallback(() => {
    if (!editingCell) return
    const lines = input.split(/\r?\n/)
    const parsed = parseCSVLine(lines[editingCell.row + 1])
    parsed[editingCell.col] = editValue
    lines[editingCell.row + 1] = parsed.join(',')
    setInput(lines.join('\n'))
    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, input])

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCellSave()
      } else if (e.key === 'Escape') {
        setEditingCell(null)
      }
    },
    [handleCellSave]
  )

  const handleAddRow = useCallback(() => {
    const emptyRow = data.headers.map(() => '').join(',')
    setInput(input.trimEnd() + '\n' + emptyRow)
  }, [data.headers, input])

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      const lines = input.split(/\r?\n/)
      lines.splice(rowIndex + 1, 1)
      setInput(lines.join('\n'))
    },
    [input]
  )

  const handleCopyCSV = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toCSV(data))
      setCopied('csv')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently fail
    }
  }, [data])

  const handleCopyJSON = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toJSON(data))
      setCopied('json')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently fail
    }
  }, [data])

  const handleImportFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        setInput(text)
      }
    }
    reader.readAsText(file, 'UTF-8')

    // Reset so same file can be re-imported
    e.target.value = ''
  }, [])

  return (
    <div className="csv-page">
      <div className="csv-card">
        <div className="csv-header">
          <Table size={20} />
          <h1 className="csv-title">CSV Editor</h1>
          <p className="csv-subtitle">CSV 表格查看与编辑</p>
        </div>

        {/* Input */}
        <div className="csv-section">
          <div className="csv-section-header">
            <span className="csv-section-label">CSV 原始文本</span>
            <div className="csv-section-actions">
              {fileName && <span className="csv-file-name" title={fileName}>{fileName}</span>}
              <button className="csv-btn" onClick={() => setInput('name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF')}>
                <Copy size={12} />
                重置示例
              </button>
            </div>
          </div>
          <textarea
            className="csv-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 CSV 数据..."
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="csv-actions">
          <button className="csv-btn csv-btn-accent" onClick={handleImportFile}>
            <Upload size={13} />
            导入 CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className="csv-btn csv-btn-primary" onClick={handleCopyCSV}>
            {copied === 'csv' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'csv' ? '已复制 CSV' : '复制 CSV'}
          </button>
          <button className="csv-btn csv-btn-primary" onClick={handleCopyJSON}>
            {copied === 'json' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'json' ? '已复制 JSON' : '复制 JSON'}
          </button>
          <button className="csv-btn" onClick={handleAddRow}>
            <Plus size={13} />
            添加行
          </button>
        </div>

        {/* Table */}
        {data.headers.length > 0 && (
          <div className="csv-table-wrapper">
            <table className="csv-table">
              <thead>
                <tr>
                  <th className="csv-row-num">#</th>
                  {data.headers.map((header, i) => (
                    <th key={i}>{header}</th>
                  ))}
                  <th className="csv-row-action" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className="csv-row-num">{ri + 1}</td>
                    {row.map((cell, ci) => (
                      <td key={ci}>
                        {editingCell?.row === ri && editingCell?.col === ci ? (
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
                            onClick={() => handleCellClick(ri, ci, cell)}
                            title="点击编辑"
                          >
                            {cell || <span className="csv-cell-empty">&mdash;</span>}
                          </span>
                        )}
                      </td>
                    ))}
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.headers.length === 0 && (
          <div className="csv-empty">
            <Upload size={32} className="csv-empty-icon" />
            <p>粘贴 CSV 数据或点击「导入 CSV」选择文件</p>
          </div>
        )}
      </div>
    </div>
  )
}
