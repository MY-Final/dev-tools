import { useState, useCallback, useMemo } from 'react'
import { Copy, Check, RotateCcw, AlertTriangle, Clock } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText as writeClipboard } from '@renderer/lib/clipboard'

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

type TokenStatus = 'valid' | 'expired' | 'notYetValid' | 'invalid' | 'empty'

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

/** 只有数字才算 NumericDate；exp=0、字符串或 null 都不能直接拿来做比较。 */
function readNumericDate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getStatus(decoded: DecodedJWT | null, token: string): TokenStatus {
  if (!token.trim()) return 'empty'
  if (!decoded) return 'invalid'
  const now = Math.floor(Date.now() / 1000)
  // RFC 7519：当前时间不早于 exp 即视为过期；过期优先于 nbf 判断。
  const exp = readNumericDate(decoded.payload.exp)
  if (exp !== null && now >= exp) return 'expired'
  const nbf = readNumericDate(decoded.payload.nbf)
  if (nbf !== null && now < nbf) return 'notYetValid'
  return 'valid'
}

/** 时间声明存在但不是数字时明确提示，避免把字符串 exp 当成“未过期”。 */
function getClaimIssues(decoded: DecodedJWT): string[] {
  return (['exp', 'nbf', 'iat'] as const).flatMap((claim) => {
    const raw = decoded.payload[claim]
    if (raw === undefined || readNumericDate(raw) !== null) return []
    return [`${claim} 的值不是数字时间戳（NumericDate），已忽略该声明的时间判断`]
  })
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

function getCountdown(target: number): string {
  const diff = target - Math.floor(Date.now() / 1000)
  const absDiff = Math.abs(diff)
  const days = Math.floor(absDiff / 86400)
  const hours = Math.floor((absDiff % 86400) / 3600)
  const minutes = Math.floor((absDiff % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days} 天`)
  if (hours > 0) parts.push(`${hours} 小时`)
  if (minutes > 0 && days === 0) parts.push(`${minutes} 分钟`)
  if (parts.length === 0) parts.push('不到 1 分钟')
  return `${parts.join(' ')}后生效`
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export default function JWTDecoder(): React.JSX.Element {
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const decoded = useMemo(() => decodeJWT(token), [token])
  const status = useMemo(() => getStatus(decoded, token), [decoded, token])

  const copyText = useCallback(async (text: string, key: string) => {
    const ok = await writeClipboard(text)
    if (!ok) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const clear = useCallback(() => {
    setToken('')
  }, [])

  const loadExample = useCallback(() => {
    setToken(EXAMPLE_JWT)
  }, [])

  const timeClaims = decoded
    ? TIME_CLAIMS.filter((claim) => decoded.payload[claim] !== undefined)
    : []
  const expTime = decoded ? readNumericDate(decoded.payload.exp) : null
  const nbfTime = decoded ? readNumericDate(decoded.payload.nbf) : null
  const claimIssues = useMemo(() => (decoded ? getClaimIssues(decoded) : []), [decoded])

  const alg = decoded?.header.alg
  const algWarning =
    decoded && (typeof alg !== 'string' || !alg.trim() || alg.toLowerCase() === 'none')
      ? alg === 'none'
        ? 'alg 为 none：该 Token 未签名，任何人都可以伪造，请勿信任。'
        : 'Header 未声明 alg：无法确定签名算法，请勿信任该 Token。'
      : null

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
              {status === 'valid' &&
                (expTime !== null
                  ? '未过期'
                  : decoded?.payload.exp !== undefined
                    ? 'exp 无效'
                    : '无 exp 声明')}
              {status === 'valid' && expTime !== null && (
                <span className="jd-status-extra">
                  {getRemainingTime(expTime).replace(/^剩余 /, '')}
                </span>
              )}
              {status === 'expired' && <Clock size={12} aria-hidden="true" />}
              {status === 'expired' && '已过期'}
              {status === 'expired' && expTime !== null && (
                <span className="jd-status-extra">
                  {getRemainingTime(expTime).replace(/^已过期 /, '')}
                </span>
              )}
              {status === 'notYetValid' && <Clock size={12} aria-hidden="true" />}
              {status === 'notYetValid' && '未生效'}
              {status === 'notYetValid' && nbfTime !== null && (
                <span className="jd-status-extra">{getCountdown(nbfTime)}</span>
              )}
              {status === 'invalid' && <AlertTriangle size={12} aria-hidden="true" />}
              {status === 'invalid' && '格式无效'}
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
            无法解析 Token：请确认它由两个点分为三部分，且 Header / Payload 是有效的 Base64URL
            编码 JSON。
          </p>
        )}
        {decoded && (algWarning || claimIssues.length > 0) && (
          <div className="jd-warnings">
            {algWarning && (
              <p className="jd-warning" role="alert">
                <AlertTriangle size={13} aria-hidden="true" />
                {algWarning}
              </p>
            )}
            {claimIssues.map((issue) => (
              <p key={issue} className="jd-warning" role="status">
                <AlertTriangle size={13} aria-hidden="true" />
                {issue}
              </p>
            ))}
          </div>
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
                  <span className={`jd-meta-value${alg ? '' : ' jd-meta-value--missing'}`}>
                    {alg || '未声明'}
                  </span>
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
                {byteLength(decoded.raw.header)} + {byteLength(decoded.raw.payload)} 字节 · 签名{' '}
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
                    {readNumericDate(decoded.payload[claim]) !== null ? (
                      <span className="jd-time-human">
                        {formatTimestamp(decoded.payload[claim] as number)}
                      </span>
                    ) : (
                      <span className="jd-time-invalid">不是有效的 NumericDate</span>
                    )}
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
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
