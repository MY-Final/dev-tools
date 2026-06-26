import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, Check, Search, ExternalLink, Package, Loader } from 'lucide-react'
import { searchNpm, getNpmPackage, type NpmSearchResult, type NpmPackageDetail } from '@renderer/lib/npm-api'
import '../styles/npm-search.css'

export default function NpmSearch(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NpmSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPkg, setSelectedPkg] = useState<NpmPackageDetail | null>(null)
  const [selectedVersion, setSelectedVersion] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setError(''); return }
    setLoading(true)
    setError('')
    const res = await searchNpm(q, 20)
    if (res && res.length > 0) {
      setResults(res)
    } else {
      setResults([])
      setError('搜索失败 — 无法连接 npm 仓库，请检查网络或稍后重试')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const selectPkg = useCallback(async (name: string) => {
    setSelectedPkg(null)
    setSelectedVersion('')
    const detail = await getNpmPackage(name)
    if (detail) {
      setSelectedPkg(detail)
      setSelectedVersion(detail.versions[0] || '')
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
      <div className="npm-card">
        <div className="npm-header">
          <h2 className="npm-title">npm Search</h2>
          <p className="npm-subtitle">搜索 npm 包，一键复制依赖配置</p>
        </div>

        <div className="npm-search-area">
          <Search size={16} className="npm-search-icon" />
          <input
            className="npm-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { doSearch(query) } }}
            placeholder="搜索 npm 包..."
          />
          {loading && <Loader size={16} className="npm-spin" />}
        </div>

        {results.length > 0 && (
          <div className="npm-results">
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

        {error && <div className="npm-error">{error}</div>}

        {!loading && !error && query && results.length === 0 && (
          <div className="npm-empty">未找到匹配的包</div>
        )}
      </div>
    </div>
  )
}
