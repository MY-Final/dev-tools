import { useState, useMemo, useCallback } from 'react'
import { FileText, Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/markdown-preview.css'

// Simple Markdown parser — supports GFM subset
function parseMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match: string, _lang: string, code: string) => {
    const escaped = code
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    return `<pre><code>${escaped}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Headings
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>')

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

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

  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Tables
  html = html.replace(
    /^\|(.+)\|$/gm,
    (_match: string, content: string) => {
      const cells = content.split('|').map((c: string) => c.trim())
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
    }
  )

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'

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
