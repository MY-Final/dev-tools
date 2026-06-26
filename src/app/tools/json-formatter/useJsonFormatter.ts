import { useState, useCallback, useMemo } from 'react'
import stringify from 'json-stringify-pretty-compact'

export type ViewMode = 'editor' | 'tree'
export type Indent = 2 | 4 | 6 | 8

export interface JsonError {
  message: string
  line?: number
  column?: number
}

const SAMPLE_JSON = `{
  "name": "dev-tools",
  "version": "1.0.0",
  "description": "A developer tools collection",
  "main": "index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "jest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "electron": "^39.0.0"
  },
  "keywords": ["electron", "react", "typescript"]
}`

function parseJson(input: string): { data: unknown; error: JsonError | null } {
  if (!input.trim()) {
    return { data: null, error: null }
  }

  try {
    const data = JSON.parse(input)
    return { data, error: null }
  } catch (e) {
    const err = e as Error
    const match = err.message.match(/position\s+(\d+)/)
    let line: number | undefined
    let column: number | undefined

    if (match) {
      const pos = parseInt(match[1])
      const lines = input.substring(0, pos).split('\n')
      line = lines.length
      column = lines[lines.length - 1].length + 1
    }

    return {
      data: null,
      error: {
        message: err.message,
        line,
        column
      }
    }
  }
}

export function formatJson(input: string, indent: Indent): string {
  const { data, error } = parseJson(input)
  if (error || data === null) {
    return input
  }
  return stringify(data, { indent })
}

export function minifyJson(input: string): string {
  const { data, error } = parseJson(input)
  if (error || data === null) {
    return input
  }
  return JSON.stringify(data)
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
    }
    return sorted
  }
  return obj
}

export function sortJsonKeys(input: string, indent: Indent): string {
  const { data, error } = parseJson(input)
  if (error || data === null) return input
  return stringify(sortObjectKeys(data), { indent })
}

export function validateJson(input: string): JsonError | null {
  if (!input.trim()) {
    return null
  }
  const { error } = parseJson(input)
  return error
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useJsonFormatter() {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState<Indent>(2)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  const error = useMemo(() => validateJson(input), [input])

  const output = useMemo(() => {
    if (error || !input.trim()) {
      return ''
    }
    return formatJson(input, indent)
  }, [input, indent, error])

  const parsedData = useMemo(() => {
    if (error || !input.trim()) {
      return null
    }
    const { data } = parseJson(input)
    return data
  }, [input, error])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  const handleFormat = useCallback(() => {
    if (error) {
      showToast('JSON 格式错误，无法格式化')
      return
    }
    if (!input.trim()) {
      showToast('请输入 JSON 数据')
      return
    }
    setInput(output)
    showToast('格式化成功')
  }, [input, output, error, showToast])

  const handleMinify = useCallback(() => {
    if (error) {
      showToast('JSON 格式错误，无法压缩')
      return
    }
    if (!input.trim()) {
      showToast('请输入 JSON 数据')
      return
    }
    setInput(minifyJson(input))
    showToast('压缩成功')
  }, [input, error, showToast])

  const handleSortKeys = useCallback(() => {
    if (error) {
      showToast('JSON 格式错误，无法排序')
      return
    }
    if (!input.trim()) {
      showToast('请输入 JSON 数据')
      return
    }
    setInput(sortJsonKeys(input, indent))
    showToast('键名已按字母排序')
  }, [input, indent, error, showToast])

  const handleCopy = useCallback(() => {
    const textToCopy = output || input
    if (!textToCopy.trim()) {
      showToast('没有可复制的内容')
      return
    }
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    showToast('已复制到剪贴板')
    setTimeout(() => setCopied(false), 1500)
  }, [input, output, showToast])

  const handleClear = useCallback(() => {
    setInput('')
    showToast('已清空')
  }, [showToast])

  const handleLoadSample = useCallback(() => {
    setInput(SAMPLE_JSON)
    showToast('已加载示例数据')
  }, [showToast])

  const handleIndentChange = useCallback((newIndent: Indent) => {
    setIndent(newIndent)
  }, [])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [])

  return {
    input,
    setInput,
    output,
    error,
    indent,
    viewMode,
    toast,
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
  }
}
