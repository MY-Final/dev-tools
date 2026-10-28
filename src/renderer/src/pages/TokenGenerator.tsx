import { useState, useMemo } from 'react'
import { Copy, Check, Download, RefreshCw } from 'lucide-react'
import {
  useTokenGenerator,
  type TokenType,
  type RandomStringCharset
} from '@renderer/tools/token-generator/useTokenGenerator'

const TOKEN_TYPES: { id: TokenType; label: string }[] = [
  { id: 'uuid', label: 'UUID' },
  { id: 'jwt', label: 'JWT' },
  { id: 'api-key', label: 'API Key' },
  { id: 'random-string', label: '随机字符串' },
  { id: 'secret-key', label: 'Secret Key' }
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

const COLLAPSED_RESULT_COUNT = 12

export default function TokenGenerator(): React.JSX.Element {
  const [resultsExpanded, setResultsExpanded] = useState(false)
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

  const visibleResults = useMemo(
    () => (resultsExpanded ? results : results.slice(0, COLLAPSED_RESULT_COUNT)),
    [results, resultsExpanded]
  )

  const hiddenResultCount = Math.max(0, results.length - visibleResults.length)

  const renderConfig = (): React.JSX.Element => {
    switch (tokenType) {
      case 'uuid':
        return (
          <div className="tg-section">
            <span className="tg-label" id="tg-count-label">
              生成数量
            </span>
            <div className="tool-segmented" role="group" aria-labelledby="tg-count-label">
              {COUNT_PRESETS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`tool-seg ${config.uuid.count === count ? 'active' : ''}`}
                  onClick={() => updateConfig('uuid', 'count', count)}
                  aria-pressed={config.uuid.count === count}
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
            <div className="tg-section tg-section--stack">
              <label className="tg-label" htmlFor="tg-jwt-header">
                Header
              </label>
              <textarea
                id="tg-jwt-header"
                className="tg-textarea"
                value={config.jwt.header}
                onChange={(e) => updateConfig('jwt', 'header', e.target.value)}
                rows={3}
                spellCheck={false}
              />
            </div>
            <div className="tg-section tg-section--stack">
              <label className="tg-label" htmlFor="tg-jwt-payload">
                Payload
              </label>
              <textarea
                id="tg-jwt-payload"
                className="tg-textarea"
                value={config.jwt.payload}
                onChange={(e) => updateConfig('jwt', 'payload', e.target.value)}
                rows={4}
                spellCheck={false}
              />
            </div>
            <div className="tg-section tg-section--stack">
              <label className="tg-label" htmlFor="tg-jwt-secret">
                Secret
              </label>
              <input
                id="tg-jwt-secret"
                className="tool-input tool-input--mono"
                type="text"
                value={config.jwt.secret}
                onChange={(e) => updateConfig('jwt', 'secret', e.target.value)}
                placeholder="my-secret-key"
                spellCheck={false}
              />
            </div>
            <div className="tg-section">
              <span className="tg-label" id="tg-exp-label">
                过期时间
              </span>
              <div className="tool-segmented" role="group" aria-labelledby="tg-exp-label">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`tool-seg ${config.jwt.expiration === opt.value ? 'active' : ''}`}
                    onClick={() => updateConfig('jwt', 'expiration', opt.value)}
                    aria-pressed={config.jwt.expiration === opt.value}
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
            <div className="tg-section tg-section--stack">
              <span className="tg-label">前缀</span>
              <div className="tool-segmented" role="group" aria-label="API Key 前缀">
                {['pk_live', 'pk_test', 'sk_live', 'sk_test'].map((prefix) => (
                  <button
                    key={prefix}
                    type="button"
                    className={`tool-seg ${config['api-key'].prefix === prefix ? 'active' : ''}`}
                    onClick={() => updateConfig('api-key', 'prefix', prefix)}
                    aria-pressed={config['api-key'].prefix === prefix}
                  >
                    {prefix}
                  </button>
                ))}
              </div>
              <input
                className="tool-input tool-input--mono"
                type="text"
                value={config['api-key'].prefix}
                onChange={(e) => updateConfig('api-key', 'prefix', e.target.value)}
                placeholder="自定义前缀"
                aria-label="API Key 自定义前缀"
                spellCheck={false}
              />
            </div>
            <div className="tg-section">
              <span className="tg-label" id="tg-api-length-label">
                长度
              </span>
              <div className="tool-segmented" role="group" aria-labelledby="tg-api-length-label">
                {LENGTH_PRESETS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`tool-seg ${config['api-key'].length === len ? 'active' : ''}`}
                    onClick={() => updateConfig('api-key', 'length', len)}
                    aria-pressed={config['api-key'].length === len}
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
            <div className="tg-section">
              <span className="tg-label" id="tg-rs-length-label">
                长度
              </span>
              <div className="tool-segmented" role="group" aria-labelledby="tg-rs-length-label">
                {LENGTH_PRESETS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`tool-seg ${config['random-string'].length === len ? 'active' : ''}`}
                    onClick={() => updateConfig('random-string', 'length', len)}
                    aria-pressed={config['random-string'].length === len}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
            <div className="tg-section tg-section--stack">
              <span className="tg-label">字符类型</span>
              <div className="tg-charsets">
                {CHARSET_OPTIONS.map((opt) => {
                  const active = config['random-string'].charset.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`tg-charset ${active ? 'active' : ''}`}
                      onClick={() => {
                        const current = config['random-string'].charset
                        const next = current.includes(opt.id)
                          ? current.filter((c) => c !== opt.id)
                          : [...current, opt.id]
                        if (next.length > 0) {
                          updateConfig('random-string', 'charset', next)
                        }
                      }}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )

      case 'secret-key':
        return (
          <div className="tg-section">
            <span className="tg-label" id="tg-secret-length-label">
              长度
            </span>
            <div className="tool-segmented" role="group" aria-labelledby="tg-secret-length-label">
              {[32, 64, 128, 256].map((len) => (
                <button
                  key={len}
                  type="button"
                  className={`tool-seg ${config['secret-key'].length === len ? 'active' : ''}`}
                  onClick={() => updateConfig('secret-key', 'length', len)}
                  aria-pressed={config['secret-key'].length === len}
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
    <div className="token-generator-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Token Generator</h2>
          <p className="tool-page-desc">
            批量生成 UUID、JWT、API Key、随机字符串与 Secret Key，支持复制和导出。
          </p>
        </div>
      </header>

      <section className="tool-panel tg-typebar">
        <div className="tg-typebar-row">
          <div className="tool-segmented" role="group" aria-label="Token 类型">
            {TOKEN_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`tool-seg ${tokenType === type.id ? 'active' : ''}`}
                onClick={() => setTokenType(type.id)}
                aria-pressed={tokenType === type.id}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="tool-split tool-split--even tg-layout">
        <section className="tool-panel tg-config">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">配置</h3>
            <span className="tg-count-note">
              {results.length > 0 ? `已生成 ${results.length} 条` : '尚未生成'}
            </span>
          </div>
          <div className="tg-config-body">{renderConfig()}</div>
          <div className="tg-actions">
            <button type="button" className="tool-btn tool-btn--primary" onClick={generate}>
              <RefreshCw size={14} aria-hidden="true" />
              生成
            </button>
          </div>
        </section>

        <section className="tool-panel tg-results">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">结果</h3>
            <div className="tg-results-actions">
              <button
                type="button"
                className="tool-btn"
                onClick={handleCopyAll}
                disabled={results.length === 0}
              >
                <Copy size={13} aria-hidden="true" />
                复制全部
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleExport('txt')}
                disabled={results.length === 0}
                title="导出 TXT"
              >
                <Download size={13} aria-hidden="true" />
                TXT
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleExport('json')}
                disabled={results.length === 0}
                title="导出 JSON"
              >
                <Download size={13} aria-hidden="true" />
                JSON
              </button>
            </div>
          </div>

          {results.length > 0 ? (
            <>
              <div className="tg-results-list">
                {visibleResults.map((token, index) => (
                  <div key={index} className="tg-result-item">
                    <code className="tg-result-text" title={token}>
                      {token}
                    </code>
                    <button
                      type="button"
                      className="tool-icon-btn tg-copy-btn"
                      onClick={() => handleCopy(token, index)}
                      title="复制"
                      aria-label={`复制第 ${index + 1} 条结果`}
                    >
                      {copiedIndex === index ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {hiddenResultCount > 0 && (
                <button
                  type="button"
                  className="tg-expand"
                  onClick={() => setResultsExpanded(true)}
                >
                  展开剩余 {hiddenResultCount} 条
                </button>
              )}
              {resultsExpanded && results.length > COLLAPSED_RESULT_COUNT && (
                <button
                  type="button"
                  className="tg-expand"
                  onClick={() => setResultsExpanded(false)}
                >
                  收起结果
                </button>
              )}
            </>
          ) : (
            <div className="tg-empty">选择类型并调整配置，点击「生成」查看结果。</div>
          )}
        </section>
      </div>

      {toast && (
        <div className="tg-toast" role="status">
          <Check size={14} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
