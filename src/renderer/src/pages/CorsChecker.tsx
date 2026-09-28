import { useState, useCallback } from 'react'
import { ShieldOff, Send, AlertTriangle, CheckCircle, Info, Copy, Check } from 'lucide-react'
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
  requestSent: boolean
  conclusion: { type: 'success' | 'warning' | 'error'; message: string }
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
const PREFLIGHT_REQUEST_HEADER_VALUE = 'content-type'

const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-expose-headers',
  'access-control-max-age'
]

function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.includes(method)
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

function pickCorsHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const header of CORS_HEADERS) {
    if (headers[header] !== undefined) result[header] = headers[header]
  }
  return result
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join(String.fromCharCode(10))
}

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
  const [allowMutation, setAllowMutation] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleTest = useCallback(async () => {
    const targetUrl = url.trim()
    if (!targetUrl) return
    const mutationMethod = isMutationMethod(method)
    const preflightOnly = mutationMethod && !allowMutation
    setLoading(true)
    setError('')
    setResult(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      let preflightHeaders: Record<string, string> | null = null
      let preflightStatus: number | null = null
      let preflightError = ''
      const needsPreflightProbe = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'

      if (needsPreflightProbe) {
        try {
          const preflightRes = await fetch(targetUrl, {
            method: 'OPTIONS',
            mode: 'cors',
            signal: controller.signal,
            headers: {
              'Access-Control-Request-Method': method,
              'Access-Control-Request-Headers': PREFLIGHT_REQUEST_HEADER_VALUE
            }
          })
          preflightStatus = preflightRes.status
          preflightHeaders = headersToRecord(preflightRes.headers)
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err
          preflightError = (err as Error).message || '预检请求失败'
        }
      }

      if (preflightOnly) {
        const safeHeaders = preflightHeaders ?? {}
        const baseConclusion = analyzeCorsHeaders(safeHeaders, preflightHeaders)
        const conclusion = preflightHeaders
          ? {
              ...baseConclusion,
              message: `${baseConclusion.message}；未发送实际 ${method} 请求。`
            }
          : {
              type: 'warning' as const,
              message: preflightError
                ? `仅执行 OPTIONS 安全检查：${preflightError}；未发送实际 ${method} 请求。`
                : `仅执行 OPTIONS 安全检查，未发送实际 ${method} 请求。`
            }
        setResult({
          url: targetUrl,
          method,
          status: preflightStatus ?? 0,
          statusText: '未发送实际请求',
          corsHeaders: pickCorsHeaders(safeHeaders),
          allHeaders: formatHeaders(safeHeaders),
          preflight: needsPreflightProbe,
          preflightHeaders,
          preflightStatus,
          requestSent: false,
          conclusion
        })
        return
      }

      const res = await fetch(targetUrl, {
        method,
        mode: 'cors',
        signal: controller.signal,
        headers: mutationMethod ? { 'Content-Type': 'application/json' } : undefined
      })
      const rawHeaders = headersToRecord(res.headers)

      setResult({
        url: targetUrl,
        method,
        status: res.status,
        statusText: res.statusText,
        corsHeaders: pickCorsHeaders(rawHeaders),
        allHeaders: formatHeaders(rawHeaders),
        preflight: preflightHeaders !== null,
        preflightHeaders,
        preflightStatus,
        requestSent: true,
        conclusion: analyzeCorsHeaders(rawHeaders, preflightHeaders)
      })
    } catch (err) {
      const msg = (err as Error).name === 'AbortError'
        ? '请求超时 (15s)'
        : `请求失败: ${(err as Error).message}`
      setError(msg)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [url, method, allowMutation])

  const copyResult = useCallback(() => {
    if (!result) return
    const text = `URL: ${result.url}\nMethod: ${result.method}\nStatus: ${result.status}\n实际请求: ${result.requestSent ? '已发送' : '未发送'}\n\nCORS Headers:\n${Object.entries(result.corsHeaders).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n\n${result.conclusion.message}`
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
    <div className="cc-page" aria-busy={loading}>
      {/* Input */}
      <div className="cc-input-row">
        <input
          className="cc-url-input"
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setAllowMutation(false)
          }}
          placeholder="https://api.example.com/data"
          aria-label="要检查的 URL"
        />
        <select
          className="cc-method-select"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value)
            setAllowMutation(false)
          }}
          aria-label="请求方法"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button className="cc-btn cc-btn-test" onClick={handleTest} disabled={loading}>
          {loading
            ? '测试中...'
            : <><Send size={14} /> {isMutationMethod(method) && !allowMutation ? '仅安全检查' : '测试'}</>}
        </button>
      </div>

      {loading && (
        <div className="cc-empty-hint" role="status" aria-live="polite">
          正在执行 CORS 检查…
        </div>
      )}

      {isMutationMethod(method) && (
        <label className="cc-empty-hint">
          <input
            type="checkbox"
            checked={allowMutation}
            onChange={(e) => setAllowMutation(e.target.checked)}
            disabled={loading}
          />{' '}
          我确认发送实际 {method} 请求，可能修改目标数据
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="cc-error" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="cc-result" aria-live="polite">
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
            <div className="cc-summary-item">
              <span className="cc-summary-label">实际请求</span>
              <span className="cc-summary-value">{result.requestSent ? '已发送' : '未发送'}</span>
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
          <span className="cc-empty-hint">
            GET/HEAD 会发送实际请求；POST/PUT/PATCH/DELETE 默认只执行 OPTIONS 安全检查
          </span>
        </div>
      )}
    </div>
  )
}
