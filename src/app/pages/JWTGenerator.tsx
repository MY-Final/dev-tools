import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Shield,
  User,
  Users,
  Wand2,
  Key,
  Clock
} from 'lucide-react'
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
  icon: React.ComponentType<{ size?: number }>
}[] = [
  { id: 'admin', label: 'Admin', icon: Shield },
  { id: 'user', label: 'User', icon: User },
  { id: 'guest', label: 'Guest', icon: Users }
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
    <div className="jwt-page">
      <div className="jwt-bg-decoration" />

      <div className="jwt-container">
        <div className="jwt-header">
          <h2 className="jwt-title">JWT Generator</h2>
          <p className="jwt-subtitle">快速生成和调试 JSON Web Token</p>
        </div>

        <div className="jwt-content">
          {/* 左侧配置 */}
          <div className="jwt-config-panel">
            {/* 算法选择 */}
            <div className="jwt-section">
              <div className="jwt-section-header">
                <span className="jwt-section-label">算法</span>
              </div>
              <div className="jwt-algorithms">
                {ALGORITHMS.map((alg) => (
                  <button
                    key={alg}
                    className={`jwt-alg-btn ${algorithm === alg ? 'active' : ''}`}
                    onClick={() => updateAlgorithm(alg)}
                  >
                    {alg}
                  </button>
                ))}
              </div>
            </div>

            {/* Header */}
            <div className="jwt-section">
              <div className="jwt-section-header">
                <span className="jwt-section-label">Header</span>
                {headerError && <span className="jwt-error">{headerError}</span>}
              </div>
              <textarea
                className={`jwt-textarea ${headerError ? 'error' : ''}`}
                value={headerJson}
                onChange={(e) => setHeaderJson(e.target.value)}
                rows={4}
                spellCheck={false}
              />
            </div>

            {/* Payload */}
            <div className="jwt-section">
              <div className="jwt-section-header">
                <span className="jwt-section-label">Payload</span>
                {payloadError && <span className="jwt-error">{payloadError}</span>}
              </div>
              <textarea
                className={`jwt-textarea ${payloadError ? 'error' : ''}`}
                value={payloadJson}
                onChange={(e) => setPayloadJson(e.target.value)}
                rows={8}
                spellCheck={false}
              />

              {/* 快捷 Claim */}
              <div className="jwt-claims">
                <span className="jwt-claims-label">快捷添加:</span>
                {CLAIMS.map((claim) => (
                  <button
                    key={claim.id}
                    className="jwt-claim-btn"
                    onClick={() => addClaim(claim.id)}
                  >
                    <Plus size={10} />
                    {claim.label}
                  </button>
                ))}
              </div>

              {/* 角色模板 */}
              <div className="jwt-templates">
                <span className="jwt-templates-label">角色:</span>
                {ROLE_TEMPLATES.map((role) => {
                  const Icon = role.icon
                  return (
                    <button
                      key={role.id}
                      className="jwt-template-btn"
                      onClick={() => applyRoleTemplate(role.id)}
                    >
                      <Icon size={12} />
                      {role.label}
                    </button>
                  )
                })}
              </div>

              {/* Payload 模板 */}
              <div className="jwt-templates">
                <span className="jwt-templates-label">模板:</span>
                {PAYLOAD_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="jwt-template-btn"
                    onClick={() => applyPayloadTemplate(tpl.id)}
                  >
                    {tpl.label}
                  </button>
                ))}
                <button className="jwt-template-btn jwt-random-btn" onClick={generateRandomPayload}>
                  <Wand2 size={12} />
                  随机生成
                </button>
              </div>

              {/* 过期时间 */}
              <div className="jwt-expiration">
                <div className="jwt-expiration-label">
                  <Clock size={14} />
                  <span>过期时间</span>
                </div>
                <div className="jwt-expiration-options">
                  {EXPIRATIONS.map((exp) => (
                    <button
                      key={exp.value}
                      className={`jwt-exp-btn ${expiration === exp.value ? 'active' : ''}`}
                      onClick={() => updateExpiration(exp.value)}
                    >
                      {exp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Secret */}
            <div className="jwt-section">
              <div className="jwt-section-header">
                <span className="jwt-section-label">Secret</span>
                <div className="jwt-secret-actions">
                  <button
                    className="jwt-icon-btn"
                    onClick={() => generateRandomSecret(32)}
                    title="生成 32 位 Secret"
                  >
                    <Key size={14} />
                  </button>
                  <button
                    className="jwt-icon-btn"
                    onClick={() => setShowSecret(!showSecret)}
                    title={showSecret ? '隐藏' : '显示'}
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="jwt-secret-input-wrapper">
                <input
                  className="jwt-input"
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter secret key"
                />
              </div>
            </div>
          </div>

          {/* 右侧结果 */}
          <div className="jwt-result-panel">
            {/* JWT Token */}
            <div className="jwt-token-section">
              <div className="jwt-token-header">
                <span className="jwt-token-label">JWT Token</span>
                <button className="jwt-copy-btn" onClick={copyJWT} disabled={!jwt}>
                  {toast ? <Check size={14} /> : <Copy size={14} />}
                  {toast || '复制 JWT'}
                </button>
              </div>
              <div className="jwt-token-content">
                {jwt ? (
                  <code className="jwt-token-text">{jwt}</code>
                ) : (
                  <div className="jwt-token-placeholder">配置左侧参数后自动生成 JWT</div>
                )}
              </div>
            </div>

            {/* JWT 预览 */}
            {jwtParts && (
              <div className="jwt-preview">
                <div className="jwt-preview-header">
                  <span className="jwt-preview-label">JWT 解析预览</span>
                </div>

                <div className="jwt-preview-sections">
                  <div className="jwt-preview-section">
                    <div className="jwt-preview-section-header">
                      <span className="jwt-preview-dot header" />
                      <span>Header</span>
                    </div>
                    <pre className="jwt-preview-code">{jwtParts.header}</pre>
                  </div>

                  <div className="jwt-preview-section">
                    <div className="jwt-preview-section-header">
                      <span className="jwt-preview-dot payload" />
                      <span>Payload</span>
                    </div>
                    <pre className="jwt-preview-code">{jwtParts.payload}</pre>
                  </div>

                  <div className="jwt-preview-section">
                    <div className="jwt-preview-section-header">
                      <span className="jwt-preview-dot signature" />
                      <span>Signature</span>
                    </div>
                    <pre className="jwt-preview-code signature">{jwtParts.signature}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="jwt-toast">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
