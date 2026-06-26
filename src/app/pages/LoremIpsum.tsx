import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, RotateCcw, Type } from 'lucide-react'
import '../styles/lorem-ipsum.css'

// ── Lorem Ipsum word pool ──────────────────────────────────────

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et',
  'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis',
  'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'ut', 'aliquip',
  'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'dolor',
  'in', 'reprehenderit', 'in', 'voluptate', 'velit', 'esse', 'cillum',
  'dolore', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'in', 'culpa',
  'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
  'praesent', 'sapien', 'massa', 'convallis', 'a', 'pellentesque', 'nec',
  'egestas', 'non', 'nisi', 'cras', 'ultricies', 'ligula', 'sed', 'magna',
  'dictum', 'porta', 'curabitur', 'arcu', 'erat', 'accumsan', 'id',
  'imperdiet', 'porttitor', 'sem', 'nulla', 'pharetra', 'diam', 'sit'
]

// ── Generator ──────────────────────────────────────────────────

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function generateSentence(wordCount: number, isFirst: boolean): string {
  const words: string[] = []
  const actualCount = Math.max(5, wordCount)

  for (let i = 0; i < actualCount; i++) {
    words.push(WORDS[Math.floor(Math.random() * WORDS.length)])
  }

  // Avoid duplicate consecutive words
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      words[i] = WORDS[(WORDS.indexOf(words[i]) + 1) % WORDS.length]
    }
  }

  let sentence = words.join(' ')
  if (isFirst) sentence = capitalize(sentence)
  return sentence + '.'
}

function generateParagraph(minSentences: number, maxSentences: number): string {
  const count =
    minSentences + Math.floor(Math.random() * (maxSentences - minSentences + 1))
  const sentences: string[] = []

  for (let i = 0; i < count; i++) {
    const wordCount = 8 + Math.floor(Math.random() * 12)
    sentences.push(generateSentence(wordCount, i === 0))
  }

  return sentences.join(' ')
}

function generateLoremIpsum(
  type: 'paragraphs' | 'sentences' | 'words',
  count: number
): string {
  if (type === 'paragraphs') {
    const paragraphs: string[] = []
    for (let i = 0; i < count; i++) {
      paragraphs.push(generateParagraph(4, 8))
    }
    return paragraphs.join('\n\n')
  }

  if (type === 'sentences') {
    const sentences: string[] = []
    for (let i = 0; i < count; i++) {
      sentences.push(generateSentence(8 + Math.floor(Math.random() * 12), i === 0))
    }
    return sentences.join(' ')
  }

  // words
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(WORDS[Math.floor(Math.random() * WORDS.length)])
  }
  return capitalize(out.join(' ')) + '.'
}

// ── Component ──────────────────────────────────────────────────

type GenerateType = 'paragraphs' | 'sentences' | 'words'

export default function LoremIpsum(): React.JSX.Element {
  const [genType, setGenType] = useState<GenerateType>('paragraphs')
  const [count, setCount] = useState(3)
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  const generate = useCallback(() => {
    const result = generateLoremIpsum(genType, count)
    setOutput(result)
    setCopied(false)
  }, [genType, count])

  const copy = useCallback(async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }, [output])

  const clear = useCallback(() => {
    setOutput('')
    setCopied(false)
  }, [])

  const stats = useMemo(() => {
    if (!output) return null
    const words = output.split(/\s+/).filter(Boolean).length
    const chars = output.length
    const paragraphs = output.split(/\n\n/).length
    return { words, chars, paragraphs }
  }, [output])

  const maxCount = genType === 'words' ? 200 : genType === 'sentences' ? 50 : 20

  return (
    <div className="li-page">
      <div className="li-card">
        <div className="li-header">
          <h2 className="li-title">Lorem Ipsum Generator</h2>
          <p className="li-subtitle">生成虚拟占位文本，用于设计和排版</p>
        </div>

        {/* Controls */}
        <div className="li-controls">
          <div className="li-control-group">
            <label className="li-label">类型</label>
            <div className="li-segmented">
              {([
                ['paragraphs', '段落'],
                ['sentences', '句子'],
                ['words', '单词']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  className={`li-seg-option ${genType === value ? 'active' : ''}`}
                  onClick={() => {
                    setGenType(value)
                    setCount(value === 'paragraphs' ? 3 : value === 'sentences' ? 10 : 50)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="li-control-group">
            <label className="li-label">
              {genType === 'paragraphs' ? '段落数' : genType === 'sentences' ? '句子数' : '单词数'}
            </label>
            <div className="li-count-row">
              <input
                type="range"
                className="li-range"
                min={1}
                max={maxCount}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
              <span className="li-count-value">{count}</span>
            </div>
          </div>

          <button className="li-btn li-btn-primary" onClick={generate}>
            <Type size={15} />
            生成
          </button>
        </div>

        {/* Output */}
        {output && (
          <>
            <div className="li-output-area">
              <div className="li-output-header">
                <span className="li-output-label">生成结果</span>
                <div className="li-output-actions">
                  <button className="li-btn li-btn-ghost" onClick={copy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                  <button className="li-btn li-btn-ghost" onClick={clear}>
                    <RotateCcw size={14} />
                    清空
                  </button>
                </div>
              </div>
              <div className="li-output">{output}</div>
            </div>

            {stats && (
              <div className="li-stats">
                <div className="li-stat">
                  <span className="li-stat-value">{stats.paragraphs}</span>
                  <span className="li-stat-label">段落</span>
                </div>
                <div className="li-stat">
                  <span className="li-stat-value">{stats.words}</span>
                  <span className="li-stat-label">单词</span>
                </div>
                <div className="li-stat">
                  <span className="li-stat-value">{stats.chars}</span>
                  <span className="li-stat-label">字符</span>
                </div>
              </div>
            )}
          </>
        )}

        {!output && (
          <div className="li-placeholder">
            <Type size={40} className="li-placeholder-icon" />
            <span>选择类型和数量，点击「生成」按钮</span>
          </div>
        )}
      </div>
    </div>
  )
}
