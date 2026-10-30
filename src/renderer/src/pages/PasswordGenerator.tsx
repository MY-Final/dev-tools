import { useState, useCallback, useMemo } from 'react'
import { Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react'
import CopyToast from '@renderer/components/CopyToast'
import { copyText } from '@renderer/lib/clipboard'
import { randomInt } from '../lib/crypto-utils'

interface PasswordConfig {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeSimilar: boolean
}

const SIMILAR_CHARS = '0O1lI5S8B'

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
}

type CharSetKey = keyof typeof CHAR_SETS

const CHAR_SET_KEYS: CharSetKey[] = ['uppercase', 'lowercase', 'numbers', 'symbols']

function stripSimilar(value: string): string {
  let result = value
  for (const char of SIMILAR_CHARS) result = result.replaceAll(char, '')
  return result
}

/** 实际参与随机的字符集（排除易混淆字符后），熵值也必须按它计算。 */
function getPool(config: PasswordConfig, key: CharSetKey): string {
  return config.excludeSimilar ? stripSimilar(CHAR_SETS[key]) : CHAR_SETS[key]
}

function generatePassword(config: PasswordConfig): string {
  const selectedKeys = CHAR_SET_KEYS.filter((key) => config[key])

  if (selectedKeys.length === 0 || config.length < selectedKeys.length) return ''

  const pools = selectedKeys.map((key) => getPool(config, key)).filter(Boolean)
  if (pools.length === 0) return ''

  const chars = pools.join('')
  const result: string[] = pools.map((pool) => pool[randomInt(pool.length)])

  while (result.length < config.length) {
    result.push(chars[randomInt(chars.length)])
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result.join('')
}
function calculateEntropy(password: string, config: PasswordConfig): number {
  if (!password) return 0
  const poolSize = CHAR_SET_KEYS.reduce(
    (sum, key) => (config[key] ? sum + getPool(config, key).length : sum),
    0
  )
  if (poolSize === 0) return 0
  return Math.floor(password.length * Math.log2(poolSize))
}

type Strength = 'weak' | 'medium' | 'strong' | 'very-strong'

function getStrength(entropy: number): { label: string; level: Strength; color: string } {
  if (entropy < 28) return { label: '弱', level: 'weak', color: 'var(--color-danger)' }
  if (entropy < 60) return { label: '中等', level: 'medium', color: 'var(--color-warning)' }
  if (entropy < 120) return { label: '强', level: 'strong', color: 'var(--color-success)' }
  return { label: '非常强', level: 'very-strong', color: 'var(--color-success)' }
}

const WEAK_FRAGMENTS = [
  'password',
  'passw0rd',
  '123456',
  'qwerty',
  'abc123',
  'admin',
  'letmein',
  'welcome',
  'iloveyou',
  '111111',
  '000000'
]

/** 连续 4 位及以上的递增/递减字符（abcdef、1234、9876）。 */
function hasSequentialRun(pwd: string): boolean {
  let run = 1
  let direction = 0
  for (let i = 1; i < pwd.length; i++) {
    const delta = pwd.charCodeAt(i) - pwd.charCodeAt(i - 1)
    if (delta === 1 || delta === -1) {
      if (delta === direction) {
        run += 1
      } else {
        direction = delta
        run = 2
      }
      if (run >= 4) return true
    } else {
      run = 1
      direction = 0
    }
  }
  return false
}

/**
 * 熵值只反映字符集大小，无法体现「password」「123456」这类常见弱口令。
 * 检测到明显模式时单独提示，避免用户把「中等」当成安全。
 */
function detectWeakPattern(pwd: string): string | null {
  const lower = pwd.toLowerCase()
  const fragment = WEAK_FRAGMENTS.find((word) => lower.includes(word))
  if (fragment) return `包含常见弱口令片段「${fragment}」`
  if (pwd.length >= 4 && new Set(pwd).size === 1) return '所有字符都相同'
  if (hasSequentialRun(pwd)) return '包含连续递增 / 递减的字符序列'
  return null
}

function checkPasswordStrength(pwd: string): {
  length: number
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSymbol: boolean
  entropy: number
  uniqueChars: number
  strength: { label: string; level: Strength; color: string }
} {
  const hasUpper = /[A-Z]/.test(pwd)
  const hasLower = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd)

  let poolSize = 0
  if (hasUpper) poolSize += 26
  if (hasLower) poolSize += 26
  if (hasNumber) poolSize += 10
  if (hasSymbol) poolSize += CHAR_SETS.symbols.length
  if (poolSize === 0) poolSize = 1

  const entropy = Math.floor(pwd.length * Math.log2(poolSize))
  const uniqueChars = new Set(pwd).size

  return {
    length: pwd.length,
    hasUpper,
    hasLower,
    hasNumber,
    hasSymbol,
    entropy,
    uniqueChars,
    strength: getStrength(entropy)
  }
}

type TabType = 'generator' | 'checker'

export default function PasswordGenerator(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('generator')
  const [config, setConfig] = useState<PasswordConfig>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: false
  })
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  // Checker state
  const [checkPassword, setCheckPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const password = useMemo(() => generatePassword(config), [config])
  const entropy = useMemo(() => calculateEntropy(password, config), [password, config])
  const strength = useMemo(() => getStrength(entropy), [entropy])

  const checkerResult = useMemo(
    () => (checkPassword ? checkPasswordStrength(checkPassword) : null),
    [checkPassword]
  )

  const weakPattern = useMemo(
    () => (checkPassword ? detectWeakPattern(checkPassword) : null),
    [checkPassword]
  )

  const updateConfig = useCallback(
    <K extends keyof PasswordConfig>(key: K, value: PasswordConfig[K]) => {
      // 密码会随选项重新生成，复制按钮不能还停留在「已复制」。
      setCopied(false)
      setCopyError(false)
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const regenerate = useCallback(() => {
    setCopied(false)
    setCopyError(false)
    setConfig((prev) => ({ ...prev }))
  }, [])

  const copyPassword = useCallback(async () => {
    if (!password) return
    const ok = await copyText(password)
    if (!ok) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 1800)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [password])

  const hasCharType = config.uppercase || config.lowercase || config.numbers || config.symbols

  const strengthBarSegments = 4

  return (
    <div className="pg-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Password Generator</h2>
          <p className="tool-page-desc">生成安全随机密码，或检测已有密码的长度、字符构成与熵值。</p>
        </div>
        <div className="tool-page-actions">
          <div className="tool-segmented">
            <button
              type="button"
              className={`tool-seg ${activeTab === 'generator' ? 'active' : ''}`}
              onClick={() => setActiveTab('generator')}
              aria-pressed={activeTab === 'generator'}
            >
              生成密码
            </button>
            <button
              type="button"
              className={`tool-seg ${activeTab === 'checker' ? 'active' : ''}`}
              onClick={() => setActiveTab('checker')}
              aria-pressed={activeTab === 'checker'}
            >
              检测强度
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'generator' ? (
        <div className="tool-split pg-layout">
          <div className="pg-main">
            <section className="tool-panel pg-output-panel">
              <div className="tool-panel-head">
                <h3 className="tool-panel-title">生成结果</h3>
                <span className="pg-output-length">{password.length} 字符</span>
              </div>

              <div className="pg-password-body">
                <div
                  className={`pg-password-text ${password ? '' : 'is-empty'}`}
                  aria-live="polite"
                >
                  {password || '请至少选择一种字符类型'}
                </div>
                <div className="pg-password-actions">
                  <button
                    type="button"
                    className="tool-btn tool-btn--primary"
                    onClick={copyPassword}
                    disabled={!password}
                  >
                    {copied ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                    {copied ? '已复制' : '复制密码'}
                  </button>
                  <button
                    type="button"
                    className="tool-btn tool-btn--outline"
                    onClick={regenerate}
                    disabled={!password}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    重新生成
                  </button>
                </div>
              </div>

              {password && (
                <div className="pg-strength">
                  <div className="pg-strength-header">
                    <span>密码强度</span>
                    <span className="pg-strength-label" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="pg-strength-bar" aria-hidden="true">
                    {Array.from({ length: strengthBarSegments }).map((_, i) => {
                      const filled =
                        (strength.level === 'weak' && i === 0) ||
                        (strength.level === 'medium' && i <= 1) ||
                        (strength.level === 'strong' && i <= 2) ||
                        strength.level === 'very-strong'
                      return (
                        <div
                          key={i}
                          className={`pg-strength-segment ${filled ? 'filled' : ''}`}
                          style={filled ? { background: strength.color } : undefined}
                        />
                      )
                    })}
                  </div>
                  <div className="pg-strength-info">
                    <span>熵值 {entropy} bits</span>
                    <span>长度 {password.length} 字符</span>
                  </div>
                </div>
              )}
            </section>

            {!hasCharType && <div className="pg-warning">请至少选择一种字符类型</div>}
          </div>

          <section className="tool-panel pg-options-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">生成设置</h3>
            </div>
            <div className="pg-options-body">
              <div className="pg-field">
                <div className="pg-field-head">
                  <span className="pg-field-label">密码长度</span>
                  <span className="pg-length-value">{config.length}</span>
                </div>
                <input
                  type="range"
                  className="pg-slider"
                  min={8}
                  max={128}
                  value={config.length}
                  onChange={(e) => updateConfig('length', Number(e.target.value))}
                  aria-label="密码长度"
                />
                <div className="pg-slider-marks" aria-hidden="true">
                  <span>8</span>
                  <span>32</span>
                  <span>64</span>
                  <span>128</span>
                </div>
              </div>

              <div className="pg-field">
                <span className="pg-field-label">字符类型</span>
                <div className="pg-options">
                  <label className="pg-option">
                    <input
                      type="checkbox"
                      checked={config.uppercase}
                      onChange={(e) => updateConfig('uppercase', e.target.checked)}
                    />
                    <span className="pg-option-text">大写字母</span>
                    <span className="pg-option-hint">A-Z</span>
                  </label>
                  <label className="pg-option">
                    <input
                      type="checkbox"
                      checked={config.lowercase}
                      onChange={(e) => updateConfig('lowercase', e.target.checked)}
                    />
                    <span className="pg-option-text">小写字母</span>
                    <span className="pg-option-hint">a-z</span>
                  </label>
                  <label className="pg-option">
                    <input
                      type="checkbox"
                      checked={config.numbers}
                      onChange={(e) => updateConfig('numbers', e.target.checked)}
                    />
                    <span className="pg-option-text">数字</span>
                    <span className="pg-option-hint">0-9</span>
                  </label>
                  <label className="pg-option">
                    <input
                      type="checkbox"
                      checked={config.symbols}
                      onChange={(e) => updateConfig('symbols', e.target.checked)}
                    />
                    <span className="pg-option-text">特殊字符</span>
                    <span className="pg-option-hint">!@#$%^&amp;*</span>
                  </label>
                </div>
              </div>

              <label className="pg-toggle-option">
                <input
                  type="checkbox"
                  checked={config.excludeSimilar}
                  onChange={(e) => updateConfig('excludeSimilar', e.target.checked)}
                />
                <span className="pg-toggle-content">
                  <span className="pg-toggle-text">排除易混淆字符</span>
                  <span className="pg-toggle-hint">0O 1lI 5S 8B</span>
                </span>
              </label>
            </div>
          </section>
        </div>
      ) : (
        <>
          <section className="tool-panel pg-check-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">检测密码</h3>
            </div>
            <div className="pg-check-body">
              <input
                type={showPassword ? 'text' : 'password'}
                className="pg-checker-input"
                value={checkPassword}
                onChange={(e) => setCheckPassword(e.target.value)}
                placeholder="输入要检测的密码…"
                aria-label="要检测的密码"
                spellCheck={false}
              />
              <button
                type="button"
                className="tool-icon-btn pg-show-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? '隐藏密码' : '显示密码'}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? (
                  <EyeOff size={15} aria-hidden="true" />
                ) : (
                  <Eye size={15} aria-hidden="true" />
                )}
              </button>
            </div>
          </section>

          {weakPattern && (
            <div className="pg-checker-warning" role="status">
              {weakPattern}，实际强度会明显低于熵值估算。
            </div>
          )}

          {checkerResult && (
            <>
              <div className="pg-check-grid">
                <section className="tool-panel pg-sub-panel">
                  <div className="tool-panel-head">
                    <h3 className="tool-panel-title">字符构成</h3>
                  </div>
                  <div className="pg-checker-chars">
                    <span className={`pg-checker-char ${checkerResult.hasUpper ? 'yes' : 'no'}`}>
                      <span>大写字母</span>
                      <span>{checkerResult.hasUpper ? '包含' : '缺少'}</span>
                    </span>
                    <span className={`pg-checker-char ${checkerResult.hasLower ? 'yes' : 'no'}`}>
                      <span>小写字母</span>
                      <span>{checkerResult.hasLower ? '包含' : '缺少'}</span>
                    </span>
                    <span className={`pg-checker-char ${checkerResult.hasNumber ? 'yes' : 'no'}`}>
                      <span>数字</span>
                      <span>{checkerResult.hasNumber ? '包含' : '缺少'}</span>
                    </span>
                    <span className={`pg-checker-char ${checkerResult.hasSymbol ? 'yes' : 'no'}`}>
                      <span>特殊字符</span>
                      <span>{checkerResult.hasSymbol ? '包含' : '缺少'}</span>
                    </span>
                  </div>
                </section>

                <section className="tool-panel pg-sub-panel">
                  <div className="tool-panel-head">
                    <h3 className="tool-panel-title">统计</h3>
                  </div>
                  <div className="pg-checker-stats">
                    <span>
                      <span>长度</span>
                      <span>{checkerResult.length}</span>
                    </span>
                    <span>
                      <span>唯一字符</span>
                      <span>{checkerResult.uniqueChars}</span>
                    </span>
                    <span>
                      <span>熵值</span>
                      <span>{checkerResult.entropy} bits</span>
                    </span>
                  </div>
                  <p className="pg-entropy-note">
                    熵值按检测到的字符类别估算（大写 26 / 小写 26 / 数字 10 / 符号{' '}
                    {CHAR_SETS.symbols.length}），不统计字典词、重复模式与个人信息。
                  </p>
                </section>
              </div>

              <section className="tool-panel pg-strength pg-strength--standalone">
                <div className="pg-strength-header">
                  <span>密码强度</span>
                  <span
                    className="pg-strength-label"
                    style={{ color: checkerResult.strength.color }}
                  >
                    {checkerResult.strength.label}
                  </span>
                </div>
                <div className="pg-strength-bar" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const filled =
                      (checkerResult.strength.level === 'weak' && i === 0) ||
                      (checkerResult.strength.level === 'medium' && i <= 1) ||
                      (checkerResult.strength.level === 'strong' && i <= 2) ||
                      checkerResult.strength.level === 'very-strong'
                    return (
                      <div
                        key={i}
                        className={`pg-strength-segment ${filled ? 'filled' : ''}`}
                        style={filled ? { background: checkerResult.strength.color } : undefined}
                      />
                    )
                  })}
                </div>
              </section>
            </>
          )}

          {!checkPassword && (
            <section className="tool-panel pg-check-empty">
              输入密码后显示字符构成、长度与熵值评估。
            </section>
          )}
        </>
      )}
      <CopyToast message={copyError ? '复制失败，请手动选择' : null} />
    </div>
  )
}
