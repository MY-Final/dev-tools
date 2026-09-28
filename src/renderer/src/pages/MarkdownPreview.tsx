import { useState, useMemo, useCallback } from 'react'
import { FileText, Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/markdown-preview.css'

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&colon;/gi, ':')
    .replace(/&#58;/gi, ':')
    .replace(/&#x3a;/gi, ':')
}

function sanitizeUrl(rawUrl: string, allowMailto: boolean): string | null {
  let candidate = rawUrl.trim()
  for (let pass = 0; pass < 3; pass++) {
    const decoded = decodeHtmlEntities(candidate)
    if (decoded === candidate) break
    candidate = decoded
  }

  // Control characters and whitespace can be used to disguise dangerous schemes.
  candidate = Array.from(candidate)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 0x1f && code !== 0x7f && !/\s/.test(character)
    })
    .join('')
  if (!candidate) return null

  if (/^(?:\/|\.\/|\.\.\/|#|\?)/.test(candidate)) return candidate

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href
    if (allowMailto && parsed.protocol === 'mailto:') return parsed.href
  } catch {
    return null
  }

  return null
}

function renderInline(source: string): string {
  const codeTokens: string[] = []
  let html = escapeHTML(source).replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `\uE000CODE${codeTokens.length}\uE001`
    codeTokens.push(`<code>${code}</code>`)
    return token
  })

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, url: string) => {
    const safeUrl = sanitizeUrl(url, false)
    return safeUrl ? `<img src="${escapeHTML(safeUrl)}" alt="${alt}" loading="lazy">` : alt
  })

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const safeUrl = sanitizeUrl(url, true)
    return safeUrl
      ? `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label
  })

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  return html.replace(/\uE000CODE(\d+)\uE001/g, (_match, index: string) => {
    return codeTokens[Number(index)] ?? ''
  })
}

// Raw HTML is escaped before parsing. This renderer only emits a fixed set of
// safe tags, so preview output is trusted even though it is injected as HTML.
function parseMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks (fenced)
    if (/^```/.test(line)) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      out.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    // Headings
    if (/^#{1,6} /.test(line)) {
      const level = line.match(/^(#+)/)![1].length
      const text = line.slice(level + 1)
      out.push(`<h${level}>${renderInline(text)}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (/^---$/.test(line)) {
      out.push('<hr>')
      i++
      continue
    }

    // Unordered list (consecutive items)
    if (/^[*-] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^[*-] /, '')))
        i++
      }
      out.push('<ul>' + items.map((item) => `<li>${item}</li>`).join('') + '</ul>')
      continue
    }

    // Ordered list (consecutive items)
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^\d+\. /, '')))
        i++
      }
      out.push('<ol>' + items.map((item) => `<li>${item}</li>`).join('') + '</ol>')
      continue
    }

    // Table
    if (/^\|/.test(line) && /\|$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\|/.test(lines[i]) && /\|$/.test(lines[i])) {
        const cells = lines[i]
          .split('|')
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1) // skip first/last empty
          .map((c) => renderInline(c.trim()))
        rows.push(cells)
        i++
      }
      if (rows.length > 0) {
        // Skip separator row (|---|)
        const headerRow = rows[0]
        const dataRows = rows.slice(1).filter((r) => !r[0]?.includes('---'))
        out.push(
          '<table><thead><tr>' +
            headerRow.map((h) => `<th>${h}</th>`).join('') +
            '</tr></thead><tbody>' +
            dataRows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') +
            '</tbody></table>'
        )
      }
      continue
    }

    // Blockquote
    if (/^> /.test(line)) {
      const quotes: string[] = []
      while (i < lines.length && /^> /.test(lines[i])) {
        quotes.push(renderInline(lines[i].replace(/^> /, '')))
        i++
      }
      out.push('<blockquote>' + quotes.join('<br>') + '</blockquote>')
      continue
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      i++
      continue
    }

    // Regular paragraph line
    i++
    out.push('<p>' + renderInline(line) + '</p>')
  }

  return out.join('\n')
}

export default function MarkdownPreview(): React.JSX.Element {
  const [input, setInput] = useState(`# Hello Markdown

## 实时渲染预览

这是一个 **Markdown** 编辑器，支持 *GFM* 语法：

### 列表

- 无序列表项 1
- 无序列表项 2
- 无序列表项 3

### 代码块

\`\`\`javascript
function hello() {
  console.log('Hello, World!')
}
\`\`\`

### 表格

| 名称 | 说明 |
|------|------|
| 功能 | 实时预览 |
| 支持 | GFM 语法 |

### 链接和图片

[GitHub](https://github.com)

> 引用文本
`)
  const [copied, setCopied] = useState<'markdown' | 'html' | null>(null)

  const htmlOutput = useMemo(() => parseMarkdown(input), [input])

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(input)
      setCopied('markdown')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently fail
    }
  }, [input])

  const handleCopyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(htmlOutput)
      setCopied('html')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently fail
    }
  }, [htmlOutput])

  return (
    <div className="mp-page">
      <div className="mp-card">
        <div className="mp-header">
          <FileText size={20} />
          <h1 className="mp-title">Markdown Preview</h1>
          <p className="mp-subtitle">实时 Markdown 渲染预览</p>
        </div>

        <div className="mp-layout">
          {/* Input */}
          <div className="mp-pane">
            <div className="mp-pane-header">
              <span className="mp-pane-label">Markdown</span>
              <div className="mp-actions">
                <button className="mp-btn" onClick={handleCopyMarkdown}>
                  {copied === 'markdown' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'markdown' ? '已复制' : '复制'}
                </button>
                <button className="mp-btn" onClick={() => setInput('')}>
                  <RotateCcw size={13} />
                  清空
                </button>
              </div>
            </div>
            <textarea
              className="mp-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="在此输入 Markdown..."
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          <div className="mp-pane">
            <div className="mp-pane-header">
              <span className="mp-pane-label">Preview</span>
              <button className="mp-btn" onClick={handleCopyHtml}>
                {copied === 'html' ? <Check size={13} /> : <Copy size={13} />}
                {copied === 'html' ? '已复制' : '复制 HTML'}
              </button>
            </div>
            <div
              className="mp-preview"
              dangerouslySetInnerHTML={{ __html: htmlOutput }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
