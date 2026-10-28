import { useState, useCallback, useMemo } from 'react'
import { Copy, Check, RotateCcw, AlertTriangle, Clock } from 'lucide-react'

interface JWTHeader {
  alg: string
  typ?: string
  kid?: string
  [key: string]: unknown
}

interface JWTPayload {
  sub?: string
  iss?: string
  aud?: string
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  [key: string]: unknown
}

interface DecodedJWT {
  header: JWTHeader
  payload: JWTPayload
  signature: string
  raw: {
    header: string
    payload: string
    signature: string
  }
}

type TokenStatus = 'valid' | 'expired' | 'invalid' | 'empty'

const EXAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDAwMSIsIm5hbWUiOiJKb2huIERvZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcxMDAwMDAwMCwiZXhwIjoxNzEwMDAzNjAwLCJpc3MiOiJkZXYtdG9vbHMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const TIME_CLAIMS = ['exp', 'nbf', 'iat', 'auth_time', 'updated_at']

const CLAIM_DESCRIPTIONS: Record<string, string> = {
  sub: 'Subject（主题）',
  iss: 'Issuer（签发者）',
  aud: 'Audience（受众）',
  exp: 'Expiration Time（过期时间）',
  nbf: 'Not Before（生效时间）',
  iat: 'Issued At（签发时间）',
  jti: 'JWT ID（唯一标识）'
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad) base64 += '='.repeat(4 - pad)
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  )
}

function decodeJWT(token: string): DecodedJWT | null {
  const cleaned = token.trim().replace(/\s/g, '')
  const parts = cleaned.split('.')
  if (parts.length !== 3) return null

  try {
    const header = JSON.parse(base64UrlDecode(parts[0])) as JWTHeader
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JWTPayload
    return {
      header,
      payload,
      signature: parts[2],
      raw: {
        header: base64UrlDecode(parts[0]),
        payload: base64UrlDecode(parts[1]),
        signature: parts[2]
      }
    }
  } catch {
    return null
  }
}

function getStatus(decoded: DecodedJWT | null, token: string): TokenStatus {
  if (!token.trim()) return 'empty'
  if (!decoded) return 'invalid'
  if (decoded.payload.exp && Date.now() / 1000 > decoded.payload.exp) return 'expired'
  return 'valid'
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getRemainingTime(exp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = exp - now
  const isExpired = diff < 0
  const absDiff = Math.abs(diff)

  const days = Math.floor(absDiff / 86400)
  const hours = Math.floor((absDiff % 86400) / 3600)
  const minutes = Math.floor((absDiff % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days} 天`)
  if (hours > 0) parts.push(`${hours} 小时`)
  if (minutes > 0 && days === 0) parts.push(`${minutes} 分钟`)
  if (parts.length === 0) parts.push('不到 1 分钟')

  return isExpired ? `已过期 ${parts.join(' ')}` : `剩余 ${parts.join(' ')}`
}

export default function JWTDecoder(): React.JSX.Element {
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const decoded = useMemo(() => decodeJWT(token), [token])
  const status = useMemo(() => getStatus(decoded, token), [decoded, token])

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const clear = useCallback(() => {
    setToken('')
  }, [])

  const loadExample = useCallback(() => {
    setToken(EXAMPLE_JWT)
  }, [])

  const timeClaims = decoded ? TIME_CLAIMS.filter((claim) => decoded.payload[claim]) : []

  return (
    <div className="jd-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">JWT Decoder</h2>
          <p className="tool-page-desc">
            粘贴 Token 即可解析 Header 与 Payload，检查签名算法、有效期和声明。
          </p>
        </div>
        <div className="tool-page-actions">
          <button type="button" className="tool-btn tool-btn--outline" onClick={loadExample}>
            加载示例
          </button>
          <button type="button" className="tool-btn tool-btn--outline" onClick={clear}>
            <RotateCcw size={14} aria-hidden="true" />
            清空
          </button>
        </div>
      </header>

      <section className="tool-panel jd-input">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">JWT Token</h3>
          {status !== 'empty' && (
            <span className={`jd-status jd-status--${status}`} role="status" aria-live="polite">
              {status === 'valid' && '有效'}
              {status === 'expired' && <Clock size={12} aria-hidden="true" />}
              {status === 'expired' && '已过期'}
              {status === 'invalid' && <AlertTriangle size={12} aria-hidden="true" />}
              {status === 'invalid' && '格式无效'}
              {decoded?.payload.exp && (status === 'valid' || status === 'expired') && (
                <span className="jd-status-extra">
                  {getRemainingTime(decoded.payload.exp).replace(/^(已过期|剩余) /, '')}
                </span>
              )}
            </span>
          )}
        </div>
        <textarea
          className="jd-textarea"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="粘贴 JWT Token…"
          rows={3}
          spellCheck={false}
          aria-label="JWT Token"
        />
        {status === 'invalid' && (
          <p className="jd-error">
            <AlertTriangle size={13} aria-hidden="true" />
            JWT 应包含三个由点分隔的 Base64URL 编码部分。
          </p>
        )}
      </section>

      {decoded && status !== 'invalid' ? (
        <>
          <div className="tool-split tool-split--even jd-results">
            <section className="tool-panel jd-section">
              <div className="tool-panel-head">
                <h3 className="tool-panel-title">Header</h3>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => copyText(decoded.raw.header, 'header')}
                >
                  {copied === 'header' ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copied === 'header' ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="jd-json">{JSON.stringify(decoded.header, null, 2)}</pre>
              <div className="jd-meta">
                <span className="jd-meta-item">
                  <span className="jd-meta-label">算法</span>
                  <span className="jd-meta-value">{decoded.header.alg}</span>
                </span>
                {decoded.header.typ && (
                  <span className="jd-meta-item">
                    <span className="jd-meta-label">类型</span>
                    <span className="jd-meta-value">{decoded.header.typ}</span>
                  </span>
                )}
                {decoded.header.kid && (
                  <span className="jd-meta-item">
                    <span className="jd-meta-label">Kid</span>
                    <span className="jd-meta-value">{decoded.header.kid}</span>
                  </span>
                )}
              </div>
            </section>

            <section className="tool-panel jd-section">
              <div className="tool-panel-head">
                <h3 className="tool-panel-title">Payload</h3>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => copyText(decoded.raw.payload, 'payload')}
                >
                  {copied === 'payload' ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copied === 'payload' ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="jd-json">{JSON.stringify(decoded.payload, null, 2)}</pre>
            </section>
          </div>

          <section className="tool-panel jd-details">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">时间信息</h3>
              <span className="jd-details-note">
                {decoded.raw.header.length} + {decoded.raw.payload.length} 字节 · 签名{' '}
                {decoded.signature.length} 字符
              </span>
            </div>
            {timeClaims.length > 0 ? (
              <div className="tool-rows">
                {timeClaims.map((claim) => (
                  <div key={claim} className="tool-row jd-time-row">
                    <div className="tool-row-meta">
                      <code className="jd-time-claim">{claim}</code>
                      <span className="tool-row-hint">{CLAIM_DESCRIPTIONS[claim] || claim}</span>
                    </div>
                    <span className="jd-time-human">
                      {formatTimestamp(decoded.payload[claim] as number)}
                    </span>
                    <span className="jd-time-ts">{String(decoded.payload[claim])}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="jd-empty-row">Payload 中没有时间声明（exp / iat / nbf）。</div>
            )}
          </section>

          <section className="tool-panel jd-signature">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">Signature</h3>
              <button
                type="button"
                className="tool-btn"
                onClick={() => copyText(decoded.signature, 'signature')}
                disabled={!decoded.signature}
              >
                {copied === 'signature' ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied === 'signature' ? '已复制' : '复制'}
              </button>
            </div>
            <p className="jd-signature-text">{decoded.signature || 'Token 不含签名部分。'}</p>
            <p className="jd-signature-note">仅解码展示，未验证签名有效性。</p>
          </section>
        </>
      ) : (
        status === 'empty' && (
          <div className="jd-placeholder">粘贴 Token 后将自动解析，无需点击按钮。</div>
        )
      )}
    </div>
  )
}
