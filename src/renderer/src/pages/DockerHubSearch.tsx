import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Star, Download, Copy, Check, Terminal, Tag, ChevronDown, ChevronRight } from 'lucide-react'
import '../styles/dockerhub-search.css'

const REQUEST_TIMEOUT_MS = 15000

function createNamedError(name: 'AbortError' | 'TimeoutError'): Error {
  const error = new Error(name)
  error.name = name
  return error
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError'
}

function withRequestTimeout<T>(promise: Promise<T>, controller: AbortController): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(createNamedError('TimeoutError'))
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    const handleAbort = (): void => {
      clearTimeout(timeout)
      reject(createNamedError('AbortError'))
    }

    controller.signal.addEventListener('abort', handleAbort, { once: true })
    promise.then(
      (value) => {
        clearTimeout(timeout)
        controller.signal.removeEventListener('abort', handleAbort)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        controller.signal.removeEventListener('abort', handleAbort)
        reject(error)
      }
    )
  })
}

interface DockerSearchResult {
  name: string
  description: string
  stars: number
  pulls: number
  isOfficial: boolean
  isAutomated: boolean
  imageName: string
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export default function DockerHubSearch(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DockerSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [expandedImg, setExpandedImg] = useState('')
  const [tags, setTags] = useState<{ name: string; digest: string; digestShort: string; size: number; arch: string; os: string; lastUpdated: string }[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagsError, setTagsError] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)
  const tagsRequestRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const tagsAbortRef = useRef<AbortController | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      searchAbortRef.current?.abort()
      searchAbortRef.current = null
      searchRequestRef.current += 1
      setResults([])
      setError('')
      setLoading(false)
      return
    }
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    const requestId = ++searchRequestRef.current
    setResults([])
    setLoading(true)
    setError('')
    try {
      const res = await withRequestTimeout(window.docker.search(q, 20), controller)
      if (requestId !== searchRequestRef.current || controller.signal.aborted) return
      setResults(res)
    } catch (error) {
      if (isTimeoutError(error)) {
        if (requestId === searchRequestRef.current) setError('搜索超时 — Docker Hub 在 15 秒内没有响应')
        return
      }
      if (controller.signal.aborted || requestId !== searchRequestRef.current) return
      setError('搜索失败 — 网络请求失败，请稍后重试')
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false)
        if (searchAbortRef.current === controller) searchAbortRef.current = null
      }
    }
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    searchRequestRef.current += 1
    searchAbortRef.current?.abort()
    searchAbortRef.current = null
    tagsRequestRef.current += 1
    tagsAbortRef.current?.abort()
    tagsAbortRef.current = null
    setQuery(value)
    setResults([])
    setError('')
    setExpandedImg('')
    setTags([])
    setTagsError('')
    setTagsLoading(false)
    if (!value.trim()) {
      setLoading(false)
      return
    }
    setLoading(true)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) return
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  useEffect(() => () => {
    searchAbortRef.current?.abort()
    tagsAbortRef.current?.abort()
  }, [])

  const copyCmd = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }, [])

  const toggleTags = useCallback(async (imageName: string) => {
    if (expandedImg === imageName) {
      tagsAbortRef.current?.abort()
      tagsAbortRef.current = null
      tagsRequestRef.current += 1
      setExpandedImg('')
      setTags([])
      setTagsError('')
      setTagsLoading(false)
      return
    }
    tagsAbortRef.current?.abort()
    const controller = new AbortController()
    tagsAbortRef.current = controller
    const requestId = ++tagsRequestRef.current
    setExpandedImg(imageName)
    setVisibleCount(10)
    setTags([])
    setTagsError('')
    setTagsLoading(true)
    try {
      const res = await withRequestTimeout(window.docker.getTags(imageName), controller)
      if (requestId !== tagsRequestRef.current || controller.signal.aborted) return
      setTags(res || [])
    } catch (error) {
      if (isTimeoutError(error)) {
        if (requestId === tagsRequestRef.current) setTagsError('标签加载超时，请稍后重试')
        return
      }
      if (controller.signal.aborted || requestId !== tagsRequestRef.current) return
      setTagsError('标签加载失败，请稍后重试')
    } finally {
      if (requestId === tagsRequestRef.current) {
        setTagsLoading(false)
        if (tagsAbortRef.current === controller) tagsAbortRef.current = null
      }
    }
  }, [expandedImg])

  const formatSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '-'
    if (bytes >= 1_000_000_000) return (bytes / 1_000_000_000).toFixed(1) + ' GB'
    if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB'
    if (bytes >= 1_000) return (bytes / 1_000).toFixed(1) + ' KB'
    return bytes + ' B'
  }, [])

  return (
    <div className="dh-page">
      <div className="dh-card" aria-busy={loading || tagsLoading}>
        <div className="dh-header">
          <h2 className="dh-title">Docker Hub Search</h2>
          <p className="dh-subtitle">搜索 Docker Hub 镜像，一键复制拉取命令</p>
        </div>

        <div className="dh-search-area">
          <Search size={16} className="dh-search-icon" />
          <input
            className="dh-search-input"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (debounceRef.current) clearTimeout(debounceRef.current)
                void doSearch(query)
              }
            }}
            placeholder="搜索 Docker 镜像..."
            aria-label="搜索 Docker 镜像"
          />
          {loading && <Terminal size={16} className="dh-spin" />}
        </div>

        {loading && (
          <div className="dh-empty" role="status" aria-live="polite">
            {results.length > 0 ? '正在刷新搜索结果…' : '正在搜索…'}
          </div>
        )}

        {error && <div className="dh-error" role="alert">{error}</div>}

        {!loading && query.trim() && results.length === 0 && !error && (
          <div className="dh-empty">未找到匹配的镜像</div>
        )}

        {!loading && !query.trim() && results.length === 0 && !error && (
          <div className="dh-empty">输入关键词搜索 Docker 镜像</div>
        )}

        <div className="dh-results" aria-busy={loading}>
          {results.map((img) => (
            <div key={img.name} className="dh-item">
              <div className="dh-item-header">
                <div className="dh-item-name">
                  <span>{img.imageName}</span>
                  {img.isOfficial && <span className="dh-badge">Official</span>}
                </div>
              </div>
              <div className="dh-item-desc">{img.description || '暂无描述'}</div>
              <div className="dh-item-meta">
                <span><Star size={12} /> {formatCount(img.stars)}</span>
                <span><Download size={12} /> {formatCount(img.pulls)}</span>
              </div>
              <div className="dh-item-cmd">
                <code>docker pull {img.imageName}</code>
                <button className="dh-copy-btn" onClick={() => copyCmd('docker pull ' + img.imageName)}>
                  {copied === 'docker pull ' + img.imageName ? <Check size={12} /> : <Copy size={12} />}
                  {copied === 'docker pull ' + img.imageName ? '已复制' : '复制'}
                </button>
              </div>
              <button className="dh-tags-toggle" onClick={() => toggleTags(img.imageName)}>
                {expandedImg === img.imageName ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Tag size={12} />
                查看标签
              </button>
              {expandedImg === img.imageName && (
                <div className="dh-tags" aria-busy={tagsLoading}>
                  {tagsLoading ? (
                    <div className="dh-tags-loading" role="status" aria-live="polite">加载中...</div>
                  ) : tagsError ? (
                    <div className="dh-tags-loading" role="alert">{tagsError}</div>
                  ) : tags.length === 0 ? (
                    <div className="dh-tags-loading">暂无标签</div>
                  ) : (
                    <>
                      {tags.slice(0, visibleCount).map((t) => (
                        <div key={t.name} className="dh-tag-item">
                          <div className="dh-tag-name">{t.name}</div>
                          <div className="dh-tag-meta">
                            <span className="dh-tag-digest" title={t.digest}>sha256:{t.digestShort}...</span>
                            <span>{t.arch}/{t.os}</span>
                            <span>{formatSize(t.size)}</span>
                            {t.lastUpdated && <span>{new Date(t.lastUpdated).toLocaleDateString('zh-CN')}</span>}
                          </div>
                          <button className="dh-copy-btn" onClick={() => copyCmd('docker pull ' + img.imageName + ':' + t.name)}>
                            {copied === 'docker pull ' + img.imageName + ':' + t.name ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      ))}
                      {visibleCount < tags.length && (
                        <button className="dh-show-more" onClick={() => setVisibleCount((c) => c + 10)}>
                          显示更多 ({tags.length - visibleCount} 剩余)
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
