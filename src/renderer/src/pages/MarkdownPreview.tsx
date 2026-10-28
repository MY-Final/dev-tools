import { useState, useMemo, useCallback } from 'react'
import { FileText, Copy, Check, RotateCcw, Download } from 'lucide-react'
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

// ── Inline rendering ───────────────────────────────────────────
// Constructs that produce HTML (code, images, links, autolinks) are replaced by
// placeholder tokens first. Emphasis and strikethrough rules then only see plain
// text, so they can never rewrite tag attributes such as href or src. Tokens are
// restored once at the end.

const TOKEN_START = '\uE000'
const TOKEN_END = '\uE001'
const TOKEN_RE = /\uE000(\d+)\uE001/g

interface InlineContext {
  tokens: string[]
}

function holdToken(ctx: InlineContext, html: string): string {
  ctx.tokens.push(html)
  return `${TOKEN_START}${ctx.tokens.length - 1}${TOKEN_END}`
}

// A token can reference earlier tokens (e.g. a code span inside a link label),
// so restoration recurses. Indices always point backwards, so it terminates.
function restoreTokens(ctx: InlineContext, text: string): string {
  return text.replace(TOKEN_RE, (_match, index: string) =>
    restoreTokens(ctx, ctx.tokens[Number(index)] ?? '')
  )
}

// `escaped` must already be HTML-escaped.
function formatInline(ctx: InlineContext, escaped: string): string {
  let text = escaped

  // Code spans: content is already escaped and must not be formatted further.
  text = text.replace(/`([^`]+)`/g, (_match, code: string) =>
    holdToken(ctx, `<code>${code}</code>`)
  )

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, url: string) => {
    const safeUrl = sanitizeUrl(url, false)
    return holdToken(
      ctx,
      safeUrl ? `<img src="${escapeHTML(safeUrl)}" alt="${alt}" loading="lazy">` : alt
    )
  })

  // The label keeps its own inline formatting; the whole anchor becomes one token
  // so emphasis cannot open inside it and close outside it.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const labelHtml = formatInline(ctx, label)
    const safeUrl = sanitizeUrl(url, true)
    return holdToken(
      ctx,
      safeUrl
        ? `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`
        : labelHtml
    )
  })

  // Autolinks: <https://...>. The angle brackets are already escaped here.
  text = text.replace(/&lt;((?:https?|mailto):[^\s]+?)&gt;/g, (_match, target: string) => {
    const safeUrl = sanitizeUrl(target, true)
    return holdToken(
      ctx,
      safeUrl
        ? `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">${target}</a>`
        : target
    )
  })

  // Bare URLs are kept as literal text so underscores or asterisks inside them stay intact.
  text = text.replace(/https?:\/\/[^\s]+/g, (url) => holdToken(ctx, url))

  // Emphasis. Underscore forms require a non-word boundary so snake_case_name is left alone.
  text = text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|[^A-Za-z0-9_])___(.+?)___(?![A-Za-z0-9_])/g, '$1<strong><em>$2</em></strong>')
    .replace(/(^|[^A-Za-z0-9_])__(.+?)__(?![A-Za-z0-9_])/g, '$1<strong>$2</strong>')
    .replace(/(^|[^A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')

  return text
}

function renderInline(source: string): string {
  const ctx: InlineContext = { tokens: [] }
  // Strip the placeholder delimiters from user input so they cannot collide with tokens.
  const escaped = escapeHTML(source.replace(/[\uE000\uE001]/g, ''))
  return restoreTokens(ctx, formatInline(ctx, escaped))
}

// ── Block rendering ────────────────────────────────────────────

const HEADING_RE = /^#{1,6} /
const HR_RE = /^---+$/
const UL_RE = /^[*-] /
const OL_RE = /^\d+\. /
const QUOTE_RE = /^> /
const FENCE_RE = /^```/

function isTableLine(line: string): boolean {
  return /^\|/.test(line) && /\|$/.test(line)
}

// Matches the GFM delimiter row, e.g. |------|:--|--:|
function isTableAlignRow(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+$/.test(line.trim())
}

function isBlockStart(line: string): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    isTableLine(line) ||
    QUOTE_RE.test(line)
  )
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
    if (FENCE_RE.test(line)) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      out.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    // Headings
    if (HEADING_RE.test(line)) {
      const level = line.match(/^(#+)/)![1].length
      const text = line.slice(level + 1)
      out.push(`<h${level}>${renderInline(text)}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule: only a line made of three or more dashes
    if (HR_RE.test(line)) {
      out.push('<hr>')
      i++
      continue
    }

    // Unordered list (consecutive items)
    if (UL_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^[*-] /, '')))
        i++
      }
      out.push('<ul>' + items.map((item) => `<li>${item}</li>`).join('') + '</ul>')
      continue
    }

    // Ordered list (consecutive items)
    if (OL_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^\d+\. /, '')))
        i++
      }
      out.push('<ol>' + items.map((item) => `<li>${item}</li>`).join('') + '</ol>')
      continue
    }

    // Table
    if (isTableLine(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      // The delimiter row is structural, not data. GFM places it second.
      const hasAlignRow = tableLines.length > 1 && isTableAlignRow(tableLines[1])
      const rows = tableLines
        .filter((_, idx) => !(hasAlignRow && idx === 1))
        .map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => renderInline(cell.trim()))
        )
      const [headerRow, ...dataRows] = rows
      out.push(
        '<table><thead><tr>' +
          headerRow.map((h) => `<th>${h}</th>`).join('') +
          '</tr></thead><tbody>' +
          dataRows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
      )
      continue
    }

    // Blockquote
    if (QUOTE_RE.test(line)) {
      const quotes: string[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
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

    // Paragraph: consecutive non-blank lines that do not start another block
    // become one <p>, with line breaks preserved as <br>.
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paragraph.push(renderInline(lines[i]))
      i++
    }
    out.push('<p>' + paragraph.join('<br>') + '</p>')
  }

  return out.join('\n')
}

// ── Standalone HTML export ─────────────────────────────────────
// The exported document must not depend on app CSS variables, so its styles are inlined.

const EXPORT_CSS = `body { max-width: 860px; margin: 40px auto; padding: 0 24px; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; line-height: 1.7; color: #24292f; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 0.6em; }
p, ul, ol, blockquote, pre, table { margin: 0.8em 0; }
code { font-family: Consolas, "JetBrains Mono", monospace; font-size: 0.9em; background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; }
pre { background: #f6f8fa; padding: 14px 16px; border-radius: 6px; overflow: auto; }
pre code { background: none; padding: 0; }
blockquote { margin-left: 0; padding: 0 1em; color: #57606a; border-left: 4px solid #d0d7de; }
table { border-collapse: collapse; }
th, td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }
th { background: #f6f8fa; }
img { max-width: 100%; }
a { color: #0969da; }
hr { border: 0; border-top: 1px solid #d0d7de; margin: 1.5em 0; }`

function buildHtmlDocument(body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Markdown Export</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body>
${body}
</body>
</html>
`
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

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([buildHtmlDocument(htmlOutput)], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'markdown-preview.html'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
              <div className="mp-actions">
                <button className="mp-btn" onClick={handleCopyHtml}>
                  {copied === 'html' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'html' ? '已复制' : '复制 HTML'}
                </button>
                <button className="mp-btn" onClick={handleDownloadHtml}>
                  <Download size={13} />
                  下载 HTML
                </button>
              </div>
            </div>
            <div className="mp-preview" dangerouslySetInnerHTML={{ __html: htmlOutput }} />
          </div>
        </div>
      </div>
    </div>
  )
}
