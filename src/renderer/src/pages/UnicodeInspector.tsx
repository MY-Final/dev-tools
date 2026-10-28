import { useMemo, useState } from 'react'
import { Check, Copy, Info } from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import {
  CATEGORY_GROUP_LABELS,
  CATEGORY_GROUP_ORDER,
  MAX_INSPECT_CODE_POINTS,
  NORMALIZATION_ROWS,
  capCodePoints,
  categoryGroupOf,
  codePointFields,
  describeGrapheme,
  formatCodePointHex,
  formatGraphemeText,
  graphemeFields,
  graphemeFlagLabels,
  normalizationFields,
  parseCodePointQuery,
  segmentGraphemes,
  type GraphemeDetail
} from '@renderer/lib/unicode-info'

type Mode = 'check' | 'lookup'

const SAMPLES = ['A', '中', 'é', 'Ω', '🎉', '👍🏽', '🇨🇳', '👨‍👩‍👧‍👦']

/** Display-only substitutes for characters that would otherwise be invisible in a chip. */
function visibleGlyph(grapheme: string): string {
  if (grapheme === '\t') return '⇥'
  if (grapheme === '\n' || grapheme === '\r' || grapheme === '\r\n') return '⏎'
  if (/^\p{Zs}+$/u.test(grapheme)) return '␣'
  if (/^\p{Cc}$/u.test(grapheme)) {
    const cp = grapheme.codePointAt(0) ?? 0
    // Control Pictures block (U+2400 + code) for C0 controls; a plain dot for the rest.
    return cp < 0x20 || cp === 0x7f ? String.fromCodePoint(0x2400 + cp) : '·'
  }
  return grapheme
}

function chipCode(detail: GraphemeDetail): string {
  const first = detail.codePoints[0]
  if (!first) return ''
  return detail.codePoints.length > 1 ? `${first.hex} +${detail.codePoints.length - 1}` : first.hex
}

interface FieldRowProps {
  label: string
  value: string
  id: string
  copiedKey: string | null
  tag?: string
  onCopy: (text: string, key: string) => void
}

function FieldRow({ label, value, id, copiedKey, tag, onCopy }: FieldRowProps): React.JSX.Element {
  const copied = copiedKey === id
  return (
    <div className="ui-field">
      <span className="ui-field-label">{label}</span>
      <code className="ui-field-value">{value}</code>
      {tag && <span className="ui-tag">{tag}</span>}
      <button
        type="button"
        className={`ui-copy-btn ${copied ? 'is-copied' : ''}`}
        onClick={() => onCopy(value, id)}
        aria-label={`复制${label}`}
        title={`复制${label}`}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}

interface DetailViewProps {
  detail: GraphemeDetail
  heading: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
}

function DetailView({ detail, heading, copiedKey, onCopy }: DetailViewProps): React.JSX.Element {
  const flags = graphemeFlagLabels(detail)
  return (
    <section className="ui-detail" aria-label="字形详情">
      <header className="ui-detail-head">
        <span className="ui-detail-glyph" aria-hidden="true">
          {visibleGlyph(detail.grapheme)}
        </span>
        <div className="ui-detail-meta">
          <span className="ui-detail-heading">{heading}</span>
          {flags.length > 0 && (
            <span className="ui-tags">
              {flags.map((flag) => (
                <span key={flag} className="ui-tag">
                  {flag}
                </span>
              ))}
            </span>
          )}
        </div>
        <button
          type="button"
          className="ui-action-btn"
          onClick={() => onCopy(formatGraphemeText(detail), 'all')}
        >
          {copiedKey === 'all' ? <Check size={12} /> : <Copy size={12} />}
          复制全部字段
        </button>
      </header>

      <div className="ui-group">
        <h3 className="ui-group-title">字形</h3>
        {graphemeFields(detail).map((field) => (
          <FieldRow
            key={field.label}
            label={field.label}
            value={field.value}
            id={`g|${field.label}`}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        ))}
        <div className="ui-field">
          <span className="ui-field-label">字符名称</span>
          <span className="ui-field-muted">本地不可用</span>
        </div>
      </div>

      <div className="ui-group">
        <h3 className="ui-group-title">规范化</h3>
        {normalizationFields(detail).map((field) => {
          const row = NORMALIZATION_ROWS.find((item) => item.label === field.label)
          const differs = row ? detail[row.key].differs : false
          return (
            <FieldRow
              key={field.label}
              label={field.label}
              value={field.value}
              id={`nf|${field.label}`}
              copiedKey={copiedKey}
              tag={differs ? '与原文不同' : undefined}
              onCopy={onCopy}
            />
          )
        })}
      </div>

      {detail.codePoints.map((info, index) => (
        <div key={`${info.codePoint}-${index}`} className="ui-group">
          <h3 className="ui-group-title">
            码点 {index + 1} · {info.hex}
          </h3>
          {codePointFields(info).map((field) => (
            <FieldRow
              key={field.label}
              label={field.label}
              value={field.value}
              id={`cp${index}|${field.label}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
          ))}
        </div>
      ))}

      <p className="ui-note">
        {
          '字符名称需要完整的 Unicode 名称数据库（UnicodeData.txt），本应用未内置，因此不显示名称，也不做推测。区段名称来自内置的常用区段表，表外码点显示「未收录区段」。宽度为估算值。'
        }
      </p>
    </section>
  )
}

interface HighlightViewProps {
  graphemes: GraphemeDetail[]
}

function HighlightView({ graphemes }: HighlightViewProps): React.JSX.Element {
  return (
    <div className="ui-highlight-panel">
      <div className="ui-highlight" aria-label="按分类着色的文本">
        {graphemes.flatMap((detail, gi) =>
          detail.codePoints.map((info, ci) => {
            const group = categoryGroupOf(info.category)
            return (
              <span key={`${gi}-${ci}`} className={`ui-hl ui-hl-${group}`}>
                {String.fromCodePoint(info.codePoint)}
              </span>
            )
          })
        )}
      </div>
      <ul className="ui-legend">
        {CATEGORY_GROUP_ORDER.map((group) => (
          <li key={group} className="ui-legend-item">
            <span className={`ui-swatch ui-hl-${group}`} aria-hidden="true" />
            {CATEGORY_GROUP_LABELS[group]}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function UnicodeInspector(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('check')
  const [input, setInput] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [highlight, setHighlight] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  const graphemes = useMemo(
    (): GraphemeDetail[] => segmentGraphemes(input).map((g) => describeGrapheme(g)),
    [input]
  )
  const totalCodePoints = useMemo(
    () => graphemes.reduce((sum, detail) => sum + detail.codePoints.length, 0),
    [graphemes]
  )

  const activeIndex = Math.min(selectedIndex, Math.max(graphemes.length - 1, 0))
  const active: GraphemeDetail | undefined = graphemes[activeIndex]

  const lookupCodePoint = useMemo(() => parseCodePointQuery(query), [query])
  const lookupDetail = useMemo(
    (): GraphemeDetail | null =>
      lookupCodePoint === null ? null : describeGrapheme(String.fromCodePoint(lookupCodePoint)),
    [lookupCodePoint]
  )
  const queryInvalid = query.trim() !== '' && lookupCodePoint === null

  function applyInput(value: string): void {
    const capped = capCodePoints(value)
    setInput(capped.text)
    setTruncated(capped.truncated)
    setSelectedIndex(0)
  }

  async function copyText(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="ui-page">
      <div className="ui-card">
        <div className="ui-header">
          <h2 className="ui-title">Unicode Inspector</h2>
          <p className="ui-subtitle">
            按字形查看码点、编码与分类，支持按码点反查字符；字符名称需要名称数据库，本地不提供
          </p>
        </div>

        <div className="tool-segmented ui-mode" role="group" aria-label="工作模式">
          <button
            type="button"
            className={`tool-seg ${mode === 'check' ? 'active' : ''}`}
            aria-pressed={mode === 'check'}
            onClick={() => setMode('check')}
          >
            检查文本
          </button>
          <button
            type="button"
            className={`tool-seg ${mode === 'lookup' ? 'active' : ''}`}
            aria-pressed={mode === 'lookup'}
            onClick={() => setMode('lookup')}
          >
            查询码点
          </button>
        </div>

        {mode === 'check' && (
          <>
            <div className="ui-section">
              <div className="ui-input-header">
                <label htmlFor="unicode-input" className="ui-input-label">
                  输入字符或字符串
                </label>
                <div className="ui-samples">
                  {SAMPLES.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      className="ui-sample-btn"
                      onClick={() => applyInput(sample)}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="unicode-input"
                className="ui-textarea"
                rows={3}
                value={input}
                onChange={(e) => applyInput(e.target.value)}
                placeholder="输入任意字符..."
                spellCheck={false}
              />
              <div className="ui-input-footer">
                <span className="ui-counter">
                  {totalCodePoints} / {MAX_INSPECT_CODE_POINTS} 码点
                </span>
                {truncated && (
                  <span className="ui-notice" role="status">
                    <Info size={12} aria-hidden="true" />
                    内容超过 {MAX_INSPECT_CODE_POINTS}{' '}
                    码点，已截断。截断后文件操作暂停，以免把截断内容写回原文件；删减到上限以内即可恢复。
                  </span>
                )}
              </div>
            </div>

            <TextFileBar
              value={input}
              onOpened={(f) => applyInput(f.content)}
              onNew={() => applyInput('')}
              suggestedName="unicode-inspect.txt"
              disabled={truncated}
            />

            {graphemes.length > 0 && (
              <div className="ui-toolbar">
                <span className="ui-summary">
                  共 {graphemes.length} 个字形 · {totalCodePoints} 个码点
                </span>
                <button
                  type="button"
                  className="ui-toggle"
                  aria-pressed={highlight}
                  onClick={() => setHighlight((value) => !value)}
                >
                  分类高亮
                </button>
              </div>
            )}

            {highlight && graphemes.length > 0 && <HighlightView graphemes={graphemes} />}

            {graphemes.length > 0 && active ? (
              <div className="ui-browser">
                <div className="ui-chips-panel">
                  <div className="ui-chips-head">
                    <span>字形（点选查看详情）</span>
                    <span className="ui-flag-legend">
                      <span className="ui-dot ui-dot--mark" aria-hidden="true" />
                      组合标记
                      <span className="ui-dot ui-dot--emoji" aria-hidden="true" />
                      表情符号
                    </span>
                  </div>
                  <div className="ui-chips">
                    {graphemes.map((detail, i) => (
                      <button
                        key={`${i}-${detail.grapheme}`}
                        type="button"
                        className="ui-chip"
                        aria-pressed={i === activeIndex}
                        title={detail.codePoints.map((c) => c.hex).join(' ')}
                        onClick={() => setSelectedIndex(i)}
                      >
                        <span className="ui-chip-glyph">{visibleGlyph(detail.grapheme)}</span>
                        <span className="ui-chip-code">{chipCode(detail)}</span>
                        {detail.isCombining && (
                          <span className="ui-dot ui-dot--mark" aria-hidden="true" />
                        )}
                        {detail.isEmoji && (
                          <span className="ui-dot ui-dot--emoji" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <DetailView
                  detail={active}
                  heading={`第 ${activeIndex + 1} / ${graphemes.length} 个字形`}
                  copiedKey={copiedKey}
                  onCopy={copyText}
                />
              </div>
            ) : (
              <div className="ui-empty">输入一个字符开始分析</div>
            )}
          </>
        )}

        {mode === 'lookup' && (
          <div className="ui-lookup">
            <label htmlFor="unicode-query" className="ui-input-label">
              码点或单个字符
            </label>
            <input
              id="unicode-query"
              className="ui-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="U+4E2D、4E2D、0x4E2D、20013 或 中"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={queryInvalid}
              aria-describedby="unicode-query-help"
            />
            <ul id="unicode-query-help" className="ui-help">
              <li>U+4E2D 或 0x4E2D：带前缀的十六进制码点</li>
              <li>4E2D：不带前缀的十六进制（需含 A–F，否则按十进制理解）</li>
              <li>20013：纯数字按十进制理解；要按十六进制请用 U+0041 形式</li>
              <li>中：单个字符（多码点字符取第一个码点）</li>
              <li>范围 0 – 10FFFF，不含代理区 D800 – DFFF</li>
            </ul>
            {queryInvalid && (
              <p className="ui-error" role="alert">
                无法识别「{query.trim()}」为码点。请按上面的格式输入，或只输入一个字符。
              </p>
            )}
            {lookupDetail && lookupCodePoint !== null && (
              <DetailView
                detail={lookupDetail}
                heading={`查询结果 · ${formatCodePointHex(lookupCodePoint)}`}
                copiedKey={copiedKey}
                onCopy={copyText}
              />
            )}
          </div>
        )}

        {copyFailed && (
          <p className="ui-error" role="alert">
            复制失败，请检查剪贴板权限
          </p>
        )}
      </div>
    </div>
  )
}
