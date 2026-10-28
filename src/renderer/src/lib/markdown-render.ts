import DOMPurify, { type Config } from 'dompurify'
import { Marked, type RendererObject, type Token, type Tokens } from 'marked'

export interface MarkdownHeading {
  id: string
  text: string
  level: number
}

export interface MarkdownRender {
  html: string
  headings: MarkdownHeading[]
}

const EXTERNAL_URL_RE = /^https?:\/\//i

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}

/**
 * GitHub-style heading ids: lowercase, punctuation removed, whitespace turned into
 * hyphens, and `-1`, `-2` suffixes for repeats. Each call returns a fresh slugger so
 * ids depend only on the document, not on earlier renders.
 */
export function createSlugger(): (text: string) => string {
  const used = new Set<string>()
  return (text) => {
    const base =
      text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-') || 'section'
    let slug = base
    for (let n = 1; used.has(slug); n++) slug = `${base}-${n}`
    used.add(slug)
    return slug
  }
}

function plainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'html') return ''
      if ('tokens' in token && token.tokens) return plainText(token.tokens)
      return 'text' in token && typeof token.text === 'string' ? token.text : ''
    })
    .join('')
}

function alignAttr(cell: Tokens.TableCell): string {
  return cell.align ? ` align="${cell.align}"` : ''
}

function createRenderer(
  slugger: (text: string) => string,
  headings: MarkdownHeading[]
): RendererObject {
  return {
    heading({ tokens, depth }) {
      const text = plainText(tokens)
      const id = slugger(text)
      headings.push({ id, text, level: depth })
      return `<h${depth} id="${escapeHtml(id)}"><a class="mp-anchor" href="#${escapeHtml(id)}" aria-hidden="true" tabindex="-1">#</a>${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
    link({ href, title, tokens }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      const targetAttr = EXTERNAL_URL_RE.test(href)
        ? ' target="_blank" rel="noopener noreferrer"'
        : ''
      return `<a href="${escapeHtml(href)}"${titleAttr}${targetAttr}>${this.parser.parseInline(tokens)}</a>`
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy">`
    },
    code({ text, lang, escaped }) {
      const label = (lang ?? '').trim().split(/\s+/, 1)[0] ?? ''
      const body = escaped ? text : escapeHtml(text)
      const dataAttr = label ? ` data-lang="${escapeHtml(label)}"` : ''
      const classAttr = label ? ` class="language-${escapeHtml(label)}"` : ''
      return `<pre class="mp-code"${dataAttr}><code${classAttr}>${body}</code></pre>\n`
    },
    checkbox({ checked }) {
      return `<input class="mp-task" type="checkbox" disabled${checked ? ' checked' : ''}> `
    },
    table(token) {
      const head = token.header
        .map((cell) => `<th${alignAttr(cell)}>${this.parser.parseInline(cell.tokens)}</th>`)
        .join('')
      const body = token.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td${alignAttr(cell)}>${this.parser.parseInline(cell.tokens)}</td>`)
              .join('')}</tr>`
        )
        .join('')
      return `<div class="mp-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`
    }
  }
}

/**
 * Markdown to HTML with no sanitizing. Raw HTML in the source passes through
 * unchanged, so never inject this output directly; use `renderMarkdown`.
 */
export function parseMarkdown(source: string): MarkdownRender {
  const headings: MarkdownHeading[] = []
  const marked = new Marked({ gfm: true, renderer: createRenderer(createSlugger(), headings) })
  return { html: marked.parse(source, { async: false }), headings }
}

const SANITIZE_CONFIG: Config = {
  ADD_ATTR: ['target', 'align', 'loading'],
  FORBID_TAGS: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'frame',
    'frameset',
    'base',
    'link',
    'meta'
  ],
  FORBID_ATTR: ['style'],
  // Heading ids must survive even when they match a document property ("Open",
  // "Location"). Forms and scripts are removed above, so clobbering is not reachable.
  SANITIZE_DOM: false
}

function sanitizeHtml(html: string): string {
  // Without a DOM, DOMPurify returns its input unchanged, so fail closed instead.
  if (!DOMPurify.isSupported) return `<pre>${escapeHtml(html)}</pre>`
  return DOMPurify.sanitize(html, SANITIZE_CONFIG)
}

export function renderMarkdown(source: string): MarkdownRender {
  const { html, headings } = parseMarkdown(source)
  return { html: sanitizeHtml(html), headings }
}

const EXPORT_CSS = `:root { color-scheme: light; }
body { margin: 0; background: #ffffff; color: #1f2328; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; line-height: 1.75; }
.mp-doc { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; font-size: 16px; word-wrap: break-word; }
.mp-doc > :first-child { margin-top: 0; }
.mp-doc h1, .mp-doc h2, .mp-doc h3, .mp-doc h4, .mp-doc h5, .mp-doc h6 { line-height: 1.3; font-weight: 600; margin: 1.6em 0 0.6em; }
.mp-doc h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
.mp-doc h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
.mp-doc h3 { font-size: 1.25em; }
.mp-doc h4 { font-size: 1em; }
.mp-doc h5, .mp-doc h6 { font-size: 0.875em; color: #57606a; }
.mp-doc p, .mp-doc ul, .mp-doc ol, .mp-doc blockquote, .mp-doc pre, .mp-doc hr { margin: 0 0 1em; }
.mp-doc ul, .mp-doc ol { padding-inline-start: 1.6em; }
.mp-doc li + li { margin-top: 0.25em; }
.mp-doc li:has(> .mp-task) { list-style: none; margin-inline-start: -1.25em; }
.mp-task { margin: 0 0.45em 0 0; width: 1em; height: 1em; vertical-align: -0.15em; accent-color: #0969da; }
.mp-doc a { color: #0969da; text-decoration: none; }
.mp-doc a:hover { text-decoration: underline; }
.mp-anchor { margin-inline-start: -0.9em; padding-inline-end: 0.35em; color: #8c959f; text-decoration: none; }
.mp-doc blockquote { padding: 0.25em 1em; border-inline-start: 4px solid #d0d7de; color: #57606a; }
.mp-doc code { font-family: Consolas, "JetBrains Mono", monospace; font-size: 0.85em; background: #f6f8fa; padding: 0.15em 0.4em; border-radius: 4px; }
.mp-doc pre.mp-code { position: relative; padding: 14px 16px; background: #f6f8fa; border: 1px solid #d8dee4; border-radius: 6px; overflow-x: auto; }
.mp-doc pre.mp-code code { background: none; padding: 0; font-size: 0.85em; line-height: 1.6; }
.mp-doc pre.mp-code[data-lang]::before { content: attr(data-lang); position: absolute; top: 4px; right: 10px; font-size: 0.7em; color: #57606a; }
.mp-doc .mp-table-wrap { overflow-x: auto; margin: 0 0 1em; }
.mp-doc table { border-collapse: collapse; }
.mp-doc th, .mp-doc td { border: 1px solid #d0d7de; padding: 6px 13px; text-align: left; }
.mp-doc th { background: #f6f8fa; font-weight: 600; }
.mp-doc [align="center"] { text-align: center; }
.mp-doc [align="right"] { text-align: right; }
.mp-doc img { max-width: 100%; height: auto; }
.mp-doc hr { border: 0; border-top: 1px solid #d8dee4; margin: 1.5em 0; }`

export function buildHtmlDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'">
<title>${escapeHtml(title)}</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body>
<main class="mp-doc">
${bodyHtml}
</main>
</body>
</html>
`
}
