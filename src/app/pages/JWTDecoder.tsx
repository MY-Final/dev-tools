import { useState, useCallback, useMemo } from 'react'
import {
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Clock,
  FileCode,
  Braces
} from 'lucide-react'

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

  const statusConfig = {
    empty: { icon: null, label: '', color: '' },
    valid: { icon: ShieldCheck, label: '有效', color: 'var(--color-success)' },
    expired: { icon: Clock, label: '已过期', color: 'var(--color-warning)' },
    invalid: { icon: ShieldX, label: '无效', color: 'var(--color-danger)' }
  }

  const currentStatus = statusConfig[status]
  const StatusIcon = currentStatus.icon

  return (
    <div className="jd-page">
      <div className="jd-card">
        <div className="jd-header">
          <h2 className="jd-title">JWT Decoder</h2>
          <p className="jd-subtitle">解析和检查 JWT Token</p>
        </div>

        <div className="jd-input-area">
          <div className="jd-input-header">
            <span className="jd-input-label">JWT Token</span>
            <div className="jd-input-actions">
              <button className="jd-link-btn" onClick={loadExample}>
                加载示例
              </button>
            </div>
          </div>
          <textarea
            className="jd-textarea"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="粘贴 JWT Token..."
            rows={4}
          />
          <div className="jd-input-footer">
            <button className="jd-clear-btn" onClick={clear}>
              <RotateCcw size={13} />
              清空
            </button>
          </div>
        </div>

        {status !== 'empty' && (
          <div className="jd-status" style={{ borderColor: currentStatus.color }}>
            {StatusIcon && <StatusIcon size={18} style={{ color: currentStatus.color }} />}
            <span style={{ color: currentStatus.color, fontWeight: 600 }}>
              {currentStatus.label}
            </span>
            {status === 'valid' && decoded?.payload.exp && (
              <span className="jd-expires">{getRemainingTime(decoded.payload.exp)}</span>
            )}
            {status === 'expired' && decoded?.payload.exp && (
              <span className="jd-expires">{getRemainingTime(decoded.payload.exp)}</span>
            )}
          </div>
        )}

        {status === 'invalid' && token.trim() && (
          <div className="jd-error">
            <AlertTriangle size={14} />
            无效的 JWT 格式。JWT 应包含三个由点分隔的 Base64URL 编码部分。
          </div>
        )}

        {decoded && status !== 'invalid' && (
          <>
            <div className="jd-section">
              <div className="jd-section-header">
                <div className="jd-section-title">
                  <FileCode size={14} />
                  <span>Header</span>
                </div>
                <button
                  className="jd-copy-btn"
                  onClick={() => copyText(decoded.raw.header, 'header')}
                >
                  {copied === 'header' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'header' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="jd-json-block">
                <pre className="jd-json">{JSON.stringify(decoded.header, null, 2)}</pre>
              </div>
              <div className="jd-meta">
                <div className="jd-meta-item">
                  <span className="jd-meta-label">算法</span>
                  <span className="jd-meta-value">{decoded.header.alg}</span>
                </div>
                {decoded.header.typ && (
                  <div className="jd-meta-item">
                    <span className="jd-meta-label">类型</span>
                    <span className="jd-meta-value">{decoded.header.typ}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="jd-section">
              <div className="jd-section-header">
                <div className="jd-section-title">
                  <Braces size={14} />
                  <span>Payload</span>
                </div>
                <button
                  className="jd-copy-btn"
                  onClick={() => copyText(decoded.raw.payload, 'payload')}
                >
                  {copied === 'payload' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'payload' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="jd-json-block">
                <pre className="jd-json">{JSON.stringify(decoded.payload, null, 2)}</pre>
              </div>
            </div>

            <div className="jd-section">
              <span className="jd-section-label">时间信息</span>
              <div className="jd-time-list">
                {TIME_CLAIMS.filter((claim) => decoded.payload[claim]).map((claim) => (
                  <div key={claim} className="jd-time-item">
                    <div className="jd-time-claim">
                      <code>{claim}</code>
                      <span className="jd-time-desc">{CLAIM_DESCRIPTIONS[claim] || claim}</span>
                    </div>
                    <div className="jd-time-value">
                      <span className="jd-time-ts">{String(decoded.payload[claim])}</span>
                      <span className="jd-time-human">
                        {formatTimestamp(decoded.payload[claim] as number)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="jd-section">
              <span className="jd-section-label">Token 信息</span>
              <div className="jd-info-grid">
                <div className="jd-info-item">
                  <span className="jd-info-label">Header</span>
                  <span className="jd-info-value">{decoded.raw.header.length} bytes</span>
                </div>
                <div className="jd-info-item">
                  <span className="jd-info-label">Payload</span>
                  <span className="jd-info-value">{decoded.raw.payload.length} bytes</span>
                </div>
                <div className="jd-info-item">
                  <span className="jd-info-label">Signature</span>
                  <span className="jd-info-value">{decoded.signature.length} chars</span>
                </div>
                <div className="jd-info-item">
                  <span className="jd-info-label">Token</span>
                  <span className="jd-info-value">{token.trim().length} chars</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
