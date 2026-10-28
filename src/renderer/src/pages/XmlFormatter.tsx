import { useState, useMemo, useCallback } from 'react'
import { Code, Copy, Check, RotateCcw, Indent, Shrink } from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import '../styles/xml-formatter.css'

type XmlToken =
  | { kind: 'text'; raw: string }
  | { kind: 'open'; raw: string; name: string; selfClosing: boolean }
  | { kind: 'close'; raw: string; name: string }
  // 注释、CDATA、处理指令、DOCTYPE 等：原样保留，不参与标签嵌套
  | { kind: 'special'; raw: string }
  // 未正确结束的语法结构（如缺少 -->、缺少 > 或引号未闭合）
  | { kind: 'invalid'; raw: string }

const BLOCK_SECTIONS: Array<[open: string, close: string]> = [
  ['<!--', '-->'],
  ['<![CDATA[', ']]>'],
  ['<?', '?>']
]

/**
 * 判断标签是否自闭合（<a/>、<a x="1"/>）。
 * 逐字符扫描并跟踪引号，属性值中的 "/" 不会被误判。
 */
function isSelfClosingTag(tagText: string): boolean {
  if (!tagText.endsWith('/>')) return false
  let quote = ''
  // 从 1 开始跳过起始 '<'，到 length - 1 为止排除结尾 '>'
  for (let k = 1; k < tagText.length - 1; k++) {
    const c = tagText[k]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    }
  }
  return quote === ''
}

/**
 * 从 start 处的 '<' 开始查找结束的 '>'，返回其后的位置；未找到返回 -1。
 * 引号内的 '>' 不作为结束符；声明（如 DOCTYPE）还需跳过方括号内部子集。
 */
function findTagEnd(xml: string, start: number, isDeclaration: boolean): number {
  let quote = ''
  let bracket = 0
  for (let k = start + 1; k < xml.length; k++) {
    const c = xml[k]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (isDeclaration && c === '[') {
      bracket++
    } else if (isDeclaration && c === ']') {
      bracket--
    } else if (c === '>' && bracket <= 0) {
      return k + 1
    }
  }
  return -1
}

/** 校验与格式化共用的扫描器，保证两者对“什么是标签”的判断一致。 */
function tokenizeXML(xml: string): XmlToken[] {
  const tokens: XmlToken[] = []
  let i = 0

  while (i < xml.length) {
    if (xml[i] !== '<') {
      const next = xml.indexOf('<', i)
      const end = next === -1 ? xml.length : next
      tokens.push({ kind: 'text', raw: xml.slice(i, end) })
      i = end
      continue
    }

    const block = BLOCK_SECTIONS.find(([open]) => xml.startsWith(open, i))
    if (block) {
      const [open, close] = block
      const closeAt = xml.indexOf(close, i + open.length)
      if (closeAt === -1) {
        tokens.push({ kind: 'invalid', raw: xml.slice(i) })
        break
      }
      const end = closeAt + close.length
      tokens.push({ kind: 'special', raw: xml.slice(i, end) })
      i = end
      continue
    }

    const isDeclaration = xml.startsWith('<!', i)
    const end = findTagEnd(xml, i, isDeclaration)
    if (end === -1) {
      tokens.push({ kind: 'invalid', raw: xml.slice(i) })
      break
    }

    const raw = xml.slice(i, end)
    i = end

    if (isDeclaration) {
      tokens.push({ kind: 'special', raw })
      continue
    }

    const match = /^<(\/?)([^\s/>]*)/.exec(raw)
    const name = match?.[2] ?? ''
    if (!name) {
      tokens.push({ kind: 'invalid', raw })
    } else if (match?.[1]) {
      tokens.push({ kind: 'close', raw, name })
    } else {
      tokens.push({ kind: 'open', raw, name, selfClosing: isSelfClosingTag(raw) })
    }
  }

  return tokens
}

function formatXML(xml: string, indent: number): string {
  const trimmed = xml.trim()
  if (!trimmed) return ''

  // Basic validation
  if (!trimmed.startsWith('<')) {
    throw new Error('无效的 XML：必须以 < 开头')
  }

  const indentStr = ' '.repeat(indent)
  const lines: string[] = []
  const tokens = tokenizeXML(trimmed)
  let depth = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    switch (token.kind) {
      case 'text': {
        const text = token.raw.trim()
        if (text) lines.push(indentStr.repeat(depth) + text)
        break
      }
      case 'open': {
        // Text-only elements stay on one line, which is how people write XML.
        const text = tokens[i + 1]
        const close = tokens[i + 2]
        if (
          !token.selfClosing &&
          text?.kind === 'text' &&
          text.raw.trim() !== '' &&
          close?.kind === 'close' &&
          close.name === token.name
        ) {
          lines.push(indentStr.repeat(depth) + token.raw + text.raw.trim() + close.raw)
          i += 2
          break
        }
        lines.push(indentStr.repeat(depth) + token.raw)
        if (!token.selfClosing) depth++
        break
      }
      case 'close':
        depth = Math.max(0, depth - 1)
        lines.push(indentStr.repeat(depth) + token.raw)
        break
      case 'special':
        lines.push(indentStr.repeat(depth) + token.raw)
        break
      case 'invalid':
        throw new Error('无效的 XML：语法未正确结束')
    }
  }

  return lines.join('\n')
}

function compressXML(xml: string): string {
  const tokens = tokenizeXML(xml)
  return tokens
    .filter((token, index) => {
      // 只删除位于两个标签之间的纯空白缩进，文本节点内容原样保留
      const isBetween = index > 0 && index < tokens.length - 1
      return !(token.kind === 'text' && isBetween && !token.raw.trim())
    })
    .map((token) => token.raw)
    .join('')
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

  for (const token of tokenizeXML(trimmed)) {
    if (token.kind === 'invalid') {
      return `XML 语法未正确结束：${token.raw.slice(0, 30)}`
    }
    if (token.kind === 'open' && !token.selfClosing) {
      stack.push(token.name)
    } else if (token.kind === 'close') {
      const expected = stack.pop()
      if (expected !== token.name) {
        return `标签不匹配：期望 </${expected || '?'}>，实际 </${token.name}>`
      }
    }
  }

  if (stack.length > 0) {
    return `未闭合的标签：<${stack[stack.length - 1]}>`
  }

  return null
}

export default function XmlFormatter(): React.JSX.Element {
  const [input, setInput] = useState(
    "<root><note><to>User</to><from>System</from><heading>Reminder</heading><body>Don't forget XML formatting!</body></note></root>"
  )
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
    // 有错误时不复制，避免把无效数据当作结果复制出去
    if (error) return
    try {
      await navigator.clipboard.writeText(output || input)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // silently fail
    }
  }, [error, output, input])

  return (
    <div className="xf-page">
      <div className="xf-card">
        <div className="xf-header">
          <Code size={20} />
          <h1 className="xf-title">XML Formatter</h1>
          <p className="xf-subtitle">XML 格式化 · 压缩 · 校验</p>
        </div>

        <TextFileBar
          value={input}
          onOpened={(file) => setInput(file.content)}
          onNew={() => setInput('')}
          suggestedName="formatted.xml"
        />

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
            <button
              className="xf-btn"
              onClick={handleCopy}
              disabled={!!error}
              title={error ? '存在格式错误，修正后才能复制' : undefined}
            >
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
            <pre className="xf-output">
              {output || <span className="xf-placeholder">格式化后的 XML 将显示在这里</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
