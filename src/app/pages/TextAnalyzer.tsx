import { useState, useMemo, useCallback } from 'react'
import { Type, FileText, Clock, Hash, Wand2, Copy, Check } from 'lucide-react'

interface TextStats {
  characters: number
  charactersNoSpaces: number
  words: number
  lines: number
  paragraphs: number
  bytes: number
  readingTime: number
  speakingTime: number
}

function analyzeText(text: string): TextStats {
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const lines = text ? text.split('\n').length : 0
  const paragraphs = text.trim()
    ? text
        .trim()
        .split(/\n\s*\n/)
        .filter((p) => p.trim()).length
    : 0
  const bytes = new TextEncoder().encode(text).length
  const readingTime = Math.ceil(words / 200)
  const speakingTime = Math.ceil(words / 130)

  return {
    characters,
    charactersNoSpaces,
    words,
    lines,
    paragraphs,
    bytes,
    readingTime,
    speakingTime
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) return `${minutes} min`
  return `${minutes} min ${remainingSeconds} sec`
}

interface GenConfig {
  length: number
  english: boolean
  chinese: boolean
  numbers: boolean
  punctuation: boolean
  symbols: boolean
  newlines: boolean
}

const CHAR_POOLS = {
  english: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ',
  numbers: '0123456789',
  punctuation: '\uFF0C\u3002\uFF01\uFF1F\uFF1B\uFF1A\u201C\u201D\u2018\u2019\u3001\uFF08\uFF09\u300A\u300B\u3010\u3011\u2026\u2014\uFF5E\u00B7',
  symbols: '!@#$%^&*()_+-=[]{}|;:<>?,./'
}

// Common CJK characters subset (~2000 most used)
const CJK_CHARS =
  '的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严龙飞'

function generateText(config: GenConfig): string {
  let pool = ''
  if (config.english) pool += CHAR_POOLS.english
  if (config.numbers) pool += CHAR_POOLS.numbers
  if (config.punctuation) pool += CHAR_POOLS.punctuation
  if (config.symbols) pool += CHAR_POOLS.symbols

  // Treat Chinese separately — insert Chinese chars at random positions
  const hasCjk = config.chinese && CJK_CHARS.length > 0

  if (!pool && !hasCjk) pool = CHAR_POOLS.english

  const array = new Uint32Array(config.length)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < config.length; i++) {
    // ~30% chance of Chinese if enabled
    if (hasCjk && Math.random() < 0.3) {
      result += CJK_CHARS[array[i] % CJK_CHARS.length]
    } else {
      result += pool[array[i] % pool.length]
    }
  }

  // Inject newlines
  if (config.newlines && config.length > 20) {
    const lines = result.split('')
    const newlineCount = Math.floor(config.length / 40)
    for (let i = 0; i < newlineCount; i++) {
      const pos = 30 + Math.floor(Math.random() * (lines.length - 10))
      if (pos < lines.length) lines[pos] = '\n'
    }
    result = lines.join('')
  }

  return result
}

interface StatItem {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number }>
}

export default function TextAnalyzer(): React.JSX.Element {
  const [text, setText] = useState('')
  const [genConfig, setGenConfig] = useState<GenConfig>({
    length: 200,
    english: true,
    chinese: false,
    numbers: true,
    punctuation: true,
    symbols: false,
    newlines: true
  })
  const [genCopied, setGenCopied] = useState(false)
  const [generated, setGenerated] = useState('')

  const stats = useMemo(() => analyzeText(text), [text])

  const statItems: StatItem[] = useMemo(
    () => [
      { label: '字符数', value: stats.characters.toLocaleString(), icon: Type },
      { label: '字符数（不含空格）', value: stats.charactersNoSpaces.toLocaleString(), icon: Type },
      { label: '单词数', value: stats.words.toLocaleString(), icon: FileText },
      { label: '行数', value: stats.lines.toLocaleString(), icon: FileText },
      { label: '段落数', value: stats.paragraphs.toLocaleString(), icon: FileText },
      { label: '字节大小', value: formatBytes(stats.bytes), icon: Hash },
      { label: '阅读时间', value: formatTime(stats.readingTime), icon: Clock },
      { label: '演讲时间', value: formatTime(stats.speakingTime), icon: Clock }
    ],
    [stats]
  )

  const loadSample = useCallback((sample: string) => {
    setText(sample)
  }, [])

  const handleGenerate = useCallback(() => {
    setGenerated(generateText(genConfig))
  }, [genConfig])

  const handleUseGenerated = useCallback(() => {
    setText(generated)
  }, [generated])

  const handleCopyGenerated = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generated)
      setGenCopied(true)
      setTimeout(() => setGenCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [generated])

  const updateGenConfig = useCallback(
    <K extends keyof GenConfig>(key: K, value: GenConfig[K]) => {
      setGenConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  return (
    <div className="ta-page">
      <div className="ta-card">
        <div className="ta-header">
          <h2 className="ta-title">Text Analyzer</h2>
          <p className="ta-subtitle">实时分析文本统计信息 & 测试数据生成</p>
        </div>

        <div className="ta-input-area">
          <div className="ta-input-header">
            <span className="ta-input-label">输入文本</span>
            <div className="ta-samples">
              <button
                className="ta-sample-btn"
                onClick={() =>
                  loadSample(
                    'Hello World! This is a sample text for testing the Text Analyzer tool.'
                  )
                }
              >
                英文示例
              </button>
              <button
                className="ta-sample-btn"
                onClick={() =>
                  loadSample(
                    '你好世界！这是一个用于测试文本分析器工具的示例文本。它包含中文字符和标点符号。'
                  )
                }
              >
                中文示例
              </button>
            </div>
          </div>
          <textarea
            className="ta-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此输入或粘贴文本..."
            rows={8}
          />
        </div>

        {/* Generator */}
        <div className="ta-gen-section">
          <span className="ta-gen-title">
            <Wand2 size={14} />
            测试数据生成
          </span>

          <div className="ta-gen-controls">
            <div className="ta-gen-row">
              <span className="ta-gen-label">长度</span>
              <input
                type="number"
                className="ta-gen-length"
                value={genConfig.length}
                min={10}
                max={100000}
                onChange={(e) => updateGenConfig('length', Number(e.target.value) || 10)}
              />
            </div>
            <div className="ta-gen-chars">
              {[
                { key: 'english' as const, label: '英文' },
                { key: 'chinese' as const, label: '中文' },
                { key: 'numbers' as const, label: '数字' },
                { key: 'punctuation' as const, label: '标点' },
                { key: 'symbols' as const, label: '特殊符号' },
                { key: 'newlines' as const, label: '换行' }
              ].map(({ key, label }) => (
                <label key={key} className="ta-gen-check">
                  <input
                    type="checkbox"
                    checked={genConfig[key]}
                    onChange={(e) => updateGenConfig(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button className="ta-gen-btn" onClick={handleGenerate}>
              <Wand2 size={14} />
              生成
            </button>
          </div>

          {generated && (
            <div className="ta-gen-output">
              <div className="ta-gen-output-header">
                <span className="ta-gen-output-label">
                  生成结果 ({generated.length} 字符)
                </span>
                <div className="ta-gen-output-actions">
                  <button className="ta-sample-btn" onClick={handleUseGenerated}>
                    使用此文本
                  </button>
                  <button className="ta-sample-btn" onClick={handleCopyGenerated}>
                    {genCopied ? <Check size={12} /> : <Copy size={12} />}
                    {genCopied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
              <pre className="ta-gen-text">{generated}</pre>
            </div>
          )}
        </div>

        <div className="ta-stats-grid">
          {statItems.map(({ label, value, icon: Icon }) => (
            <div key={label} className="ta-stat-item">
              <div className="ta-stat-icon">
                <Icon size={16} />
              </div>
              <div className="ta-stat-content">
                <span className="ta-stat-value">{value}</span>
                <span className="ta-stat-label">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
