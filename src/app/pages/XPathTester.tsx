import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, Search } from 'lucide-react'
import '../styles/xpath-tester.css'

interface MatchResult {
  index: number
  type: string
  name: string
  text: string
  xml: string
}

// ── Samples ────────────────────────────────────────────────────

const SAMPLE_XML = `<?xml version="1.0"?>
<bookstore>
  <book category="fiction">
    <title lang="en">The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>12.99</price>
  </book>
  <book category="fiction">
    <title lang="en">To Kill a Mockingbird</title>
    <author>Harper Lee</author>
    <year>1960</year>
    <price>14.99</price>
  </book>
  <book category="non-fiction">
    <title lang="es">Cien años de soledad</title>
    <author>Gabriel García Márquez</author>
    <year>1967</year>
    <price>18.50</price>
  </book>
  <book category="fiction">
    <title lang="en">1984</title>
    <author>George Orwell</author>
    <year>1949</year>
    <price>9.99</price>
  </book>
</bookstore>`

const SAMPLE_XPATHS = [
  '//book/title',
  '//book[@category="fiction"]/title',
  '//book[price > 15]/title',
  '//book[1]/author/text()',
  'count(//book)',
  '//title[@lang="es"]'
]

const HTML_SAMPLE = `<html><body>
  <div class="container">
    <ul id="list">
      <li class="item active"><a href="/page1">Link 1</a></li>
      <li class="item"><a href="/page2">Link 2</a></li>
      <li class="item active"><a href="/page3">Link 3</a></li>
    </ul>
    <p class="text">Hello <strong>World</strong></p>
  </div>
</body></html>`

const HTML_XPATHS = [
  '//li[@class="item active"]/a',
  '//a/@href',
  '//p//text()',
  '//li[1]/a/text()'
]

// ── Helpers ────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Component ──────────────────────────────────────────────────

export default function XPathTester(): React.JSX.Element {
  const [xpath, setXpath] = useState('')
  const [source, setSource] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [mode, setMode] = useState<'xml' | 'html'>('xml')

  const { matches, error, matchCount } = useMemo(() => {
    if (!xpath.trim() || !source.trim()) return { matches: null, error: null, matchCount: 0 }

    let doc: Document
    try {
      const parser = new DOMParser()
      doc = parser.parseFromString(source, mode === 'html' ? 'text/html' : 'text/xml')

      // Check for parse error in XML mode
      if (mode === 'xml') {
        const parseError = doc.querySelector('parsererror')
        if (parseError) {
          return {
            matches: null,
            error: 'XML 解析错误: ' + parseError.textContent?.slice(0, 200),
            matchCount: 0
          }
        }
      }
    } catch (err) {
      return {
        matches: null,
        error: '文档解析失败: ' + (err as Error).message,
        matchCount: 0
      }
    }

    try {
      const result = doc.evaluate(
        xpath,
        doc,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
      )

      // Check if it's a number/string/boolean result
      if (result.resultType === XPathResult.NUMBER_TYPE) {
        return {
          matches: [{
            index: 0,
            type: 'number',
            name: '数值结果',
            text: String(result.numberValue),
            xml: String(result.numberValue)
          }],
          error: null,
          matchCount: 1
        }
      }

      if (result.resultType === XPathResult.STRING_TYPE) {
        return {
          matches: [{
            index: 0,
            type: 'string',
            name: '字符串结果',
            text: result.stringValue,
            xml: result.stringValue
          }],
          error: null,
          matchCount: 1
        }
      }

      if (result.resultType === XPathResult.BOOLEAN_TYPE) {
        return {
          matches: [{
            index: 0,
            type: 'boolean',
            name: '布尔结果',
            text: String(result.booleanValue),
            xml: String(result.booleanValue)
          }],
          error: null,
          matchCount: 1
        }
      }

      // NODE_ITERATOR — collect all nodes
      const nodes: Node[] = []
      let node = result.iterateNext()
      while (node) {
        nodes.push(node)
        node = result.iterateNext()
      }

      const matchResults: MatchResult[] = nodes.map((n, i) => {
        if (n.nodeType === Node.ATTRIBUTE_NODE) {
          const attr = n as Attr
          return {
            index: i,
            type: 'attribute',
            name: attr.name,
            text: attr.value,
            xml: `${attr.name}="${attr.value}"`
          }
        }
        if (n.nodeType === Node.TEXT_NODE) {
          return {
            index: i,
            type: 'text',
            name: 'text()',
            text: n.textContent || '',
            xml: n.textContent || ''
          }
        }
        const el = n as Element
        return {
          index: i,
          type: 'element',
          name: el.tagName?.toLowerCase() || el.nodeName,
          text: el.textContent?.trim()?.slice(0, 200) || '',
          xml: truncate(new XMLSerializer().serializeToString(el), 300)
        }
      })

      return { matches: matchResults, error: null, matchCount: matchResults.length }
    } catch (err) {
      return {
        matches: null,
        error: 'XPath 表达式错误: ' + (err as Error).message,
        matchCount: 0
      }
    }
  }, [xpath, source, mode])

  const loadXMLSample = useCallback(() => {
    setSource(SAMPLE_XML)
    setXpath(SAMPLE_XPATHS[0])
    setMode('xml')
  }, [])

  const loadHTMLSample = useCallback(() => {
    setSource(HTML_SAMPLE)
    setXpath(HTML_XPATHS[0])
    setMode('html')
  }, [])

  const clear = useCallback(() => {
    setXpath('')
    setSource('')
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  const copyAllMatches = useCallback(async () => {
    if (!matches) return
    const all = matches.map((m) => m.xml).join('\n---\n')
    try {
      await navigator.clipboard.writeText(all)
      setCopied('all')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }, [matches])

  return (
    <div className="xp-page">
      <div className="xp-card">
        <div className="xp-header">
          <h2 className="xp-title">XPath Tester</h2>
          <p className="xp-subtitle">XPath 表达式测试与节点查询</p>
        </div>

        {/* Mode + Samples */}
        <div className="xp-toolbar">
          <div className="xp-mode-switch">
            <button
              className={`xp-mode-btn ${mode === 'xml' ? 'active' : ''}`}
              onClick={() => setMode('xml')}
            >
              XML
            </button>
            <button
              className={`xp-mode-btn ${mode === 'html' ? 'active' : ''}`}
              onClick={() => setMode('html')}
            >
              HTML
            </button>
          </div>
          <div className="xp-toolbar-spacer" />
          <button className="xp-btn xp-btn-ghost" onClick={loadXMLSample}>XML 示例</button>
          <button className="xp-btn xp-btn-ghost" onClick={loadHTMLSample}>HTML 示例</button>
        </div>

        {/* XPath input */}
        <div className="xp-input-group">
          <label className="xp-label">XPath 表达式</label>
          <input
            className="xp-xpath-input"
            value={xpath}
            onChange={(e) => setXpath(e.target.value)}
            placeholder="//book/title 或 //div[@class='main']//a/@href"
            autoFocus
          />
          {/* Quick XPath selectors */}
          <div className="xp-quick-xpaths">
            {(mode === 'xml' ? SAMPLE_XPATHS : HTML_XPATHS).map((xp) => (
              <button
                key={xp}
                className={`xp-xpath-chip ${xpath === xp ? 'active' : ''}`}
                onClick={() => setXpath(xp)}
              >
                {xp}
              </button>
            ))}
          </div>
        </div>

        {/* XML/HTML input */}
        <div className="xp-input-group">
          <label className="xp-label">
            {mode === 'xml' ? 'XML' : 'HTML'} 文档
          </label>
          <textarea
            className="xp-textarea"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={`粘贴 ${mode === 'xml' ? 'XML' : 'HTML'} 文档...`}
            rows={8}
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="xp-actions">
          <button className="xp-btn xp-btn-ghost" onClick={clear}>
            <RotateCcw size={13} />
            清空
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="xp-error">{error}</div>
        )}

        {/* Results */}
        {matches !== null && !error && (
          <div className="xp-results">
            <div className="xp-result-header">
              <span className="xp-result-count">
                <Search size={13} />
                匹配 {matchCount} 个节点
              </span>
              {matchCount > 0 && (
                <button className="xp-btn xp-btn-ghost" onClick={copyAllMatches}>
                  {copied === 'all' ? <Check size={13} /> : <Copy size={13} />}
                  复制全部
                </button>
              )}
            </div>

            {matchCount === 0 && (
              <div className="xp-no-match">没有匹配的节点</div>
            )}

            <div className="xp-match-list">
              {matches!.map((m) => (
                <div key={m.index} className="xp-match-item">
                  <div className="xp-match-header">
                    <span className="xp-match-index">#{m.index + 1}</span>
                    <span className={`xp-match-type xp-type-${m.type}`}>{m.type}</span>
                    <span className="xp-match-name">{m.name}</span>
                  </div>
                  <div className="xp-match-body">
                    {m.type === 'element' && m.text && (
                      <div className="xp-match-text">{truncate(m.text, 150)}</div>
                    )}
                    <div className="xp-match-xml-wrap">
                      <code className="xp-match-xml">{truncate(m.xml, 400)}</code>
                      <button
                        className="xp-copy-btn"
                        title="复制"
                        onClick={() => copyToClipboard(m.xml)}
                      >
                        {copied === m.xml ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
