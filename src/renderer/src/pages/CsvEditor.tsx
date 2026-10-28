import { useState, useMemo, useCallback, useRef } from 'react'
import { Table, Copy, Check, Plus, Trash2, Upload, Download } from 'lucide-react'
import '../styles/csv-editor.css'
import {
  CSV_DELIMITERS,
  csvTableToJson,
  detectCsvDelimiter,
  parseCsvTable,
  stringifyCsv,
  type CsvDelimiter
} from '@renderer/lib/data-format-utils'

const SAMPLE_CSV = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF'

type CsvEncoding = 'utf-8' | 'gbk'
type DelimiterChoice = 'auto' | CsvDelimiter

interface CsvNotice {
  key: string
  tone: 'warn' | 'info'
  text: string
}

const DELIMITER_LABELS: Record<CsvDelimiter, string> = {
  ',': '逗号 ,',
  ';': '分号 ;',
  '\t': 'Tab',
  '|': '竖线 |'
}

function decodeCsvBuffer(
  buffer: ArrayBuffer,
  encoding: CsvEncoding
): { text: string; error: string | null } {
  try {
    return { text: new TextDecoder(encoding).decode(buffer), error: null }
  } catch {
    // 当前运行环境不支持该编码时兜底为 UTF-8
    return {
      text: new TextDecoder('utf-8').decode(buffer),
      error: `当前环境无法使用 ${encoding.toUpperCase()} 解码，已按 UTF-8 读取`
    }
  }
}

function countReplacementChars(text: string): number {
  return text.split('\uFFFD').length - 1
}

export default function CsvEditor(): React.JSX.Element {
  const [input, setInput] = useState(SAMPLE_CSV)
  const [copied, setCopied] = useState<'csv' | 'json' | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [fileName, setFileName] = useState('')
  const [encoding, setEncoding] = useState<CsvEncoding>('utf-8')
  const [encodingError, setEncodingError] = useState<string | null>(null)
  const [importedRaw, setImportedRaw] = useState<ArrayBuffer | null>(null)
  const [importedText, setImportedText] = useState<string | null>(null)
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>('auto')
  const [withBom, setWithBom] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detectedDelimiter = useMemo(() => detectCsvDelimiter(input), [input])
  const delimiter: CsvDelimiter = delimiterChoice === 'auto' ? detectedDelimiter : delimiterChoice
  const data = useMemo(() => parseCsvTable(input, { delimiter }), [input, delimiter])
  const raggedRows = useMemo(() => new Set(data.ragged ?? []), [data.ragged])

  const notices = useMemo(() => {
    const list: CsvNotice[] = []
    if (encodingError) {
      list.push({ key: 'encoding-error', tone: 'warn', text: encodingError })
    }
    if (data.ragged && data.ragged.length > 0) {
      list.push({
        key: 'ragged',
        tone: 'warn',
        text: `${data.ragged.length} 行列数与表头不一致（已保留全部数据）`
      })
    }
    if (data.renamedHeaders && data.renamedHeaders.length > 0) {
      list.push({
        key: 'renamed',
        tone: 'info',
        text: `重复表头已自动重命名：${data.renamedHeaders.map((h) => `${h.from} → ${h.to}`).join('，')}`
      })
    }
    // 仅对仍是导入原文的内容检查替换字符
    if (importedText !== null && input === importedText) {
      const replacements = countReplacementChars(input)
      if (replacements > 0) {
        list.push({
          key: 'replacement',
          tone: 'warn',
          text:
            encoding === 'utf-8'
              ? `内容含 ${replacements} 个替换字符（�），可能不是 UTF-8 编码；如乱码请将导入编码切换为 GBK`
              : `解码后仍含 ${replacements} 个替换字符（�），文件可能不是 GBK 编码`
        })
      }
    }
    return list
  }, [data.ragged, data.renamedHeaders, encoding, encodingError, importedText, input])

  const handleCellClick = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setEditingCell({ row: rowIndex, col: colIndex })
    setEditValue(value)
  }, [])

  const handleCellSave = useCallback(() => {
    if (!editingCell) return
    const rows = data.rows.map((row) => [...row])
    const target = rows[editingCell.row]
    if (!target) return
    // 短行补齐到被编辑的列，其余单元格（包括超出表头的列）原样保留
    while (target.length <= editingCell.col) target.push('')
    target[editingCell.col] = editValue
    setInput(stringifyCsv({ headers: data.headers, rows }, delimiter))
    setEditingCell(null)
    setEditValue('')
  }, [data, delimiter, editingCell, editValue])

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
    if (data.headers.length === 0) return
    const rows = [...data.rows, data.headers.map(() => '')]
    setInput(stringifyCsv({ headers: data.headers, rows }, delimiter))
  }, [data.headers, data.rows, delimiter])

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      const rows = data.rows.filter((_row, index) => index !== rowIndex)
      setInput(stringifyCsv({ headers: data.headers, rows }, delimiter))
    },
    [data.headers, data.rows, delimiter]
  )
  const handleCopyCSV = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(stringifyCsv(data, delimiter))
      setCopied('csv')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently fail
    }
  }, [data, delimiter])

  const handleCopyJSON = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(csvTableToJson(data))
      setCopied('json')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently fail
    }
  }, [data])

  const handleDownloadCsv = useCallback(() => {
    const body = stringifyCsv(data, delimiter)
    const content = withBom ? `\uFEFF${body}` : body
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName || 'data.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [data, delimiter, withBom, fileName])

  const handleImportFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setFileName(file.name)

      const reader = new FileReader()
      reader.onload = (event) => {
        const buffer = event.target?.result
        if (!(buffer instanceof ArrayBuffer)) return
        const { text, error } = decodeCsvBuffer(buffer, encoding)
        setImportedRaw(buffer)
        setImportedText(text)
        setEncodingError(error)
        setInput(text)
      }
      reader.readAsArrayBuffer(file)

      // Reset so same file can be re-imported
      e.target.value = ''
    },
    [encoding]
  )

  const handleEncodingChange = useCallback(
    (next: CsvEncoding) => {
      setEncoding(next)
      // 若输入仍是最近导入的原文，则按新编码重新解码；否则只影响下一次导入
      if (importedRaw && importedText !== null && input === importedText) {
        const { text, error } = decodeCsvBuffer(importedRaw, next)
        setImportedText(text)
        setEncodingError(error)
        setInput(text)
      }
    },
    [importedRaw, importedText, input]
  )

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
              {fileName && (
                <span className="csv-file-name" title={fileName}>
                  {fileName}
                </span>
              )}
              <button className="csv-btn" onClick={() => setInput(SAMPLE_CSV)}>
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
          <label className="csv-field">
            <span className="csv-field-label">导入编码</span>
            <select
              className="csv-select"
              value={encoding}
              onChange={(e) => handleEncodingChange(e.target.value as CsvEncoding)}
            >
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
            </select>
          </label>
          <label className="csv-field">
            <span className="csv-field-label">分隔符</span>
            <select
              className="csv-select"
              value={delimiterChoice}
              onChange={(e) => setDelimiterChoice(e.target.value as DelimiterChoice)}
            >
              <option value="auto">自动识别（{DELIMITER_LABELS[detectedDelimiter]}）</option>
              {CSV_DELIMITERS.map((d) => (
                <option key={d} value={d}>
                  {DELIMITER_LABELS[d]}
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
            UTF-8 BOM（Excel）
          </label>
          <button className="csv-btn" onClick={handleDownloadCsv}>
            <Download size={13} />
            下载 CSV
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

        {/* Table */}
        {data.headers.length > 0 && (
          <div className="csv-table-wrapper">
            <table className="csv-table">
              <thead>
                <tr>
                  <th className="csv-row-num">#</th>
                  {data.headers.map((header, i) => (
                    <th key={i}>{header || <span className="csv-cell-empty">&mdash;</span>}</th>
                  ))}
                  <th className="csv-row-action" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} className={raggedRows.has(ri) ? 'csv-row-ragged' : undefined}>
                    <td className="csv-row-num">{ri + 1}</td>
                    {data.headers.map((_header, ci) => {
                      const cell = row[ci] ?? ''
                      return (
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
