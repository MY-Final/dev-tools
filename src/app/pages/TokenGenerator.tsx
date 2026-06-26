import {
  Key,
  Copy,
  Check,
  Download,
  RefreshCw,
  Hash,
  Shield,
  FileCode,
  Sparkles,
  Settings
} from 'lucide-react'
import {
  useTokenGenerator,
  type TokenType,
  type RandomStringCharset
} from '@renderer/tools/token-generator/useTokenGenerator'

const TOKEN_TYPES: {
  id: TokenType
  label: string
  icon: React.ComponentType<{ size?: number }>
}[] = [
  { id: 'uuid', label: 'UUID', icon: Hash },
  { id: 'jwt', label: 'JWT', icon: FileCode },
  { id: 'api-key', label: 'API Key', icon: Key },
  { id: 'random-string', label: 'Random String', icon: Sparkles },
  { id: 'secret-key', label: 'Secret Key', icon: Shield }
]

const EXPIRATION_OPTIONS = [
  { value: '15m', label: '15 分钟' },
  { value: '1h', label: '1 小时' },
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' }
]

const LENGTH_PRESETS = [8, 16, 32, 64, 128]

const COUNT_PRESETS = [1, 10, 50, 100]

const CHARSET_OPTIONS: { id: RandomStringCharset; label: string }[] = [
  { id: 'uppercase', label: 'A-Z' },
  { id: 'lowercase', label: 'a-z' },
  { id: 'digits', label: '0-9' },
  { id: 'special', label: '!@#$' }
]

export default function TokenGenerator(): React.JSX.Element {
  const {
    tokenType,
    setTokenType,
    config,
    updateConfig,
    results,
    toast,
    copiedIndex,
    generate,
    handleCopy,
    handleCopyAll,
    handleExport
  } = useTokenGenerator()

  const renderConfig = (): React.JSX.Element => {
    switch (tokenType) {
      case 'uuid':
        return (
          <div className="tg-config-section">
            <div className="tg-config-label">生成数量</div>
            <div className="tg-presets">
              {COUNT_PRESETS.map((count) => (
                <button
                  key={count}
                  className={`tg-preset-btn ${config.uuid.count === count ? 'active' : ''}`}
                  onClick={() => updateConfig('uuid', 'count', count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        )

      case 'jwt':
        return (
          <>
            <div className="tg-config-section">
              <div className="tg-config-label">Header</div>
              <textarea
                className="tg-textarea"
                value={config.jwt.header}
                onChange={(e) => updateConfig('jwt', 'header', e.target.value)}
                rows={3}
              />
            </div>
            <div className="tg-config-section">
              <div className="tg-config-label">Payload</div>
              <textarea
                className="tg-textarea"
                value={config.jwt.payload}
                onChange={(e) => updateConfig('jwt', 'payload', e.target.value)}
                rows={4}
              />
            </div>
            <div className="tg-config-section">
              <div className="tg-config-label">Secret</div>
              <input
                className="tg-input"
                type="text"
                value={config.jwt.secret}
                onChange={(e) => updateConfig('jwt', 'secret', e.target.value)}
                placeholder="my-secret-key"
              />
            </div>
            <div className="tg-config-section">
              <div className="tg-config-label">过期时间</div>
              <div className="tg-presets">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`tg-preset-btn ${config.jwt.expiration === opt.value ? 'active' : ''}`}
                    onClick={() => updateConfig('jwt', 'expiration', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )

      case 'api-key':
        return (
          <>
            <div className="tg-config-section">
              <div className="tg-config-label">前缀</div>
              <div className="tg-presets">
                {['pk_live', 'pk_test', 'sk_live', 'sk_test'].map((prefix) => (
                  <button
                    key={prefix}
                    className={`tg-preset-btn ${config['api-key'].prefix === prefix ? 'active' : ''}`}
                    onClick={() => updateConfig('api-key', 'prefix', prefix)}
                  >
                    {prefix}
                  </button>
                ))}
              </div>
              <input
                className="tg-input tg-input-custom"
                type="text"
                value={config['api-key'].prefix}
                onChange={(e) => updateConfig('api-key', 'prefix', e.target.value)}
                placeholder="自定义前缀"
              />
            </div>
            <div className="tg-config-section">
              <div className="tg-config-label">长度</div>
              <div className="tg-presets">
                {LENGTH_PRESETS.map((len) => (
                  <button
                    key={len}
                    className={`tg-preset-btn ${config['api-key'].length === len ? 'active' : ''}`}
                    onClick={() => updateConfig('api-key', 'length', len)}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
          </>
        )

      case 'random-string':
        return (
          <>
            <div className="tg-config-section">
              <div className="tg-config-label">长度</div>
              <div className="tg-presets">
                {LENGTH_PRESETS.map((len) => (
                  <button
                    key={len}
                    className={`tg-preset-btn ${config['random-string'].length === len ? 'active' : ''}`}
                    onClick={() => updateConfig('random-string', 'length', len)}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
            <div className="tg-config-section">
              <div className="tg-config-label">字符类型</div>
              <div className="tg-charset-options">
                {CHARSET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`tg-charset-btn ${config['random-string'].charset.includes(opt.id) ? 'active' : ''}`}
                    onClick={() => {
                      const current = config['random-string'].charset
                      const next = current.includes(opt.id)
                        ? current.filter((c) => c !== opt.id)
                        : [...current, opt.id]
                      if (next.length > 0) {
                        updateConfig('random-string', 'charset', next)
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )

      case 'secret-key':
        return (
          <div className="tg-config-section">
            <div className="tg-config-label">长度</div>
            <div className="tg-presets">
              {[32, 64, 128, 256].map((len) => (
                <button
                  key={len}
                  className={`tg-preset-btn ${config['secret-key'].length === len ? 'active' : ''}`}
                  onClick={() => updateConfig('secret-key', 'length', len)}
                >
                  {len}
                </button>
              ))}
            </div>
          </div>
        )

      default:
        return null as unknown as React.JSX.Element
    }
  }

  return (
    <div className="token-generator-page">
      <div className="tg-bg-decoration" />

      <div className="tg-card">
        <div className="tg-header">
          <h2 className="tg-title">Token Generator</h2>
          <p className="tg-subtitle">生成各种随机标识符、认证 Token 和密钥</p>
        </div>

        <div className="tg-type-selector">
          {TOKEN_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.id}
                className={`tg-type-btn ${tokenType === type.id ? 'active' : ''}`}
                onClick={() => setTokenType(type.id)}
              >
                <Icon size={16} />
                <span>{type.label}</span>
              </button>
            )
          })}
        </div>

        <div className="tg-config">
          <div className="tg-config-header">
            <Settings size={14} className="tg-config-icon" />
            <span>配置选项</span>
          </div>
          {renderConfig()}
        </div>

        <button className="tg-generate-btn" onClick={generate}>
          <RefreshCw size={16} />
          生成
        </button>

        {results.length > 0 && (
          <div className="tg-results">
            <div className="tg-results-header">
              <span className="tg-results-label">生成结果</span>
              <div className="tg-results-actions">
                <button className="tg-action-btn" onClick={handleCopyAll}>
                  <Copy size={14} />
                  复制全部
                </button>
                <button className="tg-action-btn" onClick={() => handleExport('txt')}>
                  <Download size={14} />
                  TXT
                </button>
                <button className="tg-action-btn" onClick={() => handleExport('json')}>
                  <Download size={14} />
                  JSON
                </button>
              </div>
            </div>
            <div className="tg-results-list">
              {results.map((token, index) => (
                <div key={index} className="tg-result-item">
                  <code className="tg-result-text">{token}</code>
                  <button
                    className="tg-copy-btn"
                    onClick={() => handleCopy(token, index)}
                    title="复制"
                  >
                    {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="tg-toast">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
