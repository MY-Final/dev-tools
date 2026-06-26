import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Copy, Check, RefreshCw, Eye, EyeOff, Settings } from 'lucide-react'

// Browser-accessible environment info
function getBrowserEnvVars(): Record<string, string> {
  const nav = navigator
  return {
    'userAgent': nav.userAgent,
    'platform': nav.platform,
    'language': nav.language,
    'languages': nav.languages?.join(', ') || '',
    'cookieEnabled': String(nav.cookieEnabled),
    'online': String(nav.onLine),
    'hardwareConcurrency': String(nav.hardwareConcurrency || 'unknown'),
    'deviceMemory': String((nav as unknown as { deviceMemory?: number }).deviceMemory || 'unknown'),
    'vendor': nav.vendor || '',
    'product': (nav as unknown as { product?: string }).product || '',
    'appVersion': nav.appVersion || '',
    'appName': nav.appName || '',
    'appCodeName': nav.appCodeName || '',
    'doNotTrack': String((nav as unknown as { doNotTrack?: string }).doNotTrack || 'unspecified'),
    'maxTouchPoints': String(nav.maxTouchPoints),
    'referrer': document.referrer || '(direct)'
  }
}

export default function EnvVars(): React.JSX.Element {
  const [vars, setVars] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [maskSensitive, setMaskSensitive] = useState(true)

  useEffect(() => {
    setVars(getBrowserEnvVars())
    setLoading(false)
  }, [])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    // In browser, just re-read browser info
    setVars(getBrowserEnvVars())
    setLoading(false)
  }, [])

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(vars)
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(
      ([key, value]) => key.toLowerCase().includes(q) || value.toLowerCase().includes(q)
    )
  }, [vars, search])

  const totalCount = Object.keys(vars).length

  const isSensitive = useCallback((key: string): boolean => {
    const sensitivePatterns = [
      'SECRET',
      'TOKEN',
      'PASSWORD',
      'API_KEY',
      'APIKEY',
      'ACCESS_KEY',
      'PRIVATE_KEY',
      'AUTH',
      'CREDENTIAL'
    ]
    return sensitivePatterns.some((p) => key.toUpperCase().includes(p))
  }, [])

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="env-vars-page">
      <div className="env-vars-header">
        <div className="env-vars-title-row">
          <h2>环境变量</h2>
          <div className="env-vars-actions">
            <span className="env-vars-count">共 {totalCount} 项</span>
            <button className="env-vars-btn" onClick={handleRefresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              刷新
            </button>
            <button
              className="env-vars-btn"
              onClick={() => setMaskSensitive(!maskSensitive)}
            >
              {maskSensitive ? <EyeOff size={14} /> : <Eye size={14} />}
              {maskSensitive ? '显示敏感值' : '隐藏敏感值'}
            </button>
          </div>
        </div>
        <p className="env-vars-note">
          ⚡ 浏览器环境信息（非系统环境变量）。在浏览器中无法访问系统环境变量。
        </p>
        <div className="env-vars-search-wrapper">
          <Search size={16} className="env-vars-search-icon" />
          <input
            className="env-vars-search"
            type="text"
            placeholder="搜索环境变量..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="env-vars-list">
        {sortedEntries.map(([key, value]) => (
          <div key={key} className="env-vars-item">
            <div className="env-vars-item-header">
              <code className="env-vars-key">{key}</code>
              <button
                className="env-vars-copy-btn"
                onClick={() => handleCopy(value, key)}
                title="复制值"
              >
                {copiedKey === key ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <code className={`env-vars-value ${isSensitive(key) && maskSensitive ? 'masked' : ''}`}>
              {isSensitive(key) && maskSensitive ? '••••••••' : value || <span className="empty">(空)</span>}
            </code>
          </div>
        ))}
        {sortedEntries.length === 0 && (
          <div className="env-vars-empty">未找到匹配的环境变量</div>
        )}
      </div>
    </div>
  )
}

// Initialize window.env
window.env = {
  getEnvVars: async () => getBrowserEnvVars()
}
