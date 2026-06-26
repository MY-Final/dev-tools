import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Search } from 'lucide-react'

interface AsciiEntry {
  dec: number
  hex: string
  oct: string
  bin: string
  char: string
  name: string
}

// ASCII control character names (0–31 + 127)
const CONTROL_NAMES: Record<number, string> = {
  0: 'NUL',
  1: 'SOH',
  2: 'STX',
  3: 'ETX',
  4: 'EOT',
  5: 'ENQ',
  6: 'ACK',
  7: 'BEL',
  8: 'BS',
  9: 'HT',
  10: 'LF',
  11: 'VT',
  12: 'FF',
  13: 'CR',
  14: 'SO',
  15: 'SI',
  16: 'DLE',
  17: 'DC1',
  18: 'DC2',
  19: 'DC3',
  20: 'DC4',
  21: 'NAK',
  22: 'SYN',
  23: 'ETB',
  24: 'CAN',
  25: 'EM',
  26: 'SUB',
  27: 'ESC',
  28: 'FS',
  29: 'GS',
  30: 'RS',
  31: 'US',
  127: 'DEL'
}

function buildAsciiTable(): AsciiEntry[] {
  const entries: AsciiEntry[] = []
  for (let i = 0; i <= 127; i++) {
    const char = i >= 32 && i !== 127 ? String.fromCharCode(i) : ''
    const name = CONTROL_NAMES[i] ?? ''
    entries.push({
      dec: i,
      hex: i.toString(16).toUpperCase().padStart(2, '0'),
      oct: i.toString(8).padStart(3, '0'),
      bin: i.toString(2).padStart(8, '0'),
      char,
      name
    })
  }
  return entries
}

const ASCII_TABLE = buildAsciiTable()

type DisplayFormat = 'dec' | 'hex' | 'oct' | 'bin'

export default function AsciiTable(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState<DisplayFormat>('dec')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [hoveredDec, setHoveredDec] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return ASCII_TABLE
    const q = search.toLowerCase()
    return ASCII_TABLE.filter(
      (e) =>
        e.char.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        String(e.dec).includes(q) ||
        e.hex.toLowerCase().includes(q) ||
        e.oct.includes(q) ||
        e.bin.includes(q)
    )
  }, [search])

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    } catch {
      // ignore
    }
  }, [])

  const getDisplayValue = useCallback(
    (entry: AsciiEntry): string => {
      switch (format) {
        case 'hex':
          return `0x${entry.hex}`
        case 'oct':
          return entry.oct
        case 'bin':
          return entry.bin
        default:
          return String(entry.dec)
      }
    },
    [format]
  )

  return (
    <div className="at-page">
      <div className="at-card">
        <div className="at-header">
          <h2 className="at-title">ASCII Table</h2>
          <p className="at-subtitle">ASCII 码表完整对照（0–127）</p>
        </div>

        <div className="at-toolbar">
          <div className="at-search">
            <Search size={14} className="at-search-icon" />
            <input
              className="at-search-input"
              type="text"
              placeholder="$ search char, name, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="at-format-selector">
            {(['dec', 'hex', 'oct', 'bin'] as DisplayFormat[]).map((f) => (
              <button
                key={f}
                className={`at-format-btn ${format === f ? 'active' : ''}`}
                onClick={() => setFormat(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="at-stats">共 128 个字符{search && ` · 匹配 ${filtered.length} 个`}</div>

        {filtered.length === 0 ? (
          <div className="at-empty">没有匹配的字符</div>
        ) : (
          <div className="at-table-wrap">
            <table className="at-table">
              <thead>
                <tr>
                  <th className="at-th">DEC</th>
                  <th className="at-th">HEX</th>
                  <th className="at-th">OCT</th>
                  <th className="at-th">CHAR</th>
                  <th className="at-th">NAME</th>
                  <th className="at-th at-th-action">COPY</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.dec}
                    className={`at-row ${hoveredDec === entry.dec ? 'highlighted' : ''} ${
                      entry.dec < 32 || entry.dec === 127 ? 'control' : ''
                    }`}
                    onMouseEnter={() => setHoveredDec(entry.dec)}
                    onMouseLeave={() => setHoveredDec(null)}
                  >
                    <td className="at-td at-td-mono">{entry.dec}</td>
                    <td className="at-td at-td-mono">0x{entry.hex}</td>
                    <td className="at-td at-td-mono">{entry.oct}</td>
                    <td className="at-td at-td-char">
                      {entry.char || <span className="at-control-glyph">{entry.name}</span>}
                    </td>
                    <td className="at-td at-td-name">{entry.name || '—'}</td>
                    <td className="at-td at-td-action">
                      <button
                        className="at-copy-btn"
                        onClick={() => copyToClipboard(getDisplayValue(entry), String(entry.dec))}
                        title={`复制 ${getDisplayValue(entry)}`}
                      >
                        {copiedKey === String(entry.dec) ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
