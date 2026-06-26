import { useState, useCallback, useMemo } from 'react'
import { Copy, Check, RefreshCw, Shield, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'

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

function generatePassword(config: PasswordConfig): string {
  let chars = ''
  if (config.uppercase) chars += CHAR_SETS.uppercase
  if (config.lowercase) chars += CHAR_SETS.lowercase
  if (config.numbers) chars += CHAR_SETS.numbers
  if (config.symbols) chars += CHAR_SETS.symbols

  if (config.excludeSimilar) {
    for (const c of SIMILAR_CHARS) {
      chars = chars.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
    }
  }

  if (!chars) return ''

  const array = new Uint32Array(config.length)
  crypto.getRandomValues(array)
  return Array.from(array, (v) => chars[v % chars.length]).join('')
}

function calculateEntropy(password: string, config: PasswordConfig): number {
  let poolSize = 0
  if (config.uppercase) poolSize += 26
  if (config.lowercase) poolSize += 26
  if (config.numbers) poolSize += 10
  if (config.symbols) poolSize += CHAR_SETS.symbols.length
  if (poolSize === 0) return 0
  return Math.floor(password.length * Math.log2(poolSize))
}

type Strength = 'weak' | 'medium' | 'strong' | 'very-strong'

function getStrength(entropy: number): { label: string; level: Strength; color: string } {
  if (entropy < 28) return { label: '弱', level: 'weak', color: 'var(--color-danger)' }
  if (entropy < 60) return { label: '中等', level: 'medium', color: 'var(--color-warning)' }
  if (entropy < 120) return { label: '强', level: 'strong', color: 'var(--color-success)' }
  return { label: '非常强', level: 'very-strong', color: 'var(--color-accent-soft)' }
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
  if (hasSymbol) poolSize += 32
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

  const updateConfig = useCallback(
    <K extends keyof PasswordConfig>(key: K, value: PasswordConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const regenerate = useCallback(() => {
    setConfig((prev) => ({ ...prev }))
  }, [])

  const copyPassword = useCallback(async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback
    }
  }, [password])

  const hasCharType = config.uppercase || config.lowercase || config.numbers || config.symbols

  const strengthBarSegments = 4

  return (
    <div className="pg-page">
      <div className="pg-card">
        <div className="pg-header">
          <h2 className="pg-title">Password Generator</h2>
          <p className="pg-subtitle">生成高强度安全随机密码 & 检测密码强度</p>
        </div>

        <div className="mvn-tabs">
          <button
            className={`mvn-tab ${activeTab === 'generator' ? 'active' : ''}`}
            onClick={() => setActiveTab('generator')}
          >
            生成密码
          </button>
          <button
            className={`mvn-tab ${activeTab === 'checker' ? 'active' : ''}`}
            onClick={() => setActiveTab('checker')}
          >
            检测强度
          </button>
        </div>

        {activeTab === 'generator' ? (
          <>
            <div className="pg-password-area">
              <div className="pg-password-display">
                <Lock size={16} className="pg-password-icon" />
                <div className="pg-password-text">{password || '请选择至少一种字符类型'}</div>
              </div>
              <div className="pg-password-actions">
                <button className="pg-action-btn" onClick={copyPassword} disabled={!password}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? '已复制' : '复制'}
                </button>
                <button className="pg-action-btn" onClick={regenerate} disabled={!password}>
                  <RefreshCw size={15} />
                  重新生成
                </button>
              </div>
            </div>

            <div className="pg-section">
              <div className="pg-section-header">
                <span className="pg-section-label">密码长度</span>
                <span className="pg-length-value">{config.length}</span>
              </div>
              <div className="pg-slider-wrapper">
                <input
                  type="range"
                  className="pg-slider"
                  min={8}
                  max={128}
                  value={config.length}
                  onChange={(e) => updateConfig('length', Number(e.target.value))}
                />
                <div className="pg-slider-marks">
                  <span>8</span>
                  <span>32</span>
                  <span>64</span>
                  <span>128</span>
                </div>
              </div>
            </div>

            <div className="pg-section">
              <span className="pg-section-label">字符类型</span>
              <div className="pg-options">
                <label className="pg-option">
                  <input
                    type="checkbox"
                    checked={config.uppercase}
                    onChange={(e) => updateConfig('uppercase', e.target.checked)}
                  />
                  <span className="pg-checkbox" />
                  <span className="pg-option-text">大写字母</span>
                  <span className="pg-option-hint">A-Z</span>
                </label>
                <label className="pg-option">
                  <input
                    type="checkbox"
                    checked={config.lowercase}
                    onChange={(e) => updateConfig('lowercase', e.target.checked)}
                  />
                  <span className="pg-checkbox" />
                  <span className="pg-option-text">小写字母</span>
                  <span className="pg-option-hint">a-z</span>
                </label>
                <label className="pg-option">
                  <input
                    type="checkbox"
                    checked={config.numbers}
                    onChange={(e) => updateConfig('numbers', e.target.checked)}
                  />
                  <span className="pg-checkbox" />
                  <span className="pg-option-text">数字</span>
                  <span className="pg-option-hint">0-9</span>
                </label>
                <label className="pg-option">
                  <input
                    type="checkbox"
                    checked={config.symbols}
                    onChange={(e) => updateConfig('symbols', e.target.checked)}
                  />
                  <span className="pg-checkbox" />
                  <span className="pg-option-text">特殊字符</span>
                  <span className="pg-option-hint">!@#$%^&amp;*</span>
                </label>
              </div>
            </div>

            <div className="pg-section">
              <label className="pg-toggle-option">
                <input
                  type="checkbox"
                  checked={config.excludeSimilar}
                  onChange={(e) => updateConfig('excludeSimilar', e.target.checked)}
                />
                <span className="pg-toggle" />
                <div className="pg-toggle-content">
                  <span className="pg-toggle-text">排除易混淆字符</span>
                  <span className="pg-toggle-hint">0O 1lI 5S 8B</span>
                </div>
              </label>
            </div>

            {password && (
              <div className="pg-strength">
                <div className="pg-strength-header">
                  <Shield size={14} />
                  <span>密码强度</span>
                  <span className="pg-strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
                <div className="pg-strength-bar">
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
                  <span>熵值: {entropy} bits</span>
                  <span>长度: {password.length} 字符</span>
                </div>
              </div>
            )}

            {!hasCharType && <div className="pg-warning">请至少选择一种字符类型</div>}
          </>
        ) : (
          // Checker Tab
          <>
            <div className="pg-password-area">
              <div className="pg-password-display">
                <KeyRound size={16} className="pg-password-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="pg-checker-input"
                  value={checkPassword}
                  onChange={(e) => setCheckPassword(e.target.value)}
                  placeholder="输入要检测的密码..."
                />
                <button
                  className="pg-show-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? '隐藏' : '显示'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {checkerResult && (
              <>
                <div className="pg-section">
                  <span className="pg-section-label">字符构成</span>
                  <div className="pg-checker-chars">
                    <span className={`pg-checker-char ${checkerResult.hasUpper ? 'yes' : 'no'}`}>
                      {checkerResult.hasUpper ? '✓' : '✗'} 大写字母
                    </span>
                    <span className={`pg-checker-char ${checkerResult.hasLower ? 'yes' : 'no'}`}>
                      {checkerResult.hasLower ? '✓' : '✗'} 小写字母
                    </span>
                    <span className={`pg-checker-char ${checkerResult.hasNumber ? 'yes' : 'no'}`}>
                      {checkerResult.hasNumber ? '✓' : '✗'} 数字
                    </span>
                    <span className={`pg-checker-char ${checkerResult.hasSymbol ? 'yes' : 'no'}`}>
                      {checkerResult.hasSymbol ? '✓' : '✗'} 特殊字符
                    </span>
                  </div>
                </div>

                <div className="pg-section">
                  <span className="pg-section-label">统计</span>
                  <div className="pg-checker-stats">
                    <span>长度: {checkerResult.length}</span>
                    <span>唯一字符: {checkerResult.uniqueChars}</span>
                    <span>熵值: {checkerResult.entropy} bits</span>
                  </div>
                </div>

                <div className="pg-strength">
                  <div className="pg-strength-header">
                    <Shield size={14} />
                    <span>密码强度</span>
                    <span
                      className="pg-strength-label"
                      style={{ color: checkerResult.strength.color }}
                    >
                      {checkerResult.strength.label}
                    </span>
                  </div>
                  <div className="pg-strength-bar">
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
                </div>
              </>
            )}

            {checkPassword && !checkerResult && <div className="pg-warning">无法分析空密码</div>}
          </>
        )}
      </div>
    </div>
  )
}
