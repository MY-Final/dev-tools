import { Copy, Check, Eye, EyeOff, Plus, Wand2, Key } from 'lucide-react'
import {
  useJWTGenerator,
  type Algorithm,
  type Expiration,
  type RoleTemplate
} from '@renderer/tools/jwt-generator/useJWTGenerator'

const ALGORITHMS: Algorithm[] = ['HS256', 'HS384', 'HS512']

const EXPIRATIONS: { value: Expiration; label: string }[] = [
  { value: '15m', label: '15 分钟' },
  { value: '1h', label: '1 小时' },
  { value: '12h', label: '12 小时' },
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' }
]

const CLAIMS = [
  { id: 'sub' as const, label: 'sub' },
  { id: 'exp' as const, label: 'exp' },
  { id: 'iat' as const, label: 'iat' },
  { id: 'aud' as const, label: 'aud' },
  { id: 'iss' as const, label: 'iss' },
  { id: 'jti' as const, label: 'jti' }
]

const ROLE_TEMPLATES: {
  id: RoleTemplate
  label: string
}[] = [
  { id: 'admin', label: 'Admin' },
  { id: 'user', label: 'User' },
  { id: 'guest', label: 'Guest' }
]

const PAYLOAD_TEMPLATES = [
  { id: 'user-login' as const, label: 'User Login' },
  { id: 'admin-login' as const, label: 'Admin Login' },
  { id: 'api-access' as const, label: 'API Access' }
]

export default function JWTGenerator(): React.JSX.Element {
  const {
    headerJson,
    setHeaderJson,
    payloadJson,
    setPayloadJson,
    secret,
    setSecret,
    showSecret,
    setShowSecret,
    algorithm,
    expiration,
    jwt,
    jwtParts,
    toast,
    headerError,
    payloadError,
    updateAlgorithm,
    updateExpiration,
    addClaim,
    applyRoleTemplate,
    applyPayloadTemplate,
    generateRandomPayload,
    generateRandomSecret,
    copyJWT
  } = useJWTGenerator()

  return (
    <div className="jwt-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">JWT Generator</h2>
          <p className="tool-page-desc">
            编辑 Header 与 Payload，实时生成并解析 HS256/384/512 签名的 JSON Web Token。
          </p>
        </div>
        <div className="tool-page-actions">
          <button
            type="button"
            className="tool-btn tool-btn--primary"
            onClick={copyJWT}
            disabled={!jwt}
          >
            {toast ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {toast || '复制 JWT'}
          </button>
        </div>
      </header>

      <section className="tool-panel jwt-toolbar">
        <div className="jwt-toolbar-row">
          <div className="jwt-toolbar-group">
            <span className="jwt-field-label">算法</span>
            <div className="tool-segmented" role="group" aria-label="签名算法">
              {ALGORITHMS.map((alg) => (
                <button
                  key={alg}
                  type="button"
                  className={`tool-seg ${algorithm === alg ? 'active' : ''}`}
                  onClick={() => updateAlgorithm(alg)}
                  aria-pressed={algorithm === alg}
                >
                  {alg}
                </button>
              ))}
            </div>
          </div>
          <div className="jwt-toolbar-group">
            <label className="jwt-field-label" htmlFor="jwt-expiration">
              过期时间
            </label>
            <select
              id="jwt-expiration"
              className="tool-select"
              value={expiration}
              onChange={(e) => updateExpiration(e.target.value as Expiration)}
            >
              {EXPIRATIONS.map((exp) => (
                <option key={exp.value} value={exp.value}>
                  {exp.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="tool-split tool-split--even jwt-layout">
        <div className="jwt-config">
          <section className="tool-panel jwt-editor jwt-editor--header">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">Header</h3>
              {headerError && (
                <span className="jwt-inline-error" role="status">
                  {headerError}
                </span>
              )}
            </div>
            <textarea
              className={`jwt-textarea ${headerError ? 'error' : ''}`}
              value={headerJson}
              onChange={(e) => setHeaderJson(e.target.value)}
              rows={4}
              spellCheck={false}
              aria-label="JWT Header JSON"
            />
          </section>

          <section className="tool-panel jwt-editor jwt-editor--payload">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">Payload</h3>
              {payloadError && (
                <span className="jwt-inline-error" role="status">
                  {payloadError}
                </span>
              )}
            </div>
            <textarea
              className={`jwt-textarea ${payloadError ? 'error' : ''}`}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              rows={9}
              spellCheck={false}
              aria-label="JWT Payload JSON"
            />

            <div className="jwt-quick">
              <div className="jwt-quick-row">
                <span className="jwt-field-label">快捷 Claim</span>
                <div className="jwt-chips">
                  {CLAIMS.map((claim) => (
                    <button
                      key={claim.id}
                      type="button"
                      className="jwt-chip"
                      onClick={() => addClaim(claim.id)}
                    >
                      <Plus size={10} aria-hidden="true" />
                      {claim.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="jwt-quick-row">
                <span className="jwt-field-label">模板</span>
                <div className="jwt-chips">
                  {PAYLOAD_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="jwt-chip"
                      onClick={() => applyPayloadTemplate(tpl.id)}
                    >
                      {tpl.label}
                    </button>
                  ))}
                  <button type="button" className="jwt-chip" onClick={generateRandomPayload}>
                    <Wand2 size={11} aria-hidden="true" />
                    随机
                  </button>
                </div>
              </div>

              <div className="jwt-quick-row">
                <span className="jwt-field-label">角色</span>
                <div className="jwt-chips">
                  {ROLE_TEMPLATES.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className="jwt-chip"
                      onClick={() => applyRoleTemplate(role.id)}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="tool-panel jwt-secret">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">签名密钥</h3>
              <div className="jwt-secret-actions">
                <button
                  type="button"
                  className="tool-icon-btn"
                  onClick={() => generateRandomSecret(32)}
                  title="生成 32 位密钥"
                  aria-label="生成随机密钥"
                >
                  <Key size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="tool-icon-btn"
                  onClick={() => setShowSecret(!showSecret)}
                  title={showSecret ? '隐藏密钥' : '显示密钥'}
                  aria-label={showSecret ? '隐藏密钥' : '显示密钥'}
                >
                  {showSecret ? (
                    <EyeOff size={14} aria-hidden="true" />
                  ) : (
                    <Eye size={14} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div className="jwt-secret-body">
              <input
                className="tool-input tool-input--mono jwt-secret-input"
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="输入 HMAC 密钥"
                aria-label="HMAC 签名密钥"
                spellCheck={false}
              />
              <span className="jwt-secret-hint">HS256 密钥长度建议不少于 32 字节</span>
            </div>
          </section>
        </div>

        <div className="jwt-output">
          <section className="tool-panel jwt-token">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">JWT Token</h3>
              <button type="button" className="tool-btn" onClick={copyJWT} disabled={!jwt}>
                {toast ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {toast || '复制'}
              </button>
            </div>
            {jwt ? (
              <pre className="jwt-token-text">{jwt}</pre>
            ) : (
              <div className="jwt-empty">
                {headerError || payloadError
                  ? '修正 JSON 语法后自动生成 Token。'
                  : '编辑左侧内容后自动生成 Token。'}
              </div>
            )}
          </section>

          {jwtParts && (
            <section className="tool-panel jwt-preview">
              <div className="tool-panel-head">
                <h3 className="tool-panel-title">解析预览</h3>
              </div>
              <div className="jwt-preview-body">
                <div className="jwt-preview-block">
                  <span className="jwt-preview-label">Header</span>
                  <pre className="jwt-preview-code">{jwtParts.header}</pre>
                </div>
                <div className="jwt-preview-block">
                  <span className="jwt-preview-label">Payload</span>
                  <pre className="jwt-preview-code">{jwtParts.payload}</pre>
                </div>
                <div className="jwt-preview-block">
                  <span className="jwt-preview-label">Signature</span>
                  <pre className="jwt-preview-code jwt-preview-signature">{jwtParts.signature}</pre>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {toast && (
        <div className="jwt-toast" role="status">
          <Check size={14} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
