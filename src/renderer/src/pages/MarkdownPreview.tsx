import { useState, useMemo, useCallback } from 'react'
import { FileText, Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/markdown-preview.css'

// Simple Markdown parser — supports GFM subset
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
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`)
      continue
    }

    // Headings
    if (/^#{1,6} /.test(line)) {
      const level = line.match(/^(#+)/)![1].length
      const text = line.slice(level + 1)
      out.push(`<h${level}>${text}</h${level}>`)
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
    if (/^[\*\-] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\*\-] /.test(lines[i])) {
        items.push(lines[i].replace(/^[\*\-] /, ''))
        i++
      }
      out.push('<ul>' + items.map((item) => `<li>${item}</li>`).join('') + '</ul>')
      continue
    }

    // Ordered list (consecutive items)
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
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
          .map((c) => c.trim())
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
    if (/^&gt; /.test(line)) {
      const quotes: string[] = []
      while (i < lines.length && /^&gt; /.test(lines[i])) {
        quotes.push(lines[i].replace(/^&gt; /, ''))
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
    out.push('<p>' + line + '</p>')
  }

  let html = out
    .join('\n')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // But revert inside <pre><code>
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_m: string, code: string) => {
      return '<pre><code>' + code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        + '</code></pre>'
    })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  return html
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
