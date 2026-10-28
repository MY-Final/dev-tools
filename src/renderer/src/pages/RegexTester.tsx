import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Library, RotateCcw, Search } from 'lucide-react'
import TextFileBar from '@renderer/components/TextFileBar'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  applyReplacement,
  buildHighlightSegments,
  collectMatchesResult,
  compileRegex,
  formatRegexLiteral,
  MAX_MATCHES,
  type MatchInfo
} from '@renderer/lib/regex-match'
import {
  REGEX_PRESET_CATEGORIES,
  filterRegexPresets,
  type RegexPreset
} from '@renderer/lib/regex-presets'
import '../styles/regex-tester.css'

const FLAG_ORDER = 'dgimsuy'

const FLAG_OPTIONS = [
  { flag: 'g', label: '全局', hint: '查找所有出现（与 y 互斥）' },
  { flag: 'i', label: '忽略大小写', hint: '不区分大小写' },
  { flag: 'm', label: '多行', hint: '^ 和 $ 匹配每行首尾' },
  { flag: 's', label: '点全匹配', hint: '. 也匹配换行符' },
  { flag: 'u', label: 'Unicode', hint: '按代码点匹配，支持 \\p{…}' },
  { flag: 'y', label: '粘连', hint: '从起点连续匹配（与 g 互斥）' },
  { flag: 'd', label: '索引', hint: '记录每个分组的字符位置' }
]

const REPLACE_SYNTAX = [
  { token: '$1', desc: '第 1 个分组' },
  { token: '$&', desc: '整个匹配' },
  { token: '$<name>', desc: '命名分组' },
  { token: '$$', desc: '字面量 $' }
]

/** Rows rendered in the match list; the navigator still covers every match. */
const LIST_LIMIT = 200

function sortFlags(flags: string): string {
  return FLAG_ORDER.split('')
    .filter((f) => flags.includes(f))
    .join('')
}

/** Toggles one flag. `g` and `y` change lastIndex semantics, so enabling one clears the other. */
function toggleFlagValue(flags: string, flag: string): string {
  if (flags.includes(flag)) return flags.replace(flag, '')
  let next = flags + flag
  if (flag === 'g') next = next.replace('y', '')
  if (flag === 'y') next = next.replace('g', '')
  return sortFlags(next)
}

interface GroupTableProps {
  match: MatchInfo
  activeGroup: number | null
  showRanges: boolean
  onSelect: (group: number | null) => void
}

function GroupTable({
  match,
  activeGroup,
  showRanges,
  onSelect
}: GroupTableProps): React.JSX.Element {
  const end = match.index + match.value.length
  return (
    <div className="rx-group-table-wrap">
      <table className="rx-group-table">
        <thead>
          <tr>
            <th scope="col">编号</th>
            <th scope="col">名称</th>
            <th scope="col">值</th>
            {showRanges && <th scope="col">范围</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span className="rx-group-index">$&amp;</span>
            </td>
            <td className="rx-muted">—</td>
            <td>
              <code className="rx-group-value">{match.value || '(空)'}</code>
            </td>
            {showRanges && (
              <td className="rx-mono">
                {match.index}–{end}
              </td>
            )}
          </tr>
          {match.groups.map((group) => {
            const active = activeGroup === group.index
            return (
              <tr key={group.index} className={active ? 'is-active' : undefined}>
                <td>
                  <button
                    type="button"
                    className="rx-group-btn"
                    aria-pressed={active}
                    title="点击在文本中高亮该分组"
                    onClick={() => onSelect(active ? null : group.index)}
                  >
                    {`$${group.index}`}
                  </button>
                </td>
                <td>
                  {group.name ? (
                    <code className="rx-mono">{`$<${group.name}>`}</code>
                  ) : (
                    <span className="rx-muted">—</span>
                  )}
                </td>
                <td>
                  {group.value === undefined ? (
                    <span className="rx-muted">未参与匹配</span>
                  ) : (
                    <code className="rx-group-value">{group.value || '(空)'}</code>
                  )}
                </td>
                {showRanges && (
                  <td className="rx-mono">
                    {group.start !== undefined && group.end !== undefined ? (
                      `${group.start}–${group.end}`
                    ) : (
                      <span className="rx-muted">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {match.groups.length === 0 && (
        <div className="rx-muted rx-table-note">该正则没有捕获分组</div>
      )}
    </div>
  )
}

export default function RegexTester(): React.JSX.Element {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [testString, setTestString] = useState('')
  const [replacement, setReplacement] = useState('')
  const [mode, setMode] = useState<'match' | 'replace'>('match')
  const [activeIndex, setActiveIndex] = useState(0)
  const [navSeq, setNavSeq] = useState(0)
  const [activeGroup, setActiveGroup] = useState<number | null>(null)
  const [presetOpen, setPresetOpen] = useState(false)
  const [presetQuery, setPresetQuery] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const currentRef = useRef<HTMLElement | null>(null)

  const compiled = useMemo(() => compileRegex(pattern, flags), [pattern, flags])
  const regex = compiled.regex
  const literal = useMemo(() => formatRegexLiteral(pattern, flags), [pattern, flags])
  const hasIndices = flags.includes('d')

  const collected = useMemo(
    () => (regex && testString ? collectMatchesResult(regex, testString, MAX_MATCHES) : null),
    [regex, testString]
  )
  const matchList = collected?.matches
  const matchCount = matchList?.length ?? 0
  const current = matchCount > 0 ? Math.min(activeIndex, matchCount - 1) : -1
  const currentMatch = matchList && current >= 0 ? matchList[current] : undefined

  const segments = useMemo(
    () =>
      buildHighlightSegments(testString, matchList ?? [], {
        groupIndex: activeGroup ?? undefined
      }),
    [testString, matchList, activeGroup]
  )

  const replaced = useMemo(
    () =>
      regex && testString && mode === 'replace'
        ? applyReplacement(testString, regex, replacement, MAX_MATCHES)
        : null,
    [regex, testString, replacement, mode]
  )

  const presetGroups = useMemo(
    () => filterRegexPresets(REGEX_PRESET_CATEGORIES, presetQuery),
    [presetQuery]
  )

  // Scroll only after explicit navigation, so typing elsewhere never jumps the page.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [navSeq])

  const goTo = useCallback((index: number) => {
    setActiveIndex(index)
    setNavSeq((n) => n + 1)
  }, [])

  const handleToggleFlag = useCallback((flag: string) => {
    setFlags((prev) => toggleFlagValue(prev, flag))
    setActiveIndex(0)
  }, [])

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {
      // Clipboard can be unavailable; the text is still selectable.
    }
  }, [])

  const applyPreset = useCallback((preset: RegexPreset) => {
    setPattern(preset.pattern)
    setFlags(sortFlags(preset.flags))
    setTestString(preset.sample)
    setActiveIndex(0)
    setActiveGroup(null)
    setPresetOpen(false)
    setPresetQuery('')
  }, [])

  const clearAll = useCallback(() => {
    setPattern('')
    setFlags('g')
    setTestString('')
    setReplacement('')
    setActiveIndex(0)
    setActiveGroup(null)
  }, [])

  const copied = (key: string): boolean => copiedKey === key

  return (
    <div className="rx-page">
      <div className="rx-card">
        <div className="rx-header">
          <h2 className="rx-title">Regex Tester</h2>
          <p className="rx-subtitle">正则表达式实时测试与替换</p>
        </div>

        {/* Pattern */}
        <div className="rx-input-group">
          <div className="rx-input-header">
            <label className="rx-label" htmlFor="rx-pattern">
              正则表达式
            </label>
            <Popover
              open={presetOpen}
              onOpenChange={(open) => {
                setPresetOpen(open)
                if (!open) setPresetQuery('')
              }}
            >
              <PopoverTrigger asChild>
                <button type="button" className="rx-btn rx-btn-ghost">
                  <Library size={13} />
                  正则库
                </button>
              </PopoverTrigger>
              <PopoverContent className="rx-preset-content" align="end" sideOffset={6}>
                <div className="rx-preset-search">
                  <Search size={13} aria-hidden="true" />
                  <input
                    className="rx-preset-search-input"
                    value={presetQuery}
                    onChange={(e) => setPresetQuery(e.target.value)}
                    placeholder="搜索名称或说明"
                    aria-label="搜索正则库"
                    spellCheck={false}
                  />
                </div>
                <div className="rx-preset-list">
                  {presetGroups.length === 0 && (
                    <div className="rx-preset-empty">没有匹配的预设</div>
                  )}
                  {presetGroups.map((category) => (
                    <div key={category.id} className="rx-preset-category">
                      <div className="rx-preset-category-name">{category.name}</div>
                      {category.presets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className="rx-preset-item"
                          onClick={() => applyPreset(preset)}
                        >
                          <span className="rx-preset-name">{preset.name}</span>
                          <code className="rx-preset-pattern">
                            {`/${preset.pattern}/${preset.flags}`}
                          </code>
                          <span className="rx-preset-desc">{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="rx-pattern-row">
            <span className="rx-regex-delimiter">/</span>
            <input
              id="rx-pattern"
              className="rx-pattern-input"
              value={pattern}
              onChange={(e) => {
                setPattern(e.target.value)
                setActiveIndex(0)
              }}
              placeholder="输入正则，例如 \d+"
              spellCheck={false}
              autoFocus
              aria-invalid={compiled.error !== ''}
              aria-describedby={compiled.error ? 'rx-pattern-error' : undefined}
            />
            <span className="rx-regex-delimiter">/</span>
            <span className="rx-flags-display">{flags || ' '}</span>
          </div>

          <div className="rx-literal-row">
            <code className="rx-literal" title="JavaScript 正则字面量">
              {pattern ? literal : '—'}
            </code>
            <button
              type="button"
              className="rx-btn rx-btn-ghost rx-btn-sm"
              disabled={!pattern}
              onClick={() => void copyText('literal', literal)}
            >
              {copied('literal') ? <Check size={13} /> : <Copy size={13} />}
              {copied('literal') ? '已复制' : '复制字面量'}
            </button>
          </div>

          <div className="rx-flags" role="group" aria-label="正则标志">
            {FLAG_OPTIONS.map(({ flag, label, hint }) => {
              const active = flags.includes(flag)
              return (
                <button
                  key={flag}
                  type="button"
                  className={`rx-flag${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() => handleToggleFlag(flag)}
                  title={hint}
                >
                  {flag}
                  <span className="rx-flag-label">{label}</span>
                </button>
              )
            })}
          </div>
          <p className="rx-hint">g 与 y 互斥，开启其中一个会关闭另一个。</p>

          {compiled.error && (
            <div id="rx-pattern-error" className="rx-error">
              {compiled.error}
            </div>
          )}
        </div>

        {/* Test string */}
        <div className="rx-input-group">
          <div className="rx-input-header">
            <label className="rx-label" htmlFor="rx-text">
              测试文本
            </label>
            <div className="rx-mode-switch" role="group" aria-label="工作模式">
              <button
                type="button"
                className={`rx-mode-btn${mode === 'match' ? ' active' : ''}`}
                aria-pressed={mode === 'match'}
                onClick={() => setMode('match')}
              >
                匹配
              </button>
              <button
                type="button"
                className={`rx-mode-btn${mode === 'replace' ? ' active' : ''}`}
                aria-pressed={mode === 'replace'}
                onClick={() => setMode('replace')}
              >
                替换
              </button>
            </div>
          </div>

          <TextFileBar
            value={testString}
            onOpened={(f) => {
              setTestString(f.content)
              setActiveIndex(0)
            }}
            onNew={() => {
              setTestString('')
              setActiveIndex(0)
            }}
            suggestedName="regex-test.txt"
          />

          <textarea
            id="rx-text"
            className="rx-textarea"
            value={testString}
            onChange={(e) => {
              setTestString(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="输入要测试的文本..."
            rows={6}
            spellCheck={false}
          />
        </div>

        {/* Replacement (replace mode) */}
        {mode === 'replace' && (
          <div className="rx-input-group">
            <label className="rx-label" htmlFor="rx-replacement">
              替换为
            </label>
            <input
              id="rx-replacement"
              className="rx-replace-input"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="例如 $2-$1"
              spellCheck={false}
            />
            <ul className="rx-syntax-hints" aria-label="替换语法">
              {REPLACE_SYNTAX.map(({ token, desc }) => (
                <li key={token}>
                  <code>{token}</code>
                  <span>{desc}</span>
                </li>
              ))}
            </ul>
            {regex && !flags.includes('g') && (
              <div className="rx-notice">未开启 g 标志，仅替换第一处匹配。</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="rx-actions">
          <button type="button" className="rx-btn rx-btn-ghost" onClick={clearAll}>
            <RotateCcw size={14} />
            清空
          </button>
        </div>

        {/* Match results */}
        {mode === 'match' && regex && !testString && (
          <div className="rx-no-match">输入测试文本以查看匹配</div>
        )}

        {mode === 'match' && collected && (
          <>
            <div className="rx-result-section">
              <div className="rx-result-header">
                <span className="rx-result-title">匹配结果</span>
                {matchCount > 0 && (
                  <div className="rx-nav">
                    <button
                      type="button"
                      className="rx-icon-btn"
                      aria-label="上一个匹配"
                      disabled={current <= 0}
                      onClick={() => goTo(current - 1)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="rx-nav-pos">
                      第 <span className="rx-count">{current + 1}</span> / 共 {matchCount} 个
                    </span>
                    <button
                      type="button"
                      className="rx-icon-btn"
                      aria-label="下一个匹配"
                      disabled={current >= matchCount - 1}
                      onClick={() => goTo(current + 1)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {collected.truncated && (
                <div className="rx-notice">
                  匹配数超过 {MAX_MATCHES}，仅显示前 {MAX_MATCHES} 个。
                </div>
              )}

              {matchCount === 0 ? (
                <div className="rx-no-match">没有匹配结果</div>
              ) : (
                <div className="rx-highlight-box">
                  {segments.map((seg, i) => {
                    if (seg.kind === 'plain') return <span key={i}>{seg.text}</span>
                    const matchIndex = seg.matchIndex ?? 0
                    const isCurrent = matchIndex === current
                    const isFirst = segments[i - 1]?.matchIndex !== seg.matchIndex
                    const classes = [
                      'rx-hl',
                      `rx-hl-${matchIndex % 2}`,
                      isCurrent ? 'rx-hl-current' : '',
                      seg.groupIndex !== undefined ? 'rx-hl-group' : '',
                      seg.text === '' ? 'rx-hl-empty' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <mark
                        key={i}
                        className={classes}
                        ref={isCurrent && isFirst ? currentRef : undefined}
                      >
                        {isFirst && (
                          <span className="rx-hl-badge" aria-hidden="true">
                            {matchIndex + 1}
                          </span>
                        )}
                        {seg.text}
                      </mark>
                    )
                  })}
                </div>
              )}
            </div>

            {currentMatch && (
              <div className="rx-result-section">
                <div className="rx-result-header">
                  <span className="rx-result-title">
                    当前匹配 <span className="rx-count">#{current + 1}</span>
                    <span className="rx-muted"> · 位置 {currentMatch.index}</span>
                  </span>
                  <button
                    type="button"
                    className="rx-btn rx-btn-ghost rx-btn-sm"
                    onClick={() => void copyText('current', currentMatch.value)}
                  >
                    {copied('current') ? <Check size={13} /> : <Copy size={13} />}
                    {copied('current') ? '已复制' : '复制匹配'}
                  </button>
                </div>
                <GroupTable
                  match={currentMatch}
                  activeGroup={activeGroup}
                  showRanges={hasIndices}
                  onSelect={setActiveGroup}
                />
              </div>
            )}

            {matchList && matchList.length > 0 && (
              <div className="rx-result-section">
                <div className="rx-result-header">
                  <span className="rx-result-title">匹配列表</span>
                  <button
                    type="button"
                    className="rx-btn rx-btn-ghost rx-btn-sm"
                    onClick={() =>
                      void copyText(
                        'matches',
                        JSON.stringify(
                          matchList.map((m) => m.value),
                          null,
                          2
                        )
                      )
                    }
                  >
                    {copied('matches') ? <Check size={13} /> : <Copy size={13} />}
                    {copied('matches') ? '已复制' : '复制全部'}
                  </button>
                </div>
                <ol className="rx-match-list">
                  {matchList.slice(0, LIST_LIMIT).map((m, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className={`rx-match-item${i === current ? ' is-active' : ''}`}
                        aria-current={i === current ? 'true' : undefined}
                        onClick={() => goTo(i)}
                      >
                        <span className="rx-match-index">#{i + 1}</span>
                        <code className="rx-match-value">{m.value || '(空匹配)'}</code>
                        <span className="rx-match-pos">@{m.index}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {matchList.length > LIST_LIMIT && (
                  <div className="rx-muted rx-table-note">
                    列表仅显示前 {LIST_LIMIT} 条，导航可访问全部匹配。
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Replace result */}
        {mode === 'replace' && replaced && (
          <div className="rx-result-section">
            <div className="rx-result-header">
              <span className="rx-result-title">
                替换结果 <span className="rx-count">已替换 {replaced.count} 处</span>
              </span>
              <button
                type="button"
                className="rx-btn rx-btn-ghost rx-btn-sm"
                onClick={() => void copyText('replace', replaced.output)}
              >
                {copied('replace') ? <Check size={13} /> : <Copy size={13} />}
                {copied('replace') ? '已复制' : '复制结果'}
              </button>
            </div>
            {replaced.error && <div className="rx-notice">{replaced.error}</div>}
            <div className="rx-highlight-box rx-replace-result">{replaced.output}</div>
          </div>
        )}
      </div>
    </div>
  )
}
