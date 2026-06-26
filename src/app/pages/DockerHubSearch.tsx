import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Star, Download, Copy, Check, Terminal, Tag, ChevronDown, ChevronRight } from 'lucide-react'
import '../styles/dockerhub-search.css'

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
  const [visibleCount, setVisibleCount] = useState(10)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setError(''); return }
    setLoading(true); setError('')
    try {
      const res = await window.docker.search(q, 20)
      if (res && res.length > 0) setResults(res)
      else setError('未找到匹配的镜像')
    } catch {
      setError('搜索失败，请检查网络')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const copyCmd = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }, [])

  const toggleTags = useCallback(async (imageName: string) => {
    if (expandedImg === imageName) { setExpandedImg(''); return }
    setExpandedImg(imageName)
    setVisibleCount(10)
    setTagsLoading(true)
    try {
      const res = await window.docker.getTags(imageName)
      setTags(res || [])
    } catch {
      setTags([])
    }
    setTagsLoading(false)
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
      <div className="dh-card">
        <div className="dh-header">
          <h2 className="dh-title">Docker Hub Search</h2>
          <p className="dh-subtitle">搜索 Docker Hub 镜像，一键复制拉取命令</p>
        </div>

        <div className="dh-search-area">
          <Search size={16} className="dh-search-icon" />
          <input
            className="dh-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(query) }}
            placeholder="搜索 Docker 镜像..."
          />
          {loading && <Terminal size={16} className="dh-spin" />}
        </div>

        {error && <div className="dh-error">{error}</div>}

        {!loading && query && results.length === 0 && !error && (
          <div className="dh-empty">输入关键词搜索 Docker 镜像</div>
        )}

        <div className="dh-results">
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
                <div className="dh-tags">
                  {tagsLoading ? (
                    <div className="dh-tags-loading">加载中...</div>
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
