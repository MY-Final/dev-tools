import { useState, useCallback } from 'react'
import { ShieldOff, Send, AlertTriangle, CheckCircle, Info, Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/cors-checker.css'

interface CorsResult {
  url: string
  method: string
  status: number
  statusText: string
  corsHeaders: Record<string, string>
  allHeaders: string
  preflight: boolean
  preflightHeaders: Record<string, string> | null
  preflightStatus: number | null
  conclusion: { type: 'success' | 'warning' | 'error'; message: string }
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-expose-headers',
  'access-control-max-age'
]

function analyzeCorsHeaders(headers: Record<string, string>, preflightHeaders: Record<string, string> | null): { type: 'success' | 'warning' | 'error'; message: string } {
  const ao = headers['access-control-allow-origin'] || preflightHeaders?.['access-control-allow-origin']
  if (!ao) {
    return { type: 'error', message: '缺少 Access-Control-Allow-Origin 响应头，浏览器将阻止跨域请求。' }
  }
  if (ao === '*') {
    return { type: 'success', message: '允许所有来源访问（Access-Control-Allow-Origin: *）' }
  }
  return { type: 'success', message: `允许来源: ${ao}` }
}

export default function CorsChecker(): React.JSX.Element {
  const [url, setUrl] = useState('https://api.example.com/data')
  const [method, setMethod] = useState('GET')
  const [result, setResult] = useState<CorsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleTest = useCallback(async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      // Step 1: OPTIONS preflight
      let preflightHeaders: Record<string, string> | null = null
      let preflightStatus: number | null = null

      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        try {
          const preflightRes = await fetch(url.trim(), {
            method: 'OPTIONS',
            mode: 'cors'
          })
          preflightStatus = preflightRes.status
          const ph: Record<string, string> = {}
          preflightRes.headers.forEach((v, k) => { ph[k] = v })
          preflightHeaders = ph
        } catch {
          // Preflight may fail; that's informative too
        }
      }

      // Step 2: Actual request
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url.trim(), {
        method,
        mode: 'cors',
        signal: controller.signal
      })
      clearTimeout(timeout)

      const rawHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { rawHeaders[k] = v })

      const corsHeaders: Record<string, string> = {}
      for (const h of CORS_HEADERS) {
        if (rawHeaders[h] !== undefined) corsHeaders[h] = rawHeaders[h]
      }

      let allHeadersStr = ''
      for (const [k, v] of Object.entries(rawHeaders)) {
        allHeadersStr += `${k}: ${v}\n`
      }

      setResult({
        url: url.trim(),
        method,
        status: res.status,
        statusText: res.statusText,
        corsHeaders,
        allHeaders: allHeadersStr.trim(),
        preflight: preflightHeaders !== null,
        preflightHeaders,
        preflightStatus,
        conclusion: analyzeCorsHeaders(rawHeaders, preflightHeaders)
      })
    } catch (err) {
      const msg = (err as Error).name === 'AbortError'
        ? '请求超时 (15s)'
        : `请求失败: ${(err as Error).message}`
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [url, method])

  const copyResult = useCallback(() => {
    if (!result) return
    const text = `URL: ${result.url}\nMethod: ${result.method}\nStatus: ${result.status}\n\nCORS Headers:\n${Object.entries(result.corsHeaders).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n\n${result.conclusion.message}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [result])

  const conIcon = result?.conclusion.type === 'success'
    ? CheckCircle : result?.conclusion.type === 'warning'
    ? AlertTriangle : Info

  const conColor = result?.conclusion.type === 'success'
    ? 'cc-success' : result?.conclusion.type === 'warning'
    ? 'cc-warning' : 'cc-error'

  return (
    <div className="cc-page">
      {/* Input */}
      <div className="cc-input-row">
        <input
          className="cc-url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/data"
        />
        <select className="cc-method-select" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button className="cc-btn cc-btn-test" onClick={handleTest} disabled={loading}>
          {loading ? '测试中...' : <><Send size={14} /> 测试</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="cc-error">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="cc-result">
          {/* Conclusion */}
          <div className={`cc-conclusion cc-${conColor}`}>
            {conIcon === CheckCircle
              ? <CheckCircle size={16} />
              : conIcon === AlertTriangle
              ? <AlertTriangle size={16} />
              : <Info size={16} />}
            <span>{result.conclusion.message}</span>
            <button className="cc-copy-btn" onClick={copyResult} title="复制结果">
              {copied ? <Check size={12} /> : <Copy size={12} />} 复制
            </button>
          </div>

          {/* Summary */}
          <div className="cc-summary">
            <div className="cc-summary-item">
              <span className="cc-summary-label">请求 URL</span>
              <span className="cc-summary-value">{result.url}</span>
            </div>
            <div className="cc-summary-item">
              <span className="cc-summary-label">请求方法</span>
              <span className="cc-summary-value">{result.method}</span>
            </div>
            <div className="cc-summary-item">
              <span className="cc-summary-label">响应状态</span>
              <span className="cc-summary-value">{result.status} {result.statusText}</span>
            </div>
          </div>

          {/* CORS Headers */}
          <div className="cc-section">
            <div className="cc-section-title">CORS 响应头</div>
            {Object.keys(result.corsHeaders).length === 0 ? (
              <div className="cc-section-empty">未检测到 CORS 相关响应头</div>
            ) : (
              <div className="cc-header-list">
                {Object.entries(result.corsHeaders).map(([key, val]) => (
                  <div key={key} className="cc-header-item">
                    <span className="cc-header-key">{key}:</span>
                    <span className="cc-header-val">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preflight */}
          {result.preflight && result.preflightHeaders && (
            <div className="cc-section">
              <div className="cc-section-title">OPTIONS 预检响应 (Status: {result.preflightStatus})</div>
              <div className="cc-header-list">
                {Object.entries(result.preflightHeaders).map(([key, val]) => (
                  <div key={key} className="cc-header-item">
                    <span className="cc-header-key">{key}:</span>
                    <span className="cc-header-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Headers */}
          <details className="cc-details">
            <summary className="cc-details-summary">全部响应头</summary>
            <pre className="cc-all-headers">{result.allHeaders}</pre>
          </details>
        </div>
      )}

      {!result && !error && (
        <div className="cc-empty">
          <ShieldOff size={32} className="cc-empty-icon" />
          <span className="cc-empty-text">输入 URL 并点击测试开始检查 CORS</span>
          <span className="cc-empty-hint">此工具会发送实际请求到目标服务器，请确保 URL 可访问</span>
        </div>
      )}
    </div>
  )
}
