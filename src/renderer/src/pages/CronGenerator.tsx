import { Copy, Check, RefreshCw } from 'lucide-react'
import { useCronGenerator, type Frequency } from '@renderer/tools/cron-generator/useCronGenerator'

const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'every-minute', label: '每分钟' },
  { id: 'hourly', label: '每小时' },
  { id: 'daily', label: '每天' },
  { id: 'weekly', label: '每周' },
  { id: 'monthly', label: '每月' },
  { id: 'custom', label: '自定义' }
]

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export default function CronGenerator(): React.JSX.Element {
  const {
    mode,
    setMode,
    frequency,
    config,
    parserInput,
    setParserInput,
    toast,
    nextRunCount,
    setNextRunCount,
    cronExpression,
    description,
    nextRuns,
    parsedConfig,
    parsedDescription,
    parsedNextRuns,
    applyFrequency,
    applyTemplate,
    updateMinute,
    updateHour,
    updateDayOfMonth,
    updateMonth,
    toggleDayOfWeek,
    selectAllWeekdays,
    selectAllDays,
    reset,
    copyCron,
    copyParserCron,
    WEEKDAYS,
    QUICK_TEMPLATES
  } = useCronGenerator()

  const renderField = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void,
    min: number,
    max: number
  ): React.JSX.Element => {
    const isPreset = value === '*' || value.startsWith('*/')
    return (
      <div className="cron-field">
        <span className="cron-field-label">{label}</span>
        <div className="cron-field-controls">
          <div className="cron-chips">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`cron-chip ${value === opt.value ? 'active' : ''}`}
                onClick={() => onChange(opt.value)}
                aria-pressed={value === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="cron-number">
            <span>指定</span>
            <input
              className="tool-input cron-number-input"
              type="number"
              min={min}
              max={max}
              value={isPreset ? '' : value}
              onChange={(e) => onChange(e.target.value || String(min))}
              placeholder="—"
              aria-label={`${label} 指定值`}
            />
          </label>
        </div>
      </div>
    )
  }

  const renderNextRuns = (dates: Date[], countControl?: React.JSX.Element): React.JSX.Element => (
    <div className="cron-runs">
      {countControl && <div className="cron-runs-head">{countControl}</div>}
      {dates.length > 0 ? (
        <div className="tool-rows">
          {dates.map((date, index) => (
            <div key={index} className="tool-row cron-run-row">
              <span className="cron-run-index">{index + 1}</span>
              <span className="cron-run-time">{formatDate(date)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="cron-empty">没有可用的执行时间。</div>
      )}
    </div>
  )

  const renderGenerator = (): React.JSX.Element => (
    <div className="tool-split cron-layout">
      <section className="tool-panel cron-config">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">配置</h3>
          <button type="button" className="tool-btn" onClick={reset}>
            <RefreshCw size={13} aria-hidden="true" />
            重置
          </button>
        </div>

        <div className="cron-templates">
          <span className="cron-field-label">模板</span>
          <div className="cron-chips">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="cron-chip"
                onClick={() => applyTemplate(tpl.cron)}
                title={tpl.cron}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cron-field">
          <span className="cron-field-label">频率</span>
          <div className="cron-chips">
            {FREQUENCIES.map((freq) => (
              <button
                key={freq.id}
                type="button"
                className={`cron-chip ${frequency === freq.id ? 'active' : ''}`}
                onClick={() => applyFrequency(freq.id)}
                aria-pressed={frequency === freq.id}
              >
                {freq.label}
              </button>
            ))}
          </div>
        </div>

        {renderField(
          '分钟',
          config.minute,
          [
            { value: '*', label: '每分钟' },
            { value: '*/5', label: '每 5 分' },
            { value: '*/15', label: '每 15 分' },
            { value: '*/30', label: '每 30 分' }
          ],
          updateMinute,
          0,
          59
        )}
        {renderField(
          '小时',
          config.hour,
          [
            { value: '*', label: '每小时' },
            { value: '*/2', label: '每 2 时' },
            { value: '*/6', label: '每 6 时' },
            { value: '*/12', label: '每 12 时' }
          ],
          updateHour,
          0,
          23
        )}
        {renderField(
          '日期',
          config.dayOfMonth,
          [
            { value: '*', label: '每天' },
            { value: '1', label: '1 号' },
            { value: '15', label: '15 号' }
          ],
          updateDayOfMonth,
          1,
          31
        )}
        {renderField(
          '月份',
          config.month,
          [
            { value: '*', label: '每月' },
            { value: '1', label: '1 月' },
            { value: '6', label: '6 月' },
            { value: '12', label: '12 月' }
          ],
          updateMonth,
          1,
          12
        )}

        <div className="cron-field">
          <span className="cron-field-label">星期</span>
          <div className="cron-field-controls">
            <div className="cron-weekdays">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  className={`cron-weekday ${config.dayOfWeek.includes(day.id) ? 'active' : ''}`}
                  onClick={() => toggleDayOfWeek(day.id)}
                  aria-pressed={config.dayOfWeek.includes(day.id)}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <div className="cron-chips">
              <button type="button" className="cron-chip" onClick={selectAllWeekdays}>
                工作日
              </button>
              <button type="button" className="cron-chip" onClick={selectAllDays}>
                全部
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="cron-summary">
        <section className="tool-panel cron-expression-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">Cron 表达式</h3>
            <button type="button" className="tool-btn" onClick={copyCron}>
              {toast ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {toast || '复制'}
            </button>
          </div>
          <div className="cron-expression">
            <code>{cronExpression}</code>
          </div>
          <p className="cron-description">{description}</p>
        </section>

        <section className="tool-panel cron-preview">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">执行预览</h3>
            <div className="tool-segmented" role="group" aria-label="预览次数">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`tool-seg ${nextRunCount === count ? 'active' : ''}`}
                  onClick={() => setNextRunCount(count)}
                  aria-pressed={nextRunCount === count}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          {renderNextRuns(nextRuns)}
        </section>
      </div>
    </div>
  )

  const renderParser = (): React.JSX.Element => (
    <>
      <section className="tool-panel cron-parser-input">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">Cron 表达式</h3>
          <button type="button" className="tool-btn" onClick={copyParserCron}>
            {toast ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {toast || '复制'}
          </button>
        </div>
        <div className="cron-parser-body">
          <input
            className="tool-input tool-input--lg tool-input--mono cron-parser-field"
            type="text"
            value={parserInput}
            onChange={(e) => setParserInput(e.target.value)}
            placeholder="* * * * *"
            spellCheck={false}
            aria-label="Cron 表达式"
          />
          <span className="cron-parser-hint">分 时 日 月 周</span>
        </div>
        {!parsedConfig && parserInput && (
          <p className="cron-error" role="status">
            无效的 Cron 表达式，请输入 5 个字段（分 时 日 月 周）。
          </p>
        )}
      </section>

      {parsedConfig && (
        <div className="tool-split tool-split--even cron-parser-results">
          <section className="tool-panel cron-parsed">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">字段解析</h3>
            </div>
            <div className="tool-rows">
              {[
                { label: 'Minute', value: parsedConfig.minute },
                { label: 'Hour', value: parsedConfig.hour },
                { label: 'Day', value: parsedConfig.dayOfMonth },
                { label: 'Month', value: parsedConfig.month },
                {
                  label: 'Weekday',
                  value:
                    parsedConfig.dayOfWeek.length === 0 ? '*' : parsedConfig.dayOfWeek.join(', ')
                }
              ].map((field) => (
                <div key={field.label} className="tool-row cron-parsed-row">
                  <span className="cron-parsed-label">{field.label}</span>
                  <code className="cron-parsed-value">{field.value}</code>
                </div>
              ))}
            </div>
            <p className="cron-description cron-parsed-desc">{parsedDescription}</p>
          </section>

          <section className="tool-panel cron-preview">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">接下来 5 次</h3>
            </div>
            {renderNextRuns(parsedNextRuns)}
          </section>
        </div>
      )}
    </>
  )

  return (
    <div className="cron-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">Cron Generator</h2>
          <p className="tool-page-desc">
            可视化生成 Cron 表达式，或解析现有表达式并预览接下来的执行时间。
          </p>
        </div>
      </header>

      <section className="tool-panel cron-modebar">
        <div className="cron-modebar-row">
          <div className="tool-segmented" role="group" aria-label="模式">
            <button
              type="button"
              className={`tool-seg ${mode === 'generator' ? 'active' : ''}`}
              onClick={() => setMode('generator')}
              aria-pressed={mode === 'generator'}
            >
              生成
            </button>
            <button
              type="button"
              className={`tool-seg ${mode === 'parser' ? 'active' : ''}`}
              onClick={() => setMode('parser')}
              aria-pressed={mode === 'parser'}
            >
              解析
            </button>
          </div>
          <span className="cron-modebar-hint">
            {mode === 'generator'
              ? '选择频率或逐字段调整，右侧实时更新表达式。'
              : '粘贴 5 段式 Cron 表达式，自动拆分字段。'}
          </span>
        </div>
      </section>

      {mode === 'generator' ? renderGenerator() : renderParser()}

      {toast && (
        <div className="cron-toast" role="status">
          <Check size={14} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
