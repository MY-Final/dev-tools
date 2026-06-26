import { useState, useCallback } from 'react'
import { Languages, ArrowLeftRight, Copy, Check, Trash2, Loader2 } from 'lucide-react'
import { useSettings } from '@renderer/lib/contexts'
import '../styles/translator.css'

interface LangPair {
  code: string
  label: string
}

const LANGUAGES: LangPair[] = [
  { code: 'Chinese', label: '中文' },
  { code: 'English', label: 'English' },
  { code: 'Japanese', label: '日本語' },
  { code: 'Korean', label: '한국어' },
  { code: 'French', label: 'Français' },
  { code: 'German', label: 'Deutsch' },
  { code: 'Spanish', label: 'Español' },
  { code: 'Russian', label: 'Русский' },
  { code: 'Arabic', label: 'العربية' },
  { code: 'Portuguese', label: 'Português' },
  { code: 'Italian', label: 'Italiano' },
  { code: 'Vietnamese', label: 'Tiếng Việt' },
  { code: 'Thai', label: 'ภาษาไทย' },
  { code: 'Dutch', label: 'Nederlands' }
]

export default function Translator(): React.JSX.Element {
  const { settings } = useSettings()
  const [sourceLang, setSourceLang] = useState('Chinese')
  const [targetLang, setTargetLang] = useState('English')
  const [sourceText, setSourceText] = useState('')
  const [result, setResult] = useState('')
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const hasConfig = !!(settings.translator.baseUrl && settings.translator.apiKey && settings.translator.model)

  let configHint = ''
  if (!settings.translator.baseUrl) configHint = '请先在 设置 → AI 翻译 中配置 Base URL、API Key 和 Model'
  else if (!settings.translator.apiKey) configHint = '请先在 设置 → AI 翻译 中配置 API Key'
  else if (!settings.translator.model) configHint = '请先在 设置 → AI 翻译 中配置 Model（可先测试连接获取模型列表）'

  const swap = useCallback(() => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setSourceText(result || sourceText)
    setResult(sourceText)
  }, [sourceLang, targetLang, sourceText, result])

  const translate = useCallback(async () => {
    if (!sourceText.trim()) return
    setTranslating(true)
    setError('')
    setResult('')
    setCopied(false)

    const start = performance.now()
    try {
      const res = await window.translator.translate(sourceText, sourceLang, targetLang)
      setElapsed(Math.round(performance.now() - start))
      if (res.error) {
        setError(res.error)
      } else if (res.translation) {
        setResult(res.translation)
      }
    } catch (err) {
      setError((err as Error).message || '翻译失败')
    } finally {
      setTranslating(false)
    }
  }, [sourceText, sourceLang, targetLang])

  const copy = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [result])

  const clear = useCallback(() => {
    setSourceText('')
    setResult('')
    setError('')
  }, [])

  return (
    <div className="tr-page">
      <div className="tr-card">
        <div className="tr-header">
          <h2 className="tr-title">AI Translator</h2>
          <p className="tr-subtitle">基于 OpenAI 兼容 API 的多语言翻译</p>
        </div>

        {!hasConfig && (
          <div className="tr-config-warning">
            {configHint}
          </div>
        )}

        {/* Language selectors */}
        <div className="tr-lang-row">
          <select
            className="tr-lang-select"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button className="tr-swap-btn" onClick={swap} title="交换语言">
            <ArrowLeftRight size={14} />
          </button>
          <select
            className="tr-lang-select"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Source text */}
        <div className="tr-text-area">
          <textarea
            className="tr-textarea"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="输入要翻译的文本..."
            rows={5}
          />
          <div className="tr-text-meta">
            {sourceText.length} 字符
          </div>
        </div>

        {/* Actions */}
        <div className="tr-actions">
          <button
            className="tr-translate-btn"
            onClick={translate}
            disabled={!hasConfig || translating || !sourceText.trim()}
          >
            {translating ? (
              <>
                <Loader2 size={14} className="tr-spin" />
                翻译中...
              </>
            ) : (
              <>
                <Languages size={14} />
                翻译
              </>
            )}
          </button>
          {result && (
            <button className="tr-copy-btn" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '复制结果'}
            </button>
          )}
          <button className="tr-clear-btn" onClick={clear}>
            <Trash2 size={14} />
            清空
          </button>
        </div>

        {/* Error */}
        {error && <div className="tr-error">{error}</div>}

        {/* Result */}
        {result && !error && (
          <div className="tr-result-area">
            <div className="tr-result-header">
              <span className="tr-result-label">
                {targetLang} 翻译结果
              </span>
              {elapsed > 0 && (
                <span className="tr-elapsed">
                  耗时 {(elapsed / 1000).toFixed(1)}s · {result.length} 字符
                </span>
              )}
            </div>
            <div className="tr-result-text">{result}</div>
          </div>
        )}
      </div>
    </div>
  )
}
