import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Wand2, Copy, Check, RotateCcw } from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import {
  analyzeText,
  characterFrequency,
  formatBytes,
  formatDuration,
  lineRange,
  lineStats,
  topKeywords
} from '@renderer/lib/text-stats'

const KEYWORD_LIMIT = 20
const CHARACTER_LIMIT = 20
// Below this many words, keyword and character rankings are mostly noise.
const SHORT_TEXT_WORDS = 50

const EN_SAMPLE = 'Hello World! This is a sample text for testing the Text Analyzer tool.'
const ZH_SAMPLE = '你好世界！这是一个用于测试文本分析器工具的示例文本。它包含中文字符和标点符号。'

type AnalysisTab = 'keywords' | 'chars' | 'lines'

const TABS: Array<{ id: AnalysisTab; label: string }> = [
  { id: 'keywords', label: '关键词' },
  { id: 'chars', label: '字符频率' },
  { id: 'lines', label: '行统计' }
]

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
  punctuation:
    '\uFF0C\u3002\uFF01\uFF1F\uFF1B\uFF1A\u201C\u201D\u2018\u2019\u3001\uFF08\uFF09\u300A\u300B\u3010\u3011\u2026\u2014\uFF5E\u00B7',
  symbols: '!@#$%^&*()_+-=[]{}|;:<>?,./'
}

const RANDOM_CHUNK_SIZE = 16384

// Common CJK characters subset (~2000 most used)
const CJK_CHARS =
  '的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严龙飞'

function generateText(config: GenConfig): string {
  let pool = ''
  if (config.english) pool += CHAR_POOLS.english
  if (config.numbers) pool += CHAR_POOLS.numbers
  if (config.punctuation) pool += CHAR_POOLS.punctuation
  if (config.symbols) pool += CHAR_POOLS.symbols

  const hasCjk = config.chinese && CJK_CHARS.length > 0
  if (!pool && !hasCjk) return ''

  const result: string[] = []
  let randomValues = new Uint32Array(0)

  for (let start = 0; start < config.length; start += RANDOM_CHUNK_SIZE) {
    const chunkLength = Math.min(RANDOM_CHUNK_SIZE, config.length - start)
    randomValues = new Uint32Array(chunkLength)
    crypto.getRandomValues(randomValues)

    for (let i = 0; i < chunkLength; i++) {
      const randomValue = randomValues[i]
      const useCjk = hasCjk && (pool.length === 0 || randomValue % 100 < 30)
      if (useCjk) {
        result.push(CJK_CHARS[randomValue % CJK_CHARS.length])
      } else {
        result.push(pool[randomValue % pool.length])
      }
    }
  }

  let generated = result.join('')

  // Inject newlines without relying on a second random-value allocation.
  if (config.newlines && config.length > 20) {
    const chars = generated.split('')
    const newlineCount = Math.floor(config.length / 40)
    for (let i = 0; i < newlineCount; i++) {
      const pos = 30 + Math.floor(Math.random() * Math.max(1, chars.length - 30))
      if (pos < chars.length) chars[pos] = '\n'
    }
    generated = chars.join('')
  }

  return generated
}

const MIN_GENERATED_LENGTH = 10
const MAX_GENERATED_LENGTH = 100000

function clampGeneratedLength(value: number): number {
  if (!Number.isFinite(value)) return MIN_GENERATED_LENGTH
  return Math.min(MAX_GENERATED_LENGTH, Math.max(MIN_GENERATED_LENGTH, Math.floor(value)))
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

interface StatItem {
  label: string
  value: string
}

interface BarRow {
  key: string
  label: string
  count: number
  ratio: number
}

function BarList({ rows }: { rows: BarRow[] }): React.JSX.Element {
  const max = rows[0]?.count ?? 0
  return (
    <ul className="ta-bar-list">
      {rows.map((row) => (
        <li key={row.key} className="ta-bar-row">
          <span className="ta-bar-label" title={row.label}>
            {row.label}
          </span>
          <span className="ta-bar-track" aria-hidden="true">
            <span className="ta-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="ta-bar-count">{row.count.toLocaleString()}</span>
          <span className="ta-bar-ratio">{formatPercent(row.ratio)}</span>
        </li>
      ))}
    </ul>
  )
}

function KeywordPanel({ text, words }: { text: string; words: number }): React.JSX.Element {
  const items = useMemo(() => topKeywords(text, KEYWORD_LIMIT), [text])

  if (items.length === 0) {
    return (
      <p className="ta-empty">
        {words === 0
          ? '输入文本后显示关键词。'
          : '没有达到阈值的重复词：英文词需出现 2 次以上，中文词组需出现 3 次以上。'}
      </p>
    )
  }

  return (
    <>
      {words > 0 && words < SHORT_TEXT_WORDS && (
        <p className="ta-note">文本少于 {SHORT_TEXT_WORDS} 个词，关键词结果仅供参考。</p>
      )}
      <BarList
        rows={items.map((item) => ({
          key: item.word,
          label: item.word,
          count: item.count,
          ratio: item.ratio
        }))}
      />
    </>
  )
}

function CharacterPanel({ text }: { text: string }): React.JSX.Element {
  const items = useMemo(() => characterFrequency(text, CHARACTER_LIMIT), [text])

  if (items.length === 0) {
    return <p className="ta-empty">输入文本后显示字符频率。</p>
  }

  return (
    <BarList
      rows={items.map((item) => ({
        key: item.char,
        label: item.char,
        count: item.count,
        ratio: item.ratio
      }))}
    />
  )
}

interface LinePanelProps {
  text: string
  onSelectLine: (index: number) => void
}

function LinePanel({ text, onSelectLine }: LinePanelProps): React.JSX.Element {
  const info = useMemo(() => lineStats(text), [text])

  if (info.total === 0) {
    return <p className="ta-empty">输入文本后显示行统计。</p>
  }

  return (
    <dl className="ta-line-stats">
      <div>
        <dt>总行数</dt>
        <dd>{info.total.toLocaleString()}</dd>
      </div>
      <div>
        <dt>空行</dt>
        <dd>{info.empty.toLocaleString()}</dd>
      </div>
      <div>
        <dt>最长行</dt>
        <dd>
          {info.longest.length.toLocaleString()} 字符
          <button
            type="button"
            className="ta-link-btn"
            onClick={() => onSelectLine(info.longest.index)}
          >
            定位到第 {info.longest.index + 1} 行
          </button>
        </dd>
      </div>
      <div>
        <dt>最短非空行</dt>
        <dd>
          {info.shortest.length.toLocaleString()} 字符
          <span className="ta-line-hint">第 {info.shortest.index + 1} 行</span>
        </dd>
      </div>
    </dl>
  )
}

export default function TextAnalyzer(): React.JSX.Element {
  const [text, setText] = useState('')
  // Analysis runs on the deferred value so typing in a large document stays responsive.
  const deferredText = useDeferredValue(text)
  const [tab, setTab] = useState<AnalysisTab>('keywords')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
  const [genError, setGenError] = useState('')

  const stats = useMemo(() => analyzeText(deferredText), [deferredText])

  const statItems: StatItem[] = useMemo(
    () => [
      { label: '字符数', value: stats.characters.toLocaleString() },
      { label: '字符数（不含空格）', value: stats.charactersNoSpaces.toLocaleString() },
      { label: '单词数', value: stats.words.toLocaleString() },
      { label: '中日韩字符', value: stats.cjkCharacters.toLocaleString() },
      { label: '西文单词', value: stats.latinWords.toLocaleString() },
      { label: '独立西文词', value: stats.uniqueLatinWords.toLocaleString() },
      {
        label: '平均词长',
        value: stats.averageWordLength > 0 ? stats.averageWordLength.toFixed(1) : '—'
      },
      { label: '句子数', value: stats.sentences.toLocaleString() },
      { label: '行数', value: stats.lines.toLocaleString() },
      { label: '段落数', value: stats.paragraphs.toLocaleString() },
      { label: '估算页数', value: stats.estimatedPages.toLocaleString() },
      { label: '字节大小', value: formatBytes(stats.bytes) },
      { label: '阅读时间', value: formatDuration(stats.readingSeconds) },
      { label: '演讲时间', value: formatDuration(stats.speakingSeconds) }
    ],
    [stats]
  )

  const selectLine = useCallback(
    (index: number) => {
      const el = textareaRef.current
      const range = lineRange(text, index)
      if (!el || !range) return
      el.focus()
      el.setSelectionRange(range.start, range.end)
    },
    [text]
  )

  const handleGenerate = useCallback(() => {
    const next = generateText(genConfig)
    if (!next) {
      setGenError('至少选择一种字符类型后再生成')
      setGenerated('')
      return
    }
    setGenError('')
    setGenerated(next)
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

  const updateGenConfig = useCallback(<K extends keyof GenConfig>(key: K, value: GenConfig[K]) => {
    setGenConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  return (
    <div className="ta-page">
      <div className="ta-card">
        <div className="ta-header">
          <h2 className="ta-title">Text Analyzer</h2>
          <p className="ta-subtitle">实时分析文本统计信息 & 测试数据生成</p>
        </div>

        <TextFileBar
          value={text}
          onOpened={(f) => setText(f.content)}
          onNew={() => setText('')}
          suggestedName="text-analysis.txt"
        />

        <div className="ta-workspace">
          <section className="ta-input-pane" aria-label="输入">
            <div className="ta-input-header">
              <span className="ta-input-label">输入文本</span>
              <div className="ta-samples">
                <button type="button" className="ta-sample-btn" onClick={() => setText(EN_SAMPLE)}>
                  英文示例
                </button>
                <button type="button" className="ta-sample-btn" onClick={() => setText(ZH_SAMPLE)}>
                  中文示例
                </button>
                <button
                  type="button"
                  className="ta-sample-btn"
                  onClick={() => setText('')}
                  disabled={!text}
                  aria-label="清空输入文本"
                >
                  <RotateCcw size={12} />
                  清空
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="ta-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此输入或粘贴文本..."
              spellCheck={false}
              aria-label="输入文本"
            />

            <details className="ta-gen" open>
              <summary className="ta-gen-summary">
                <Wand2 size={14} />
                测试数据生成
              </summary>

              <div className="ta-gen-body">
                <div className="ta-gen-controls">
                  <div className="ta-gen-row">
                    <span className="ta-gen-label">长度</span>
                    <input
                      type="number"
                      className="ta-gen-length"
                      value={genConfig.length}
                      min={MIN_GENERATED_LENGTH}
                      max={MAX_GENERATED_LENGTH}
                      onChange={(e) =>
                        updateGenConfig('length', clampGeneratedLength(e.target.valueAsNumber))
                      }
                      onBlur={(e) => {
                        e.target.value = String(genConfig.length)
                      }}
                      aria-label="生成文本长度"
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
                  <button type="button" className="ta-gen-btn" onClick={handleGenerate}>
                    <Wand2 size={14} />
                    生成
                  </button>
                </div>

                {genError && (
                  <p className="ta-gen-error" role="status">
                    {genError}
                  </p>
                )}

                {generated && (
                  <div className="ta-gen-output">
                    <div className="ta-gen-output-header">
                      <span className="ta-gen-output-label">
                        生成结果 ({generated.length} 字符)
                      </span>
                      <div className="ta-gen-output-actions">
                        <button
                          type="button"
                          className="ta-sample-btn"
                          onClick={handleUseGenerated}
                        >
                          使用此文本
                        </button>
                        <button
                          type="button"
                          className="ta-sample-btn"
                          onClick={handleCopyGenerated}
                        >
                          {genCopied ? <Check size={12} /> : <Copy size={12} />}
                          {genCopied ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>
                    <pre className="ta-gen-text">{generated}</pre>
                  </div>
                )}
              </div>
            </details>
          </section>

          <section className="ta-results" aria-label="分析结果">
            <div className="ta-stats-grid">
              {statItems.map(({ label, value }) => (
                <div key={label} className="ta-stat">
                  <span className="ta-stat-value">{value}</span>
                  <span className="ta-stat-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="ta-tabs" role="tablist" aria-label="分析视图">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`ta-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls="ta-tabpanel"
                  className="ta-tab"
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="ta-panel"
              role="tabpanel"
              id="ta-tabpanel"
              aria-labelledby={`ta-tab-${tab}`}
            >
              {tab === 'keywords' && <KeywordPanel text={deferredText} words={stats.words} />}
              {tab === 'chars' && <CharacterPanel text={deferredText} />}
              {tab === 'lines' && <LinePanel text={deferredText} onSelectLine={selectLine} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
