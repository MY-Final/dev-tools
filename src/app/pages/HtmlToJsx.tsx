import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/html-to-jsx.css'

// ── HTML to JSX conversion ─────────────────────────────────────

const SELF_CLOSING = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])

interface AttrMap { [html: string]: string }

const ATTR_MAP: AttrMap = {
  class: 'className',
  for: 'htmlFor',
  autofocus: 'autoFocus',
  autocomplete: 'autoComplete',
  autoplay: 'autoPlay',
  charset: 'charSet',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  defaultchecked: 'defaultChecked',
  defaultvalue: 'defaultValue',
  enctype: 'encType',
  formaction: 'formAction',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  frameborder: 'frameBorder',
  href: 'href',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  ismap: 'isMap',
  itemprop: 'itemProp',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  keytype: 'keyType',
  marginheight: 'marginHeight',
  marginwidth: 'marginWidth',
  mediagroup: 'mediaGroup',
  muted: 'muted',
  novalidate: 'noValidate',
  playsinline: 'playsInline',
  readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy',
  rel: 'rel',
  rowspan: 'rowSpan',
  sandbox: 'sandbox',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
  volumelock: 'volumeLock',
}

function htmlToJsx(html: string): string {
  // Normalize
  let out = html.trim()
  if (!out) return ''

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(out, 'text/html')
    const body = doc.body
    if (!body) return out
    return convertNode(body, 0)
  } catch {
    return out
  }
}

function convertNode(node: Node, depth: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    if (!text.trim()) return ''
    // Check if parent is a style/script
    const parent = node.parentElement
    if (parent && (parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT')) {
      return text
    }
    return escapeJSXText(text)
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    const comment = node.textContent || ''
    return `{/* ${comment.trim()} */}`
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const indent = '  '.repeat(depth)

  // Style/Script: keep raw content
  if (tag === 'style' || tag === 'script') {
    const content = el.textContent || ''
    const attrStr = convertAttrs(el)
    if (SELF_CLOSING.has(tag) && !content.trim()) return `${indent}<${tag}${attrStr} />`
    return `${indent}<${tag}${attrStr}>${content}</${tag}>`
  }

  const attrStr = convertAttrs(el)
  const children: string[] = []
  el.childNodes.forEach((child) => {
    const converted = convertNode(child, depth + 1)
    if (converted) children.push(converted)
  })

  if (SELF_CLOSING.has(tag) && children.length === 0) {
    return `${indent}<${tag}${attrStr} />`
  }

  if (children.length === 1 && !children[0].includes('\n')) {
    return `${indent}<${tag}${attrStr}>${children[0]}</${tag}>`
  }

  return `${indent}<${tag}${attrStr}>\n${children.join('\n')}\n${indent}</${tag}>`
}

function convertAttrs(el: Element): string {
  const attrs: string[] = []
  const style = el.getAttribute('style')

  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    if (attr.name === 'style') continue

    let name = ATTR_MAP[attr.name] || attr.name
    // Handle data-* and aria-* attributes
    if (name.startsWith('data-') || name.startsWith('aria-')) {
      name = attr.name
    }

    const val = attr.value
    if (val === '' && ['disabled', 'checked', 'selected', 'required', 'multiple', 'readOnly'].includes(name)) {
      attrs.push(name)
    } else {
      attrs.push(`${name}="${val}"`)
    }
  }

  // Handle style attribute
  if (style) {
    const styleObj = parseStyleToObject(style)
    attrs.push(`style={{${styleObj}}}`)
  }

  return attrs.length > 0 ? ' ' + attrs.join(' ') : ''
}

function parseStyleToObject(style: string): string {
  const props: string[] = []
  style.split(';').forEach((rule) => {
    const trimmed = rule.trim()
    if (!trimmed) return
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) return
    const key = trimmed.substring(0, colonIdx).trim()
    const val = trimmed.substring(colonIdx + 1).trim()
    if (!key || !val) return

    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    let formattedVal = val
    // Handle font sizes, etc with units — they stay as strings
    if (isNaN(Number(val)) && !val.startsWith('"') && !val.startsWith("'")) {
      formattedVal = `'${val}'`
    }
    props.push(`${camelKey}: ${formattedVal}`)
  })
  return props.join(', ')
}

function escapeJSXText(text: string): string {
  // Basic escaping for JSX text
  return text.replace(/{/g, '{`{`}').replace(/}/g, '{`}`}')
    .replace(/\u00A0/g, '\u00A0') // keep &nbsp;
}

const SAMPLES = [
  '<div class="container" id="app"><h1>Hello World</h1><p>Welcome</p></div>',
  '<input type="text" class="form-input" disabled placeholder="Enter name...">',
  '<div style="font-size: 16px; color: #333; background-color: #f5f5f5; padding: 20px;">Styled Content</div>',
  '<a href="/page" target="_blank" rel="noopener noreferrer" class="link">Visit <strong>Now</strong></a>',
]

export default function HtmlToJsx(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const output = useMemo(() => htmlToJsx(input), [input])

  const copy = useCallback(async () => {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }, [output])

  return (
    <div className="hj-page">
      <div className="hj-card">
        <div className="hj-header">
          <h2 className="hj-title">HTML to JSX</h2>
          <p className="hj-subtitle">HTML 一键转 React JSX 语法</p>
        </div>

        <div className="hj-toolbar">
          <button className="hj-btn hj-btn-ghost" onClick={() => setInput(SAMPLES[0])}>示例 1</button>
          <button className="hj-btn hj-btn-ghost" onClick={() => setInput(SAMPLES[1])}>示例 2</button>
          <button className="hj-btn hj-btn-ghost" onClick={() => setInput(SAMPLES[2])}>示例 3</button>
          <button className="hj-btn hj-btn-ghost" onClick={() => setInput(SAMPLES[3])}>示例 4</button>
        </div>

        <div className="hj-panes">
          <div className="hj-pane">
            <div className="hj-pane-header">
              <span className="hj-pane-label">HTML</span>
              <button className="hj-btn hj-btn-ghost" onClick={() => setInput('')}><RotateCcw size={13} />清空</button>
            </div>
            <textarea className="hj-textarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder="粘贴 HTML..." rows={10} spellCheck={false} />
          </div>

          <div className="hj-arrow">→</div>

          <div className="hj-pane">
            <div className="hj-pane-header">
              <span className="hj-pane-label">JSX</span>
              {output && (
                <button className="hj-btn hj-btn-ghost" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button>
              )}
            </div>
            <pre className="hj-output">{output || <span className="hj-placeholder">等待输入...</span>}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
