import { useState, useMemo, useCallback } from 'react'
import { Code, Copy, Check, RotateCcw, Indent, Shrink } from 'lucide-react'
import '../styles/xml-formatter.css'

function formatXML(xml: string, indent: number): string {
  const trimmed = xml.trim()
  if (!trimmed) return ''

  // Basic validation
  if (!trimmed.startsWith('<')) {
    throw new Error('无效的 XML：必须以 < 开头')
  }

  let depth = 0
  const indentStr = ' '.repeat(indent)
  let i = 0

  // Tokenize and format
  const tokens: string[] = []
  let current = ''

  while (i < trimmed.length) {
    if (trimmed[i] === '<') {
      // Flush text
      if (current.trim()) {
        tokens.push(current)
      } else if (current) {
        // Preserve whitespace-only content if it has newlines
        if (current.includes('\n')) {
          // skip
        }
      }
      current = '<'

      // Check for comment
      if (trimmed.slice(i, i + 4) === '<!--') {
        current = '<!--'
        i += 4
        while (i < trimmed.length && trimmed.slice(i, i + 3) !== '-->') {
          current += trimmed[i]
          i++
        }
        current += '-->'
        i += 3
        tokens.push(current)
        current = ''
        continue
      }

      // Check for CDATA
      if (trimmed.slice(i, i + 9) === '<![CDATA[') {
        current = '<![CDATA['
        i += 9
        while (i < trimmed.length && trimmed.slice(i, i + 3) !== ']]>') {
          current += trimmed[i]
          i++
        }
        current += ']]>'
        i += 3
        tokens.push(current)
        current = ''
        continue
      }

      i++
      while (i < trimmed.length && trimmed[i] !== '>') {
        current += trimmed[i]
        i++
      }
      current += '>'
      i++
      tokens.push(current)
      current = ''
    } else {
      current += trimmed[i]
      i++
    }
  }
  if (current.trim()) {
    tokens.push(current)
  }

  // Build formatted output
  const lines: string[] = []
  const selfClosing = /^<[^/]+\/>$/

  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<![CDATA[')) {
      lines.push(indentStr.repeat(depth) + token)
      continue
    }

    if (token.startsWith('</')) {
      depth--
      lines.push(indentStr.repeat(Math.max(0, depth)) + token)
      continue
    }

    if (selfClosing.test(token)) {
      lines.push(indentStr.repeat(depth) + token)
      continue
    }

    if (token.startsWith('<?')) {
      lines.push(indentStr.repeat(depth) + token)
      continue
    }

    if (token.startsWith('<')) {
      lines.push(indentStr.repeat(depth) + token)
      depth++
      continue
    }

    // Text content
    const text = token.trim()
    if (text) {
      lines.push(indentStr.repeat(depth) + text)
    }
  }

  return lines.join('\n')
}

function compressXML(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/>\s+([^<])/g, '>$1')
    .replace(/([^>])\s+</g, '$1<')
    .trim()
}

function validateXML(xml: string): string | null {
  const trimmed = xml.trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('<')) {
    return 'XML 必须以 < 开头'
  }

  // Check tag balance
  const stack: string[] = []
  const tagRegex = /<\/?([^\s>/]+)[^>]*(\/?)>/g
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(trimmed)) !== null) {
    const fullTag = match[0]
    const tagName = match[1]
    const isSelfClosing = match[2] === '/' || fullTag.endsWith('/>')

    if (fullTag.startsWith('<!--') || fullTag.startsWith('<?') || fullTag.startsWith('<![CDATA[')) {
      continue
    }

    if (fullTag.startsWith('</')) {
      const expected = stack.pop()
      if (expected !== tagName) {
        return `标签不匹配：期望 </${expected || '?'}>，实际 </${tagName}>`
      }
    } else if (!isSelfClosing) {
      stack.push(tagName)
    }
  }

  if (stack.length > 0) {
    return `未闭合的标签：<${stack[stack.length - 1]}>`
  }

  return null
}

export default function XmlFormatter(): React.JSX.Element {
  const [input, setInput] = useState('<root><note><to>User</to><from>System</from><heading>Reminder</heading><body>Don\'t forget XML formatting!</body></note></root>')
  const [indentSize, setIndentSize] = useState<2 | 4>(2)
  const [copied, setCopied] = useState(false)

  const error = useMemo(() => validateXML(input), [input])

  const output = useMemo(() => {
    if (error || !input.trim()) return ''
    try {
      return formatXML(input, indentSize)
    } catch (e) {
      return (e as Error).message
    }
  }, [input, indentSize, error])

  const handleFormat = useCallback(() => {
    if (!error) {
      try {
        setInput(formatXML(input, indentSize))
      } catch {
        // ignore
      }
    }
  }, [input, indentSize, error])

  const handleCompress = useCallback(() => {
    setInput(compressXML(input))
  }, [input])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output || input)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // silently fail
    }
  }, [output, input])

  return (
    <div className="xf-page">
      <div className="xf-card">
        <div className="xf-header">
          <Code size={20} />
          <h1 className="xf-title">XML Formatter</h1>
          <p className="xf-subtitle">XML 格式化 · 压缩 · 校验</p>
        </div>

        {/* Controls */}
        <div className="xf-controls">
          <div className="xf-indent-group">
            <label className="xf-indent-label">缩进</label>
            <div className="xf-indent-btns">
              <button
                className={`xf-indent-btn ${indentSize === 2 ? 'active' : ''}`}
                onClick={() => setIndentSize(2)}
              >
                2 空格
              </button>
              <button
                className={`xf-indent-btn ${indentSize === 4 ? 'active' : ''}`}
                onClick={() => setIndentSize(4)}
              >
                4 空格
              </button>
            </div>
          </div>
          <div className="xf-action-btns">
            <button className="xf-btn" onClick={handleFormat} disabled={!!error}>
              <Indent size={13} />
              格式化
            </button>
            <button className="xf-btn" onClick={handleCompress}>
              <Shrink size={13} />
              压缩
            </button>
            <button className="xf-btn" onClick={handleCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button className="xf-btn" onClick={() => setInput('')}>
              <RotateCcw size={13} />
              清空
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="xf-error">
            <span className="xf-error-icon">!</span>
            {error}
          </div>
        )}

        {/* Panes */}
        <div className="xf-panes">
          {/* Input */}
          <div className="xf-pane">
            <div className="xf-pane-header">
              <span className="xf-pane-label">Input</span>
              <span className="xf-pane-size">{input.length} 字符</span>
            </div>
            <textarea
              className="xf-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="在此粘贴 XML..."
              spellCheck={false}
            />
          </div>

          {/* Output */}
          <div className="xf-pane">
            <div className="xf-pane-header">
              <span className="xf-pane-label">Output</span>
              <span className="xf-pane-size">{output.length} 字符</span>
            </div>
            <pre className="xf-output">{output || <span className="xf-placeholder">格式化后的 XML 将显示在这里</span>}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
