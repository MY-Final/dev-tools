import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Check, Search, ExternalLink, Package, Loader } from 'lucide-react'
import { searchNpm, getNpmPackage, type NpmSearchResult, type NpmPackageDetail } from '@renderer/lib/npm-api'
import '../styles/npm-search.css'

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

export default function NpmSearch(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NpmSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPkg, setSelectedPkg] = useState<NpmPackageDetail | null>(null)
  const [selectedVersion, setSelectedVersion] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)

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
      const res = await withRequestTimeout(searchNpm(q, 20), controller)
      if (requestId !== searchRequestRef.current || controller.signal.aborted) return
      if (res === null) {
        setError('搜索失败 — 无法连接 npm 仓库，请检查网络后重试')
        return
      }
      setResults(res)
    } catch (error) {
      if (isTimeoutError(error)) {
        if (requestId === searchRequestRef.current) setError('搜索超时 — npm 仓库在 15 秒内没有响应')
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
    searchAbortRef.current?.abort()
    searchAbortRef.current = null
    searchRequestRef.current += 1
    detailAbortRef.current?.abort()
    detailAbortRef.current = null
    detailRequestRef.current += 1
    setQuery(value)
    setResults([])
    setError('')
    setSelectedPkg(null)
    setSelectedVersion('')
    setDetailLoading(false)
    setDetailError('')
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
    detailAbortRef.current?.abort()
  }, [])

  const selectPkg = useCallback(async (name: string) => {
    detailAbortRef.current?.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller
    const requestId = ++detailRequestRef.current
    setSelectedPkg(null)
    setSelectedVersion('')
    setDetailError('')
    setDetailLoading(true)
    try {
      const detail = await withRequestTimeout(getNpmPackage(name), controller)
      if (requestId !== detailRequestRef.current || controller.signal.aborted) return
      if (!detail) {
        setDetailError('包详情加载失败，请稍后重试')
        return
      }
      setSelectedPkg(detail)
      setSelectedVersion(detail.versions[0] || '')
    } catch (error) {
      if (isTimeoutError(error)) {
        if (requestId === detailRequestRef.current) setDetailError('包详情加载超时，请稍后重试')
        return
      }
      if (controller.signal.aborted || requestId !== detailRequestRef.current) return
      setDetailError('包详情加载失败，请稍后重试')
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false)
        if (detailAbortRef.current === controller) detailAbortRef.current = null
      }
    }
  }, [])

  const copyDep = useCallback(async (name: string, version: string) => {
    const dep = `"${name}": "^${version}"`
    try {
      await navigator.clipboard.writeText(dep)
      setCopied(`${name}@${version}`)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="npm-page">
      <div className="npm-card" aria-busy={loading || detailLoading}>
        <div className="npm-header">
          <h2 className="npm-title">npm Search</h2>
          <p className="npm-subtitle">搜索 npm 包，一键复制依赖配置</p>
        </div>

        <div className="npm-search-area">
          <Search size={16} className="npm-search-icon" />
          <input
            className="npm-search-input"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (debounceRef.current) clearTimeout(debounceRef.current)
                void doSearch(query)
              }
            }}
            placeholder="搜索 npm 包..."
            aria-label="搜索 npm 包"
          />
          {loading && <Loader size={16} className="npm-spin" />}
        </div>

        {loading && (
          <div className="npm-empty" role="status" aria-live="polite">
            {results.length > 0 ? '正在刷新搜索结果…' : '正在搜索…'}
          </div>
        )}

        {results.length > 0 && (
          <div className="npm-results" aria-busy={loading}>
            {results.map((pkg) => (
              <div
                key={pkg.name}
                className="npm-result-item"
                onClick={() => selectPkg(pkg.name)}
              >
                <div className="npm-result-header">
                  <div className="npm-result-name">
                    <Package size={14} />
                    <span>{pkg.name}</span>
                  </div>
                  <span className="npm-result-ver">v{pkg.version}</span>
                  <button
                    className="npm-copy-btn"
                    onClick={(e) => { e.stopPropagation(); copyDep(pkg.name, pkg.version) }}
                    title="复制依赖"
                  >
                    {copied === `${pkg.name}@${pkg.version}` ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <div className="npm-result-desc">{pkg.description || '暂无描述'}</div>
                <div className="npm-result-meta">
                  {pkg.publisher && <span title="发布者">👤 {pkg.publisher}</span>}
                  {pkg.date && <span title="更新日期">📅 {new Date(pkg.date).toLocaleDateString('zh-CN')}</span>}
                </div>
                {pkg.keywords.length > 0 && (
                  <div className="npm-keywords">
                    {pkg.keywords.slice(0, 5).map((kw) => (
                      <span key={kw} className="npm-keyword">{kw}</span>
                    ))}
                  </div>
                )}
                {selectedPkg && selectedPkg.name === pkg.name && (
                  <div className="npm-detail">
                    <div className="npm-detail-row">
                      <span className="npm-detail-label">版本</span>
                      <select
                        className="npm-version-select"
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedPkg.versions.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <button
                        className="npm-copy-btn"
                        onClick={(e) => { e.stopPropagation(); copyDep(pkg.name, selectedVersion) }}
                      >
                        {copied === `${pkg.name}@${selectedVersion}` ? <Check size={12} /> : <Copy size={12} />}
                        复制
                      </button>
                    </div>
                    {selectedPkg.license && (
                      <div className="npm-detail-row">
                        <span className="npm-detail-label">许可证</span>
                        <span>{selectedPkg.license}</span>
                      </div>
                    )}
                    {selectedPkg.homepage && (
                      <div className="npm-detail-row">
                        <span className="npm-detail-label" />
                        <a className="npm-detail-link" href={selectedPkg.homepage} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} /> 首页
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {detailLoading && (
          <div className="npm-empty" role="status" aria-live="polite">正在加载包详情…</div>
        )}

        {error && <div className="npm-error" role="alert">{error}</div>}
        {detailError && <div className="npm-error" role="alert">{detailError}</div>}

        {!loading && !error && !detailLoading && !detailError && query.trim() && results.length === 0 && (
          <div className="npm-empty" role="status" aria-live="polite">未找到匹配的包</div>
        )}
      </div>
    </div>
  )
}
