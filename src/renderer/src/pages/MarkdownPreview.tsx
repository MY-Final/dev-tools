import { useCallback, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bold,
  Check,
  Code,
  Copy,
  Download,
  FileText,
  Heading,
  Italic,
  Link,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Quote,
  RotateCcw,
  SquareCode,
  Table
} from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  buildHtmlDocument,
  renderMarkdown,
  type MarkdownHeading
} from '@renderer/lib/markdown-render'
import '../styles/markdown-preview.css'

const DEMO_MARKDOWN = `# Markdown 预览

这是一个 **实时** 预览的编辑器，支持 *斜体*、~~删除线~~ 和 \`行内代码\`。

## 列表

- 无序列表
  - 嵌套列表
- [x] 已完成的任务
- [ ] 待办任务

1. 第一步
2. 第二步

## 表格

| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 文本 | 文本 | 1,024 |

## 代码

\`\`\`ts
const greet = (name: string) => 'Hello, ' + name
\`\`\`

> 引用的内容会显示在左侧竖线旁。

## 链接

访问 [项目主页](https://example.com)，或跳到 [表格](#表格)。
`

// Kana, CJK ideographs, Hangul syllables and compatibility ideographs.
const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/g
const TABLE_TEMPLATE = '| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |'

type PaneView = 'edit' | 'preview'
type CopyKey = 'markdown' | 'html'
type ScrollOrigin = 'source' | 'preview'
type InsertKind =
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'heading'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'codeblock'
  | 'table'

interface TextEdit {
  from: number
  to: number
  text: string
  selectFrom: number
  selectTo: number
}

const SYNC_RESUME_MS = 150

function wrapEdit(
  value: string,
  from: number,
  to: number,
  before: string,
  after: string,
  placeholder: string
): TextEdit {
  const selected = value.slice(from, to) || placeholder
  const start = from + before.length
  return {
    from,
    to,
    text: before + selected + after,
    selectFrom: start,
    selectTo: start + selected.length
  }
}

function lineBounds(value: string, from: number, to: number): [number, number] {
  const start = from === 0 ? 0 : value.lastIndexOf('\n', from - 1) + 1
  const end = value.indexOf('\n', to)
  return [start, end === -1 ? value.length : end]
}

function prefixLines(
  value: string,
  from: number,
  to: number,
  prefixAt: (lineNumber: number) => string
): TextEdit {
  const [start, end] = lineBounds(value, from, to)
  const lines = value.slice(start, end).split('\n')
  // A lone empty line still gets the prefix, so the toolbar works on a blank cursor line.
  const skipBlank = lines.length > 1
  let lineNumber = 0
  const text = lines
    .map((line) => {
      if (skipBlank && line.trim() === '') return line
      lineNumber++
      return prefixAt(lineNumber) + line
    })
    .join('\n')
  return { from: start, to: end, text, selectFrom: start, selectTo: start + text.length }
}

/** Inserts a block on its own lines, with blank lines separating it from neighbours. */
function insertBlock(
  value: string,
  from: number,
  to: number,
  block: string,
  innerStart: number,
  innerEnd: number
): TextEdit {
  const lead = from === 0 ? '' : value[from - 1] === '\n' ? '\n' : '\n\n'
  const trail = to >= value.length ? '' : value[to] === '\n' ? '\n' : '\n\n'
  const start = from + lead.length
  return {
    from,
    to,
    text: lead + block + trail,
    selectFrom: start + innerStart,
    selectTo: start + innerEnd
  }
}

const INSERTERS: Record<InsertKind, (value: string, from: number, to: number) => TextEdit> = {
  bold: (value, from, to) => wrapEdit(value, from, to, '**', '**', '粗体文字'),
  italic: (value, from, to) => wrapEdit(value, from, to, '*', '*', '斜体文字'),
  code: (value, from, to) => wrapEdit(value, from, to, '`', '`', '代码'),
  link: (value, from, to) => wrapEdit(value, from, to, '[', '](https://)', '链接文字'),
  heading: (value, from, to) => prefixLines(value, from, to, () => '## '),
  bullet: (value, from, to) => prefixLines(value, from, to, () => '- '),
  ordered: (value, from, to) => prefixLines(value, from, to, (n) => `${n}. `),
  task: (value, from, to) => prefixLines(value, from, to, () => '- [ ] '),
  quote: (value, from, to) => prefixLines(value, from, to, () => '> '),
  codeblock: (value, from, to) => {
    const body = value.slice(from, to)
    return insertBlock(value, from, to, '```\n' + body + '\n```', 4, 4 + body.length)
  },
  // Tables are inserted after any selection rather than replacing it.
  table: (value, _from, to) => insertBlock(value, to, to, TABLE_TEMPLATE, 2, 2 + '列 1'.length)
}

type ToolEntry = { kind: InsertKind; label: string; icon: LucideIcon } | { kind: 'separator' }

const TOOLS: ToolEntry[] = [
  { kind: 'bold', label: '粗体', icon: Bold },
  { kind: 'italic', label: '斜体', icon: Italic },
  { kind: 'code', label: '行内代码', icon: Code },
  { kind: 'link', label: '链接', icon: Link },
  { kind: 'separator' },
  { kind: 'heading', label: '标题', icon: Heading },
  { kind: 'bullet', label: '无序列表', icon: List },
  { kind: 'ordered', label: '有序列表', icon: ListOrdered },
  { kind: 'task', label: '任务列表', icon: ListChecks },
  { kind: 'quote', label: '引用', icon: Quote },
  { kind: 'separator' },
  { kind: 'codeblock', label: '代码块', icon: SquareCode },
  { kind: 'table', label: '表格', icon: Table }
]

/**
 * Edits through execCommand so the browser records the change in the undo stack.
 * Falls back to a state write when execCommand is unavailable.
 */
function applyEdit(
  textarea: HTMLTextAreaElement,
  edit: TextEdit,
  commit: (value: string) => void
): void {
  textarea.focus()
  textarea.setSelectionRange(edit.from, edit.to)
  if (document.execCommand('insertText', false, edit.text)) {
    // The DOM already holds the new value, so React will not move the caret.
    commit(textarea.value)
    textarea.setSelectionRange(edit.selectFrom, edit.selectTo)
    return
  }
  commit(textarea.value.slice(0, edit.from) + edit.text + textarea.value.slice(edit.to))
  // A state write resets the caret when React commits, so restore it after that.
  requestAnimationFrame(() => textarea.setSelectionRange(edit.selectFrom, edit.selectTo))
}

function countWords(source: string): number {
  const cjk = source.match(CJK_RE)?.length ?? 0
  const latin = source.replace(CJK_RE, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  return cjk + latin
}

function decodeHash(href: string): string {
  try {
    return decodeURIComponent(href.slice(1))
  } catch {
    return href.slice(1)
  }
}

interface OutlineListProps {
  headings: MarkdownHeading[]
  onJump: (id: string) => void
}

/** Same list feeds the wide-screen rail and the narrow-screen popover. */
function OutlineList({ headings, onJump }: OutlineListProps): React.JSX.Element {
  if (headings.length === 0) {
    return <p className="mp-outline-empty">文档中还没有标题</p>
  }
  return (
    <nav className="mp-outline-list" aria-label="文档大纲">
      {headings.map((heading) => (
        <button
          key={heading.id}
          type="button"
          className="mp-outline-item"
          data-level={heading.level}
          title={heading.text}
          onClick={() => onJump(heading.id)}
        >
          {heading.text || '(空标题)'}
        </button>
      ))}
    </nav>
  )
}

function downloadHtml(content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'markdown-preview.html'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function MarkdownPreview(): React.JSX.Element {
  const [input, setInput] = useState(DEMO_MARKDOWN)
  const [view, setView] = useState<PaneView>('edit')
  const [syncScroll, setSyncScroll] = useState(true)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [copied, setCopied] = useState<CopyKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const scrollOwner = useRef<ScrollOrigin | null>(null)
  const scrollRelease = useRef<number | undefined>(undefined)

  const rendered = useMemo(() => renderMarkdown(input), [input])
  const stats = useMemo(
    () => ({
      words: countWords(input),
      lines: input === '' ? 0 : input.split('\n').length,
      headings: rendered.headings.length
    }),
    [input, rendered]
  )
  const documentTitle = rendered.headings[0]?.text || 'Markdown 文档'

  const flashNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const copyText = useCallback(
    async (text: string, key: CopyKey) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(key)
        window.setTimeout(() => setCopied(null), 1500)
      } catch {
        flashNotice('复制失败，请检查剪贴板权限')
      }
    },
    [flashNotice]
  )

  const handleSaveHtml = useCallback(async () => {
    const content = buildHtmlDocument(rendered.html, documentTitle)
    try {
      if (window.file) {
        const result = await window.file.save({ content, suggestedName: 'markdown-preview.html' })
        if (!result.canceled) flashNotice(`已保存 ${result.name}`)
      } else {
        downloadHtml(content)
        flashNotice('已开始下载 markdown-preview.html')
      }
    } catch {
      flashNotice('保存失败')
    }
  }, [rendered.html, documentTitle, flashNotice])

  const insert = useCallback((kind: InsertKind) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const edit = INSERTERS[kind](textarea.value, textarea.selectionStart, textarea.selectionEnd)
    applyEdit(textarea, edit, setInput)
  }, [])

  const scrollPreviewTo = useCallback((id: string) => {
    const preview = previewRef.current
    if (!preview) return
    const target = Array.from(preview.querySelectorAll<HTMLElement>('[id]')).find(
      (element) => element.id === id
    )
    if (!target) return
    // offsetTop is measured from the preview, which is the positioned scroll container.
    preview.scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' })
  }, [])

  // Proportional sync. Only the pane the user is driving may move the other one.
  // Ownership is released after SYNC_RESUME_MS without events from that pane,
  // which stops programmatic scrolls from echoing back and forth.
  const followScroll = useCallback(
    (origin: ScrollOrigin) => {
      const source = textareaRef.current
      const preview = previewRef.current
      if (!syncScroll || !source || !preview) return
      if (scrollOwner.current !== null && scrollOwner.current !== origin) return

      scrollOwner.current = origin
      window.clearTimeout(scrollRelease.current)
      scrollRelease.current = window.setTimeout(() => {
        scrollOwner.current = null
      }, SYNC_RESUME_MS)

      const from = origin === 'source' ? source : preview
      const to = origin === 'source' ? preview : source
      const fromRange = from.scrollHeight - from.clientHeight
      const toRange = to.scrollHeight - to.clientHeight
      // A hidden pane (narrow layout) reports zero height, so there is nothing to map to.
      if (fromRange <= 0 || toRange <= 0) return
      const next = (from.scrollTop / fromRange) * toRange
      if (Math.abs(to.scrollTop - next) > 1) to.scrollTop = next
    },
    [syncScroll]
  )

  const handlePreviewClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!(event.target instanceof Element)) return
      const link = event.target.closest('a')
      const href = link?.getAttribute('href')
      // In-document links scroll the preview instead of changing the app's route.
      if (!href?.startsWith('#')) return
      event.preventDefault()
      scrollPreviewTo(decodeHash(href))
    },
    [scrollPreviewTo]
  )

  return (
    <div className="mp-page">
      <div className="mp-card">
        <div className="mp-header">
          <FileText size={20} />
          <h1 className="mp-title">Markdown Preview</h1>
          <p className="mp-subtitle">实时 Markdown 渲染预览 · GFM</p>
        </div>

        <TextFileBar
          value={input}
          onOpened={(file) => setInput(file.content)}
          onNew={() => setInput('')}
          suggestedName="document.md"
        />

        <div className="mp-seg-row">
          <div className="mp-seg" role="tablist" aria-label="切换窗格">
            <button
              type="button"
              role="tab"
              className="mp-seg-btn"
              aria-selected={view === 'edit'}
              onClick={() => setView('edit')}
            >
              编辑
            </button>
            <button
              type="button"
              role="tab"
              className="mp-seg-btn"
              aria-selected={view === 'preview'}
              onClick={() => setView('preview')}
            >
              预览
            </button>
          </div>
        </div>

        <div className="mp-layout" data-view={view}>
          <section className="mp-pane mp-pane-source" aria-label="Markdown 源码">
            <div className="mp-pane-header">
              <span className="mp-pane-label">MARKDOWN</span>
              <div className="mp-actions">
                <button
                  type="button"
                  className="mp-btn"
                  onClick={() => copyText(input, 'markdown')}
                >
                  {copied === 'markdown' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'markdown' ? '已复制' : '复制'}
                </button>
                <button type="button" className="mp-btn" onClick={() => setInput('')}>
                  <RotateCcw size={13} />
                  清空
                </button>
              </div>
            </div>

            <div
              className="mp-toolbar"
              role="toolbar"
              aria-label="插入格式"
              // Keeps the textarea focused and its selection intact while a button is pressed.
              onMouseDown={(event) => event.preventDefault()}
            >
              {TOOLS.map((tool, index) =>
                tool.kind === 'separator' ? (
                  <span key={`sep-${index}`} className="mp-tool-sep" aria-hidden="true" />
                ) : (
                  <button
                    key={tool.kind}
                    type="button"
                    className="mp-tool"
                    title={tool.label}
                    aria-label={tool.label}
                    onClick={() => insert(tool.kind)}
                  >
                    <tool.icon size={14} />
                  </button>
                )
              )}
            </div>

            <textarea
              ref={textareaRef}
              className="mp-textarea"
              aria-label="Markdown 源码输入"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onScroll={() => followScroll('source')}
              placeholder="在此输入 Markdown..."
              spellCheck={false}
            />
          </section>

          <section className="mp-pane mp-pane-preview" aria-label="渲染预览">
            <div className="mp-pane-header">
              <span className="mp-pane-label">PREVIEW</span>
              <div className="mp-actions">
                <Popover open={outlineOpen} onOpenChange={setOutlineOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className="mp-btn mp-outline-btn" title="文档大纲">
                      <ListTree size={13} />
                      大纲 · {rendered.headings.length}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="mp-outline-pop" align="start" sideOffset={6}>
                    <span className="mp-outline-pop-title">文档大纲</span>
                    <OutlineList
                      headings={rendered.headings}
                      onJump={(id) => {
                        scrollPreviewTo(id)
                        setOutlineOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <button
                  type="button"
                  className="mp-btn"
                  aria-pressed={syncScroll}
                  title="两个窗格滚动时互相跟随"
                  onClick={() => setSyncScroll((on) => !on)}
                >
                  <Link2 size={13} />
                  同步滚动
                </button>
                <button
                  type="button"
                  className="mp-btn"
                  onClick={() => copyText(rendered.html, 'html')}
                >
                  {copied === 'html' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'html' ? '已复制' : '复制 HTML'}
                </button>
                <button type="button" className="mp-btn" onClick={handleSaveHtml}>
                  <Download size={13} />
                  保存 HTML
                </button>
              </div>
            </div>

            <div
              ref={previewRef}
              className="mp-preview"
              onScroll={() => followScroll('preview')}
              onClick={handlePreviewClick}
            >
              {rendered.html.trim() === '' ? (
                <p className="mp-empty">在左侧输入 Markdown，这里会实时显示渲染结果。</p>
              ) : (
                <div className="mp-doc" dangerouslySetInnerHTML={{ __html: rendered.html }} />
              )}
            </div>
          </section>

          {/* Wide layouts keep the outline beside the panes instead of over them. */}
          <aside className="mp-outline-rail" aria-label="文档大纲">
            <span className="mp-outline-rail-title">
              大纲
              <span className="mp-outline-rail-count">{rendered.headings.length}</span>
            </span>
            <OutlineList headings={rendered.headings} onJump={scrollPreviewTo} />
          </aside>
        </div>

        <footer className="mp-stats">
          <span>字数 {stats.words}</span>
          <span>行数 {stats.lines}</span>
          <span>标题数 {stats.headings}</span>
          {notice && (
            <span className="mp-notice" role="status">
              {notice}
            </span>
          )}
        </footer>
      </div>
    </div>
  )
}
