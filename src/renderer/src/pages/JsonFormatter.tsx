import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import {
  Copy,
  Check,
  Trash2,
  FileJson,
  Code,
  TreePine,
  Wand2,
  Download,
  Braces,
  CopyPlus,
  Route,
  Key,
  BracesIcon,
  ArrowUpDown,
  Sparkles,
  Search,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Hammer,
  FileType2,
  Crosshair,
  ListTree
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { search } from '@codemirror/search'
import { useJsonFormatter, type Indent } from '@renderer/tools/json-formatter/useJsonFormatter'

const INDENTS: Indent[] = [2, 4, 6, 8]

const customTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--color-text)',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace"
  },
  '.cm-content': {
    caretColor: 'var(--color-accent-soft)',
    padding: '12px 0',
    color: 'var(--color-text)'
  },
  '.cm-line': {
    color: 'var(--color-text)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent-soft)',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--color-accent-soft-subtle) !important'
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--color-surface-hover)'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    fontSize: '11px'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text-secondary)'
  },
  '.cm-foldGutter': {
    color: 'var(--color-text-muted)'
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--color-accent-soft)'
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--color-text)'
  },
  '.cm-panels': {
    backgroundColor: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)'
  },
  '.cm-panel.cm-search': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)'
  },
  '.cm-placeholder': {
    color: 'var(--color-text-muted)'
  }
})

const jsonHighlight = EditorView.baseTheme({
  '.ͼb': { color: '#7C6BC4' },
  '.ͼc': { color: '#2DA44E' },
  '.ͼd': { color: '#BF8700' },
  '.ͼe': { color: '#CF222E' }
})

const editorExtensions = [json(), search({ top: true }), customTheme, jsonHighlight]

interface ContextMenuInfo {
  x: number
  y: number
  value: string
  key: string
  path: string
}

type JsonTreeValue = string | number | boolean | null | JsonTreeValue[] | { [key: string]: JsonTreeValue }
type ToastKind = 'value' | 'key' | 'path' | 'jsonpath' | 'query' | 'types' | 'repair' | 'node'
type SidePanel = 'node' | 'types' | null

interface SelectedNodeInfo {
  key: string
  path: string
  value: JsonTreeValue
  type: string
  meta: string
}

interface QueryResult {
  path: string
  value: JsonTreeValue
}

interface RepairPreview {
  original: string
  repaired: string
  changes: string[]
}

const largeJsonLimits = {
  searchChars: 500_000,
  expandAllNodes: 1_500,
  autoSearchNodes: 3_000
}

interface JsonSummary {
  objects: number
  arrays: number
  primitives: number
}

interface JsonTreeNodeProps {
  label: string
  path: string
  value: JsonTreeValue
  depth: number
  expandDepth: number
  matchedPaths: Set<string>
  activePath: string
  onSelect: (info: SelectedNodeInfo) => void
  onContextMenu: (e: React.MouseEvent, info: Omit<ContextMenuInfo, 'x' | 'y'>) => void
}

function isJsonRecord(value: JsonTreeValue): value is { [key: string]: JsonTreeValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function formatPrimitive(value: string | number | boolean | null): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === null) return 'null'
  return String(value)
}

function formatJsonPathSegment(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`
}

function getValueKind(value: JsonTreeValue): string {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function getCollectionMeta(value: JsonTreeValue): string {
  if (Array.isArray(value)) return `${value.length} items`
  if (isJsonRecord(value)) return `${Object.keys(value).length} keys`
  return getValueKind(value)
}

function stringifyJsonValue(value: JsonTreeValue): string {
  return JSON.stringify(value, null, 2) ?? ''
}

function getNodeValuePreview(value: JsonTreeValue): string {
  return Array.isArray(value) || isJsonRecord(value) ? stringifyJsonValue(value) : formatPrimitive(value)
}

function getSearchText(label: string, path: string, value: JsonTreeValue): string {
  return `${label} ${path} ${getNodeValuePreview(value)}`.toLowerCase()
}

function hasMatchedDescendant(value: JsonTreeValue, path: string, matchedPaths: Set<string>): boolean {
  if (matchedPaths.has(path)) return true
  if (Array.isArray(value)) {
    return value.some((item, index) => hasMatchedDescendant(item, `${path}[${index}]`, matchedPaths))
  }
  if (isJsonRecord(value)) {
    return Object.entries(value).some(([key, item]) => hasMatchedDescendant(item, `${path}${formatJsonPathSegment(key)}`, matchedPaths))
  }
  return false
}

function collectSearchMatches(value: JsonTreeValue, query: string, label = '$', path = '$'): QueryResult[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  const current = getSearchText(label, path, value).includes(normalizedQuery) ? [{ path, value }] : []
  if (Array.isArray(value)) {
    return current.concat(
      value.flatMap((item, index) => collectSearchMatches(item, normalizedQuery, `[${index}]`, `${path}[${index}]`))
    )
  }
  if (isJsonRecord(value)) {
    return current.concat(
      Object.entries(value).flatMap(([key, item]) => collectSearchMatches(item, normalizedQuery, key, `${path}${formatJsonPathSegment(key)}`))
    )
  }
  return current
}

function parseJsonPath(path: string): string[] | null {
  const tokens: string[] = []
  let index = path.trim().startsWith('$') ? 1 : 0

  while (index < path.trim().length) {
    const source = path.trim()
    if (source.startsWith('..', index)) {
      index += 2
      const match = source.slice(index).match(/^[A-Za-z_$][\w$]*/)
      if (!match) return null
      tokens.push(`..${match[0]}`)
      index += match[0].length
    } else if (source[index] === '.') {
      index += 1
      if (source[index] === '*') {
        tokens.push('*')
        index += 1
        continue
      }
      const match = source.slice(index).match(/^[A-Za-z_$][\w$]*/)
      if (!match) return null
      tokens.push(match[0])
      index += match[0].length
    } else if (source[index] === '[') {
      const end = source.indexOf(']', index)
      if (end === -1) return null
      const raw = source.slice(index + 1, end).trim()
      if (raw === '*') {
        tokens.push('*')
      } else if (/^\d+$/.test(raw)) {
        tokens.push(raw)
      } else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        tokens.push(raw.slice(1, -1))
      } else {
        return null
      }
      index = end + 1
    } else {
      return null
    }
  }

  return tokens
}

function collectRecursiveKey(value: JsonTreeValue, key: string, path: string): QueryResult[] {
  const results: QueryResult[] = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      results.push(...collectRecursiveKey(item, key, `${path}[${index}]`))
    })
  } else if (isJsonRecord(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      const childPath = `${path}${formatJsonPathSegment(childKey)}`
      if (childKey === key) results.push({ path: childPath, value: childValue })
      results.push(...collectRecursiveKey(childValue, key, childPath))
    })
  }
  return results
}

function runJsonPathQuery(value: JsonTreeValue, path: string): { results: QueryResult[]; error: string } {
  const tokens = parseJsonPath(path)
  if (!tokens) return { results: [], error: 'JSONPath 语法暂不支持' }

  let results: QueryResult[] = [{ path: '$', value }]
  for (const token of tokens) {
    if (token.startsWith('..')) {
      const key = token.slice(2)
      results = results.flatMap((result) => collectRecursiveKey(result.value, key, result.path))
      continue
    }

    results = results.flatMap((result) => {
      if (token === '*') {
        if (Array.isArray(result.value)) {
          return result.value.map((item, index) => ({ path: `${result.path}[${index}]`, value: item }))
        }
        if (isJsonRecord(result.value)) {
          return Object.entries(result.value).map(([key, item]) => ({ path: `${result.path}${formatJsonPathSegment(key)}`, value: item }))
        }
        return []
      }

      if (Array.isArray(result.value) && /^\d+$/.test(token)) {
        const item = result.value[Number(token)]
        return item === undefined ? [] : [{ path: `${result.path}[${token}]`, value: item }]
      }
      if (isJsonRecord(result.value) && token in result.value) {
        return [{ path: `${result.path}${formatJsonPathSegment(token)}`, value: result.value[token] }]
      }
      return []
    })
  }

  return { results, error: '' }
}

function repairJsonText(value: string): RepairPreview {
  const changes: string[] = []
  const start = Math.min(
    ...['{', '['].map((token) => {
      const found = value.indexOf(token)
      return found === -1 ? Number.POSITIVE_INFINITY : found
    })
  )
  const lastObject = value.lastIndexOf('}')
  const lastArray = value.lastIndexOf(']')
  const end = Math.max(lastObject, lastArray)
  let repaired = Number.isFinite(start) && end > start ? value.slice(start, end + 1) : value
  if (repaired !== value) changes.push('提取文本中的 JSON 块')

  const applyRule = (label: string, replacer: (text: string) => string): void => {
    const next = replacer(repaired)
    if (next !== repaired) changes.push(label)
    repaired = next
  }

  applyRule('移除 // 注释', (text) => text.replace(/\/\/.*$/gm, ''))
  applyRule('移除 /* */ 注释', (text) => text.replace(/\/\*[\s\S]*?\*\//g, ''))
  applyRule('移除 trailing comma', (text) => text.replace(/,\s*([}\]])/g, '$1'))
  applyRule('给未加引号的 key 补双引号', (text) => text.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3'))
  applyRule('单引号字符串转双引号', (text) =>
    text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, content: string) => `"${content.replace(/"/g, '\\"')}"`)
  )
  applyRule('Python 布尔/空值转 JSON', (text) =>
    text.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
  )

  return { original: value, repaired, changes }
}

function sanitizeTypeName(value: string): string {
  const name = value.replace(/[^A-Za-z0-9_$]/g, ' ').replace(/(^|\s+)(\w)/g, (_match, _space: string, char: string) => char.toUpperCase()).replace(/\s+/g, '')
  return /^[A-Za-z_$]/.test(name) ? name : `Type${name}`
}

function formatTsKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
}

function mergeTypeNames(types: string[]): string {
  const unique = [...new Set(types)]
  return unique.length === 1 ? unique[0] : unique.join(' | ')
}

function inferTsType(value: JsonTreeValue, name: string, interfaces: string[]): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (!value.length) return 'unknown[]'
    const itemTypes = value.map((item) => inferTsType(item, `${name}Item`, interfaces))
    return `Array<${mergeTypeNames(itemTypes)}>`
  }
  if (isJsonRecord(value)) {
    const typeName = sanitizeTypeName(name)
    const fields = Object.entries(value)
      .map(([key, item]) => `  ${formatTsKey(key)}: ${inferTsType(item, key, interfaces)}`)
      .join('\n')
    interfaces.push(`export interface ${typeName} {\n${fields}\n}`)
    return typeName
  }
  return typeof value
}

function generateTypeScript(value: JsonTreeValue): string {
  const interfaces: string[] = []
  const rootType = inferTsType(value, 'Root', interfaces)
  return `${interfaces.reverse().join('\n\n')}\n\nexport type JsonRoot = ${rootType}`.trim()
}

function countTreeNodes(value: JsonTreeValue): number {
  if (Array.isArray(value)) return 1 + value.reduce<number>((sum, item) => sum + countTreeNodes(item), 0)
  if (isJsonRecord(value)) return 1 + Object.values(value).reduce<number>((sum, item) => sum + countTreeNodes(item), 0)
  return 1
}

function getValueAtPath(value: JsonTreeValue, path: string): JsonTreeValue | null {
  const tokens = parseJsonPath(path)
  if (!tokens) return null
  let current: JsonTreeValue = value
  for (const token of tokens) {
    if (token === '*' || token.startsWith('..')) return null
    if (Array.isArray(current) && /^\d+$/.test(token)) {
      const next = current[Number(token)]
      if (next === undefined) return null
      current = next
    } else if (isJsonRecord(current) && token in current) {
      current = current[token]
    } else {
      return null
    }
  }
  return current
}

function getTreeSummary(value: JsonTreeValue): JsonSummary {
  if (Array.isArray(value)) {
    return value.reduce<JsonSummary>(
      (summary, item) => {
        const child = getTreeSummary(item)
        return {
          objects: summary.objects + child.objects,
          arrays: summary.arrays + child.arrays,
          primitives: summary.primitives + child.primitives
        }
      },
      { objects: 0, arrays: 1, primitives: 0 }
    )
  }

  if (isJsonRecord(value)) {
    return Object.values(value).reduce<JsonSummary>(
      (summary, item) => {
        const child = getTreeSummary(item)
        return {
          objects: summary.objects + child.objects,
          arrays: summary.arrays + child.arrays,
          primitives: summary.primitives + child.primitives
        }
      },
      { objects: 1, arrays: 0, primitives: 0 }
    )
  }

  return { objects: 0, arrays: 0, primitives: 1 }
}

function JsonTreeNode({
  label,
  path,
  value,
  depth,
  expandDepth,
  matchedPaths,
  activePath,
  onSelect,
  onContextMenu
}: JsonTreeNodeProps): React.JSX.Element {
  const isArray = Array.isArray(value)
  const isObject = isJsonRecord(value)
  const isCollection = isArray || isObject
  const displayPath = path || '$'
  const keyName = label === '$' ? '' : label
  const isMatched = matchedPaths.has(displayPath)
  const isActive = activePath === displayPath
  const rowClassName = `jf-tree-row ${isMatched ? 'is-match' : ''} ${isActive ? 'is-active' : ''}`

  const handleSelect = (): void => {
    onSelect({
      key: keyName,
      path: displayPath,
      value,
      type: getValueKind(value),
      meta: getCollectionMeta(value)
    })
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    onContextMenu(e, {
      key: keyName,
      path: displayPath,
      value: getNodeValuePreview(value)
    })
  }

  if (!isCollection) {
    return (
      <div className={`${rowClassName} jf-tree-leaf`} data-json-path={displayPath} onClick={handleSelect} onContextMenu={handleContextMenu}>
        <span className="jf-tree-spacer" />
        <span className="jf-tree-key">{label}</span>
        <span className="jf-tree-separator">:</span>
        <span className={`jf-tree-value jf-tree-${getValueKind(value)}`}>{formatPrimitive(value)}</span>
        <span className="jf-tree-path">{displayPath}</span>
      </div>
    )
  }

  const entries = isArray ? value.map((item, index) => [String(index), item] as const) : Object.entries(value)
  const openByDefault = depth < expandDepth || hasMatchedDescendant(value, displayPath, matchedPaths)
  const bracketStart = isArray ? '[' : '{'
  const bracketEnd = isArray ? ']' : '}'

  return (
    <details className="jf-tree-node" open={openByDefault} onContextMenu={handleContextMenu}>
      <summary className={`${rowClassName} jf-tree-branch`} data-json-path={displayPath} onClick={handleSelect}>
        <span className="jf-tree-key">{label}</span>
        <span className="jf-tree-separator">:</span>
        <span className="jf-tree-bracket">{bracketStart}</span>
        <span className="jf-tree-count">{getCollectionMeta(value)}</span>
        <span className="jf-tree-path">{displayPath}</span>
      </summary>
      <div className="jf-tree-children">
        {entries.map(([childKey, childValue]) => {
          const childPath = isArray ? `${displayPath}[${childKey}]` : `${displayPath}${formatJsonPathSegment(childKey)}`
          return (
            <JsonTreeNode
              key={childPath}
              label={isArray ? `[${childKey}]` : childKey}
              path={childPath}
              value={childValue}
              depth={depth + 1}
              expandDepth={expandDepth}
              matchedPaths={matchedPaths}
              activePath={activePath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          )
        })}
        <div className="jf-tree-row jf-tree-closing">
          <span className="jf-tree-spacer" />
          <span className="jf-tree-bracket">{bracketEnd}</span>
        </div>
      </div>
    </details>
  )
}

export default function JsonFormatter(): React.JSX.Element {
  const {
    input,
    setInput,
    output,
    error,
    indent,
    viewMode,
    copied,
    parsedData,
    handleFormat,
    handleMinify,
    handleSortKeys,
    handleCopy,
    handleClear,
    handleLoadSample,
    handleIndentChange,
    handleViewModeChange
  } = useJsonFormatter()

  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuInfo | null>(null)
  const [copiedItem, setCopiedItem] = useState<ToastKind | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [expandDepth, setExpandDepth] = useState(2)
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null)
  const [jsonPathQuery, setJsonPathQuery] = useState('$')
  const [generatedTypes, setGeneratedTypes] = useState('')
  const [forcedPath, setForcedPath] = useState('')
  const [repairPreview, setRepairPreview] = useState<RepairPreview | null>(null)
  const [lastInputBeforeRepair, setLastInputBeforeRepair] = useState('')
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)

  const jsonData = parsedData as JsonTreeValue | null

  const stats = useMemo(() => {
    if (!output) return null
    const lines = output.split('\n').length
    const bytes = new Blob([output]).size
    const data = JSON.parse(output)
    const countKeys = (obj: unknown): number => {
      if (Array.isArray(obj)) return obj.reduce((acc, item) => acc + countKeys(item), 0)
      if (obj !== null && typeof obj === 'object') {
        const keys = Object.keys(obj as Record<string, unknown>)
        return keys.length + keys.reduce((acc, k) => acc + countKeys((obj as Record<string, unknown>)[k]), 0)
      }
      return 0
    }
    const keys = countKeys(data)
    const maxDepth = (obj: unknown, depth = 0): number => {
      if (Array.isArray(obj)) return obj.length ? Math.max(...obj.map((item) => maxDepth(item, depth + 1))) : depth
      if (obj !== null && typeof obj === 'object') {
        const vals = Object.values(obj as Record<string, unknown>)
        return vals.length ? Math.max(...vals.map((v) => maxDepth(v, depth + 1))) : depth
      }
      return depth
    }
    const depth = maxDepth(data)
    return { lines, bytes, keys, depth }
  }, [output])

  const treeSummary = useMemo(() => {
    if (jsonData === null) return null
    return getTreeSummary(jsonData)
  }, [jsonData])

  const nodeCount = useMemo(() => (jsonData === null ? 0 : countTreeNodes(jsonData)), [jsonData])
  const isLargeJson = input.length > largeJsonLimits.searchChars || nodeCount > largeJsonLimits.autoSearchNodes

  const searchMatches = useMemo(() => {
    if (jsonData === null) return []
    if (isLargeJson && searchQuery.trim().length < 3) return []
    return collectSearchMatches(jsonData, searchQuery)
  }, [isLargeJson, jsonData, searchQuery])

  const activeMatch = searchMatches[activeMatchIndex] ?? null
  const matchedPaths = useMemo(() => new Set(searchMatches.map((match) => match.path)), [searchMatches])
  const visiblePaths = useMemo(() => {
    const paths = new Set(matchedPaths)
    if (forcedPath) paths.add(forcedPath)
    return paths
  }, [forcedPath, matchedPaths])

  const jsonPathState = useMemo(() => {
    if (jsonData === null || !jsonPathQuery.trim()) return { results: [] as QueryResult[], error: '' }
    return runJsonPathQuery(jsonData, jsonPathQuery)
  }, [jsonData, jsonPathQuery])

  useEffect(() => {
    setActiveMatchIndex(0)
  }, [searchQuery])

  // Keyboard shortcut
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleFormat()
      }
    },
    [handleFormat]
  )

  const handleEditorChange = useCallback(
    (value: string) => {
      setInput(value)
    },
    [setInput]
  )

  const showCopiedToast = useCallback((kind: ToastKind) => {
    setCopiedItem(kind)
    setTimeout(() => setCopiedItem(null), 1500)
  }, [])

  const scrollToTreePath = useCallback((path: string) => {
    requestAnimationFrame(() => {
      const selector = `[data-json-path="${CSS.escape(path)}"]`
      const target = rightPanelRef.current?.querySelector(selector)
      target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    })
  }, [])

  const selectPath = useCallback(
    (path: string) => {
      if (jsonData === null) return
      const value = getValueAtPath(jsonData, path)
      if (value === null) return
      const key = path === '$' ? '' : path.match(/(?:\.([^.[\]]+)|\[(\d+|".*?"|'.*?')\])$/)?.slice(1).find(Boolean)?.replace(/^['"]|['"]$/g, '') ?? ''
      setForcedPath(path)
      setSelectedNode({
        key,
        path,
        value,
        type: getValueKind(value),
        meta: getCollectionMeta(value)
      })
      handleViewModeChange('tree')
      scrollToTreePath(path)
    },
    [handleViewModeChange, jsonData, scrollToTreePath]
  )

  const handleRepairJson = useCallback(() => {
    const preview = repairJsonText(input)
    setRepairPreview(preview)
    showCopiedToast('repair')
  }, [input, showCopiedToast])

  const handleApplyRepair = useCallback(() => {
    if (!repairPreview) return
    setLastInputBeforeRepair(repairPreview.original)
    setInput(repairPreview.repaired)
    setRepairPreview(null)
  }, [repairPreview, setInput])

  const handleUndoRepair = useCallback(() => {
    if (!lastInputBeforeRepair) return
    setInput(lastInputBeforeRepair)
    setLastInputBeforeRepair('')
  }, [lastInputBeforeRepair, setInput])

  const handleExpandAll = useCallback(() => {
    if (nodeCount > largeJsonLimits.expandAllNodes) {
      setExpandDepth(3)
      return
    }
    setExpandDepth(99)
  }, [nodeCount])

  const handleCollapseAll = useCallback(() => {
    setExpandDepth(0)
  }, [])

  const handleExpandLevel = useCallback((level: number) => {
    setExpandDepth(level)
  }, [])

  const handlePrevMatch = useCallback(() => {
    setActiveMatchIndex((index) => {
      const next = searchMatches.length ? (index - 1 + searchMatches.length) % searchMatches.length : 0
      const match = searchMatches[next]
      if (match) selectPath(match.path)
      return next
    })
  }, [searchMatches, selectPath])

  const handleNextMatch = useCallback(() => {
    setActiveMatchIndex((index) => {
      const next = searchMatches.length ? (index + 1) % searchMatches.length : 0
      const match = searchMatches[next]
      if (match) selectPath(match.path)
      return next
    })
  }, [searchMatches, selectPath])

  const handleSelectNode = useCallback((info: SelectedNodeInfo) => {
    setForcedPath(info.path)
    setSelectedNode(info)
    setSidePanel('node')
  }, [])

  const handleGenerateTypes = useCallback(() => {
    if (jsonData === null) return
    setGeneratedTypes(generateTypeScript(jsonData))
    setSidePanel('types')
  }, [jsonData])

  const handleCopyText = useCallback(
    (text: string, kind: ToastKind) => {
      navigator.clipboard.writeText(text)
      showCopiedToast(kind)
    },
    [showCopiedToast]
  )

  // 同步滚动
  const handleLeftScroll = useCallback(() => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (leftPanelRef.current && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop
      rightPanelRef.current.scrollLeft = leftPanelRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [])

  const handleRightScroll = useCallback(() => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (leftPanelRef.current && rightPanelRef.current) {
      leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop
      leftPanelRef.current.scrollLeft = rightPanelRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [])

  // 绑定滚动事件
  useEffect(() => {
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return

    const leftScroller = left.querySelector('.cm-scroller')
    const rightScroller = right.querySelector('.cm-scroller')

    if (leftScroller) {
      leftScroller.addEventListener('scroll', handleLeftScroll)
    }
    if (rightScroller) {
      rightScroller.addEventListener('scroll', handleRightScroll)
    }

    return () => {
      if (leftScroller) {
        leftScroller.removeEventListener('scroll', handleLeftScroll)
      }
      if (rightScroller) {
        rightScroller.removeEventListener('scroll', handleRightScroll)
      }
    }
  }, [handleLeftScroll, handleRightScroll, viewMode])

  const handleTreeContextMenu = useCallback((e: React.MouseEvent, info: Omit<ContextMenuInfo, 'x' | 'y'>) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      ...info
    })
  }, [])

  const handleCopyValue = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.value)
      showCopiedToast('value')
      setContextMenu(null)
    }
  }, [contextMenu, showCopiedToast])

  const handleCopyKey = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.key)
      showCopiedToast('key')
      setContextMenu(null)
    }
  }, [contextMenu, showCopiedToast])

  const handleCopyPath = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.path)
      showCopiedToast('path')
      setContextMenu(null)
    }
  }, [contextMenu, showCopiedToast])

  const handleCopyJsonPath = useCallback(() => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.path)
      showCopiedToast('jsonpath')
      setContextMenu(null)
    }
  }, [contextMenu, showCopiedToast])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (): void => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  return (
    <div className="jf-page" onClick={handleCloseContextMenu} onKeyDown={handleKeyDown}>
      <div className="jf-container">
        <div className="jf-hero">
          <div>
            <div className="jf-eyebrow">
              <Sparkles size={14} />
              JSON workspace
            </div>
            <h1 className="jf-title">JSON Formatter</h1>
            <p className="jf-subtitle">格式化、压缩、排序，并用带数量标记的树形视图审查结构。</p>
          </div>

          <div className="jf-hero-stats">
            <div className="jf-hero-stat">
              <span>{stats?.lines ?? 0}</span>
              <small>lines</small>
            </div>
            <div className="jf-hero-stat">
              <span>{stats?.keys ?? 0}</span>
              <small>keys</small>
            </div>
            <div className="jf-hero-stat">
              <span>{treeSummary?.arrays ?? 0}</span>
              <small>arrays</small>
            </div>
          </div>
        </div>

        <div className="jf-topbar">
          <div className="jf-topbar-left">
            <div className="jf-logo">
              <Braces size={20} />
            </div>
            <div className="jf-indent-group">
              <span className="jf-label">缩进</span>
              <div className="jf-indent-tabs">
                {INDENTS.map((i) => (
                  <button
                    key={i}
                    className={`jf-tab ${indent === i ? 'active' : ''}`}
                    onClick={() => handleIndentChange(i)}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="jf-topbar-center">
            <div className="jf-divider" />

            <div className="jf-primary-actions">
              <button className="jf-btn jf-btn-primary" onClick={handleFormat}>
                <Wand2 size={14} />
                <span>格式化</span>
              </button>
              <button className="jf-btn jf-btn-secondary" onClick={handleMinify}>
                <Code size={14} />
                <span>压缩</span>
              </button>
              <button className="jf-btn jf-btn-secondary" onClick={handleSortKeys} title="按键名排序">
                <ArrowUpDown size={14} />
                <span>排序</span>
              </button>
              <button className="jf-btn jf-btn-secondary" onClick={handleRepairJson} title="修复常见非标准 JSON">
                <Hammer size={14} />
                <span>修复</span>
              </button>
            </div>

            <div className="jf-divider" />

            <div className="jf-view-tabs">
              <button
                className={`jf-tab ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('editor')}
                title="代码视图"
              >
                <Code size={14} />
              </button>
              <button
                className={`jf-tab ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('tree')}
                title="树形视图"
              >
                <TreePine size={14} />
              </button>
            </div>
          </div>

          <div className="jf-topbar-right">
            {error && (
              <div className="jf-error-badge">
                <span className="jf-error-dot" />
                <span>格式错误</span>
              </div>
            )}
            {!error && output && <div className="jf-ready-badge">已解析</div>}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="jf-error">
            <span className="jf-error-text">
              {error.message}
              {error.line && error.column && (
                <span className="jf-error-pos">
                  &nbsp;at line {error.line}, col {error.column}
                </span>
              )}
            </span>
          </div>
        )}

        {stats && (
          <div className="jf-stats">
            <span className="jf-stat">{stats.lines} 行</span>
            <span className="jf-stat">{stats.bytes.toLocaleString()} B</span>
            <span className="jf-stat">{stats.keys} 键</span>
            <span className="jf-stat">深度 {stats.depth}</span>
            <span className="jf-stat">节点 {nodeCount.toLocaleString()}</span>
            {selectedNode && <span className="jf-stat-path">selected: {selectedNode.path}</span>}
            <span className="jf-stat-hint">Ctrl+Enter 格式化</span>
          </div>
        )}

        {repairPreview && (
          <div className="jf-repair-preview">
            <div>
              <strong>Repair 预览</strong>
              <span>{repairPreview.changes.length ? repairPreview.changes.join(' / ') : '没有检测到可自动修复的规则'}</span>
            </div>
            <div className="jf-repair-actions">
              <button className="jf-mini-btn" onClick={handleApplyRepair}>应用修复</button>
              <button className="jf-mini-btn" onClick={() => setRepairPreview(null)}>取消</button>
            </div>
          </div>
        )}

        {lastInputBeforeRepair && (
          <div className="jf-repair-preview jf-repair-undo">
            <div>
              <strong>已应用 Repair</strong>
              <span>如果结果不符合预期，可以撤销回修复前内容。</span>
            </div>
            <button className="jf-mini-btn" onClick={handleUndoRepair}>撤销 Repair</button>
          </div>
        )}

        <div className="jf-main-grid">
          <div className="jf-left-workspace">
            <div className="jf-workbench">
              <section className="jf-tool-card jf-search-card">
                <div className="jf-tool-card-head">
                  <Search size={14} />
                  <span>树搜索</span>
                  <strong>{searchMatches.length}</strong>
                </div>
                <div className="jf-search-row">
                  <input
                    className="jf-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜 key / value / path..."
                  />
                  <button className="jf-mini-btn" onClick={handlePrevMatch} disabled={!searchMatches.length} title="上一个匹配">
                    <ChevronUp size={13} />
                  </button>
                  <button className="jf-mini-btn" onClick={handleNextMatch} disabled={!searchMatches.length} title="下一个匹配">
                    <ChevronDown size={13} />
                  </button>
                </div>
                <p className="jf-tool-hint">
                  {isLargeJson && searchQuery.trim().length < 3
                    ? '大 JSON 请至少输入 3 个字符再搜索，避免卡顿'
                    : activeMatch
                      ? `${activeMatchIndex + 1}/${searchMatches.length} ${activeMatch.path}`
                      : '输入关键词后会自动展开匹配路径'}
                </p>
              </section>

              <section className="jf-tool-card jf-expand-card">
                <div className="jf-tool-card-head">
                  <ListTree size={14} />
                  <span>展开</span>
                </div>
                <div className="jf-level-actions">
                  <button className="jf-mini-btn" onClick={handleCollapseAll} title="全部折叠">
                    <Minimize2 size={13} />
                    <span>折叠</span>
                  </button>
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      className={`jf-mini-btn ${expandDepth === level ? 'active' : ''}`}
                      onClick={() => handleExpandLevel(level)}
                    >
                      L{level}
                    </button>
                  ))}
                  <button className="jf-mini-btn" onClick={handleExpandAll} title="全部展开">
                    <Maximize2 size={13} />
                    <span>全部</span>
                  </button>
                </div>
                {nodeCount > largeJsonLimits.expandAllNodes && <p className="jf-tool-hint">节点较多，全部展开会限制到 L3</p>}
              </section>

              <section className="jf-tool-card jf-query-card">
                <div className="jf-tool-card-head">
                  <Crosshair size={14} />
                  <span>JSONPath</span>
                  <strong>{jsonPathState.results.length}</strong>
                </div>
                <div className="jf-query-headline">
                  <input
                    className="jf-input"
                    value={jsonPathQuery}
                    onChange={(e) => setJsonPathQuery(e.target.value)}
                    placeholder="$.data.items[0] 或 $..id"
                  />
                  <button
                    className="jf-mini-btn"
                    disabled={!jsonPathState.results.length}
                    onClick={() => handleCopyText(JSON.stringify(jsonPathState.results, null, 2), 'query')}
                  >
                    复制全部
                  </button>
                </div>
                {jsonPathState.error ? (
                  <p className="jf-tool-error">{jsonPathState.error}</p>
                ) : (
                  <div className="jf-query-results">
                    {jsonPathState.results.slice(0, 4).map((result) => (
                      <button
                        key={result.path}
                        className="jf-query-result"
                        onClick={() => selectPath(result.path)}
                        title="定位到树节点"
                      >
                        <code>{result.path}</code>
                        <em>{getValueKind(result.value)}</em>
                        <span>{getNodeValuePreview(result.value)}</span>
                      </button>
                    ))}
                    {!jsonPathState.results.length && <p className="jf-tool-hint">支持 $.key、[0]、[*]、$..id</p>}
                  </div>
                )}
              </section>
            </div>

            {/* 左右编辑区 */}
            <div className="jf-panels">
          {/* 输入面板 */}
          <div className="jf-panel">
            <div className="jf-panel-header">
              <div className="jf-panel-title">
                <FileJson size={14} />
                <span>输入</span>
                <kbd>Ctrl+F 顶部搜索</kbd>
              </div>
              <div className="jf-panel-actions">
                <button className="jf-icon-btn" onClick={handleLoadSample} title="加载示例">
                  <Download size={14} />
                </button>
                <button
                  className="jf-icon-btn"
                  onClick={handleClear}
                  title="清空"
                  disabled={!input}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="jf-editor-area" ref={leftPanelRef}>
              <CodeMirror
                value={input}
                onChange={handleEditorChange}
                extensions={editorExtensions}
                placeholder="粘贴或输入 JSON..."
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: false
                }}
              />
            </div>
          </div>

          {/* 输出面板 */}
          <div className="jf-panel">
            <div className="jf-panel-header">
              <div className="jf-panel-title">
                {viewMode === 'editor' ? <Code size={14} /> : <TreePine size={14} />}
                <span>{viewMode === 'editor' ? '输出' : '树形视图'}</span>
                {viewMode === 'editor' && <kbd>Ctrl+F 顶部搜索</kbd>}
              </div>
              <div className="jf-panel-actions">
                <button
                  className={`jf-icon-btn ${copied ? 'success' : ''}`}
                  onClick={handleCopy}
                  disabled={!output}
                  title="复制全部"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  className={`jf-panel-action-btn ${sidePanel === 'node' ? 'active' : ''}`}
                  onClick={() => setSidePanel(sidePanel === 'node' ? null : 'node')}
                  title="节点详情"
                >
                  Inspector
                </button>
                <button
                  className={`jf-panel-action-btn ${sidePanel === 'types' ? 'active' : ''}`}
                  onClick={() => setSidePanel(sidePanel === 'types' ? null : 'types')}
                  title="TypeScript 类型"
                >
                  TypeScript
                </button>
              </div>
            </div>
            <div
              className="jf-editor-area"
              ref={rightPanelRef}
            >
              {viewMode === 'editor' ? (
                <CodeMirror
                  value={output}
                  readOnly
                  extensions={editorExtensions}
                  placeholder="格式化结果..."
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: false,
                    bracketMatching: true
                  }}
                />
              ) : (
                <div className="jf-tree-area">
                  {jsonData !== null ? (
                    <>
                      <div className="jf-tree-toolbar">
                        <span className="jf-tree-toolbar-title">结构摘要</span>
                        <span>{treeSummary?.objects ?? 0} objects</span>
                        <span>{treeSummary?.arrays ?? 0} arrays</span>
                        <span>{treeSummary?.primitives ?? 0} values</span>
                      </div>
                      <div className="jf-tree">
                        <JsonTreeNode
                          key={`${expandDepth}-${searchQuery}-${forcedPath}`}
                          label="$"
                          path="$"
                          value={jsonData}
                          depth={0}
                          expandDepth={expandDepth}
                          matchedPaths={visiblePaths}
                          activePath={forcedPath || activeMatch?.path || selectedNode?.path || ''}
                          onSelect={handleSelectNode}
                          onContextMenu={handleTreeContextMenu}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="jf-empty">
                      <Braces size={28} strokeWidth={1.5} />
                      <p>{error ? 'JSON 格式错误' : '等待输入...'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
            </div>
          </div>

          {sidePanel && (
            <aside className="jf-inspector">
              <div className="jf-inspector-header">
                <span>{sidePanel === 'node' ? 'Inspector' : 'TypeScript'}</span>
                <button className="jf-mini-btn" onClick={() => setSidePanel(null)}>关闭</button>
              </div>

              {sidePanel === 'node' && (
                <section className="jf-tool-card jf-node-card">
              <div className="jf-tool-card-head">
                <Route size={14} />
                <span>当前节点</span>
                {selectedNode && <strong>{selectedNode.type}</strong>}
              </div>
              {selectedNode ? (
                <>
                  <code className="jf-node-path">{selectedNode.path}</code>
                  <div className="jf-node-meta">
                    <span>{selectedNode.meta}</span>
                    <span>{getNodeValuePreview(selectedNode.value).length.toLocaleString()} chars</span>
                  </div>
                  <pre className="jf-node-preview">{getNodeValuePreview(selectedNode.value)}</pre>
                  <div className="jf-node-actions">
                    <button className="jf-mini-btn" onClick={() => handleCopyText(selectedNode.path, 'path')}>复制 path</button>
                    <button className="jf-mini-btn" onClick={() => handleCopyText(getNodeValuePreview(selectedNode.value), 'node')}>复制 value</button>
                  </div>
                </>
              ) : (
                <p className="jf-inspector-empty">点击树节点后，这里显示 path、类型、子项数量和值预览。</p>
              )}
                </section>
              )}

              {sidePanel === 'types' && (
                <section className="jf-tool-card jf-types-card">
              <div className="jf-tool-card-head">
                <FileType2 size={14} />
                <span>TypeScript</span>
              </div>
              <div className="jf-node-actions">
                <button className="jf-mini-btn" onClick={handleGenerateTypes} disabled={jsonData === null}>生成类型</button>
                <button className="jf-mini-btn" onClick={() => handleCopyText(generatedTypes, 'types')} disabled={!generatedTypes}>复制</button>
              </div>
              {generatedTypes ? <pre className="jf-types-preview">{generatedTypes}</pre> : <p className="jf-inspector-empty">从当前 JSON 生成 interface。生成结果会完整显示在这里，不再挤成小条。</p>}
                </section>
              )}
            </aside>
          )}
        </div>

      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="jf-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="jf-context-header">
            <span className="jf-context-label">{contextMenu.key || '(root)'}</span>
          </div>

          <div className="jf-context-divider" />

          <button className="jf-context-item" onClick={handleCopyValue}>
            <CopyPlus size={14} />
            <span>复制值</span>
            <code className="jf-context-preview">
              {contextMenu.value.length > 25
                ? contextMenu.value.slice(0, 25) + '...'
                : contextMenu.value}
            </code>
          </button>

          {contextMenu.key && (
            <button className="jf-context-item" onClick={handleCopyKey}>
              <Key size={14} />
              <span>复制键名</span>
              <code className="jf-context-preview">{contextMenu.key}</code>
            </button>
          )}

          {contextMenu.path && (
            <>
              <button className="jf-context-item" onClick={handleCopyPath}>
                <Route size={14} />
                <span>复制路径</span>
                <code className="jf-context-preview">{contextMenu.path}</code>
              </button>

              <button className="jf-context-item" onClick={handleCopyJsonPath}>
                <BracesIcon size={14} />
                <span>复制 JSONPath</span>
                <code className="jf-context-preview">{contextMenu.path}</code>
              </button>
            </>
          )}
        </div>
      )}

      {/* Toast */}
      {copiedItem && (
        <div className="jf-toast">
          <Check size={14} />
          <span>
            {copiedItem === 'value' && '已复制值'}
            {copiedItem === 'key' && '已复制键名'}
            {copiedItem === 'path' && '已复制路径'}
            {copiedItem === 'jsonpath' && '已复制 JSONPath'}
            {copiedItem === 'query' && '已复制查询结果'}
            {copiedItem === 'types' && '已复制 TypeScript 类型'}
            {copiedItem === 'repair' && '已尝试修复 JSON'}
            {copiedItem === 'node' && '已复制节点值'}
          </span>
        </div>
      )}
    </div>
  )
}
