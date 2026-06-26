import { Copy, Check, RefreshCw, Clock, Calendar, Timer, Zap, Settings } from 'lucide-react'
import { useCronGenerator, type Frequency } from '@renderer/tools/cron-generator/useCronGenerator'

const FREQUENCIES: {
  id: Frequency
  label: string
  icon: React.ComponentType<{ size?: number }>
}[] = [
  { id: 'every-minute', label: '每分钟', icon: Zap },
  { id: 'hourly', label: '每小时', icon: Timer },
  { id: 'daily', label: '每天', icon: Clock },
  { id: 'weekly', label: '每周', icon: Calendar },
  { id: 'monthly', label: '每月', icon: Calendar },
  { id: 'custom', label: '自定义', icon: Settings }
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

  const renderGenerator = (): React.JSX.Element => (
    <div className="cron-generator-content">
      {/* 快捷模板 */}
      <div className="cron-section">
        <div className="cron-section-header">
          <span className="cron-section-label">快捷模板</span>
        </div>
        <div className="cron-templates">
          {QUICK_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              className="cron-template-btn"
              onClick={() => applyTemplate(tpl.cron)}
              title={tpl.cron}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* 执行频率 */}
      <div className="cron-section">
        <div className="cron-section-header">
          <span className="cron-section-label">执行频率</span>
        </div>
        <div className="cron-frequencies">
          {FREQUENCIES.map((freq) => {
            const Icon = freq.icon
            return (
              <button
                key={freq.id}
                className={`cron-freq-btn ${frequency === freq.id ? 'active' : ''}`}
                onClick={() => applyFrequency(freq.id)}
              >
                <Icon size={14} />
                <span>{freq.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 可视化配置 */}
      <div className="cron-section">
        <div className="cron-section-header">
          <span className="cron-section-label">详细配置</span>
        </div>

        {/* 分钟 */}
        <div className="cron-field">
          <label className="cron-field-label">分钟 (0-59)</label>
          <div className="cron-field-options">
            <button
              className={`cron-field-btn ${config.minute === '*' ? 'active' : ''}`}
              onClick={() => updateMinute('*')}
            >
              每分钟
            </button>
            <button
              className={`cron-field-btn ${config.minute === '*/5' ? 'active' : ''}`}
              onClick={() => updateMinute('*/5')}
            >
              每5分钟
            </button>
            <button
              className={`cron-field-btn ${config.minute === '*/15' ? 'active' : ''}`}
              onClick={() => updateMinute('*/15')}
            >
              每15分钟
            </button>
            <button
              className={`cron-field-btn ${config.minute === '*/30' ? 'active' : ''}`}
              onClick={() => updateMinute('*/30')}
            >
              每30分钟
            </button>
            <div className="cron-field-input-group">
              <span className="cron-field-input-label">指定:</span>
              <input
                className="cron-field-input"
                type="number"
                min="0"
                max="59"
                value={config.minute === '*' || config.minute.startsWith('*/') ? '' : config.minute}
                onChange={(e) => updateMinute(e.target.value || '0')}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* 小时 */}
        <div className="cron-field">
          <label className="cron-field-label">小时 (0-23)</label>
          <div className="cron-field-options">
            <button
              className={`cron-field-btn ${config.hour === '*' ? 'active' : ''}`}
              onClick={() => updateHour('*')}
            >
              每小时
            </button>
            <button
              className={`cron-field-btn ${config.hour === '*/2' ? 'active' : ''}`}
              onClick={() => updateHour('*/2')}
            >
              每2小时
            </button>
            <button
              className={`cron-field-btn ${config.hour === '*/6' ? 'active' : ''}`}
              onClick={() => updateHour('*/6')}
            >
              每6小时
            </button>
            <button
              className={`cron-field-btn ${config.hour === '*/12' ? 'active' : ''}`}
              onClick={() => updateHour('*/12')}
            >
              每12小时
            </button>
            <div className="cron-field-input-group">
              <span className="cron-field-input-label">指定:</span>
              <input
                className="cron-field-input"
                type="number"
                min="0"
                max="23"
                value={config.hour === '*' || config.hour.startsWith('*/') ? '' : config.hour}
                onChange={(e) => updateHour(e.target.value || '0')}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* 日期 */}
        <div className="cron-field">
          <label className="cron-field-label">日期 (1-31)</label>
          <div className="cron-field-options">
            <button
              className={`cron-field-btn ${config.dayOfMonth === '*' ? 'active' : ''}`}
              onClick={() => updateDayOfMonth('*')}
            >
              每天
            </button>
            <button
              className={`cron-field-btn ${config.dayOfMonth === '1' ? 'active' : ''}`}
              onClick={() => updateDayOfMonth('1')}
            >
              1号
            </button>
            <button
              className={`cron-field-btn ${config.dayOfMonth === '15' ? 'active' : ''}`}
              onClick={() => updateDayOfMonth('15')}
            >
              15号
            </button>
            <div className="cron-field-input-group">
              <span className="cron-field-input-label">指定:</span>
              <input
                className="cron-field-input"
                type="number"
                min="1"
                max="31"
                value={config.dayOfMonth === '*' ? '' : config.dayOfMonth}
                onChange={(e) => updateDayOfMonth(e.target.value || '1')}
                placeholder="1"
              />
            </div>
          </div>
        </div>

        {/* 月份 */}
        <div className="cron-field">
          <label className="cron-field-label">月份 (1-12)</label>
          <div className="cron-field-options">
            <button
              className={`cron-field-btn ${config.month === '*' ? 'active' : ''}`}
              onClick={() => updateMonth('*')}
            >
              每月
            </button>
            <button
              className={`cron-field-btn ${config.month === '1' ? 'active' : ''}`}
              onClick={() => updateMonth('1')}
            >
              1月
            </button>
            <button
              className={`cron-field-btn ${config.month === '6' ? 'active' : ''}`}
              onClick={() => updateMonth('6')}
            >
              6月
            </button>
            <button
              className={`cron-field-btn ${config.month === '12' ? 'active' : ''}`}
              onClick={() => updateMonth('12')}
            >
              12月
            </button>
            <div className="cron-field-input-group">
              <span className="cron-field-input-label">指定:</span>
              <input
                className="cron-field-input"
                type="number"
                min="1"
                max="12"
                value={config.month === '*' ? '' : config.month}
                onChange={(e) => updateMonth(e.target.value || '1')}
                placeholder="1"
              />
            </div>
          </div>
        </div>

        {/* 星期 */}
        <div className="cron-field">
          <label className="cron-field-label">星期</label>
          <div className="cron-weekdays">
            {WEEKDAYS.map((day) => (
              <button
                key={day.id}
                className={`cron-weekday-btn ${config.dayOfWeek.includes(day.id) ? 'active' : ''}`}
                onClick={() => toggleDayOfWeek(day.id)}
              >
                {day.label}
              </button>
            ))}
          </div>
          <div className="cron-weekday-actions">
            <button className="cron-weekday-action" onClick={selectAllWeekdays}>
              工作日
            </button>
            <button className="cron-weekday-action" onClick={selectAllDays}>
              全部
            </button>
          </div>
        </div>
      </div>

      {/* Cron 表达式 */}
      <div className="cron-section cron-result">
        <div className="cron-section-header">
          <span className="cron-section-label">Cron 表达式</span>
          <button className="cron-copy-btn" onClick={copyCron}>
            {toast ? <Check size={14} /> : <Copy size={14} />}
            {toast || '复制'}
          </button>
        </div>
        <div className="cron-expression">
          <code>{cronExpression}</code>
        </div>
      </div>

      {/* 描述 */}
      <div className="cron-section">
        <div className="cron-section-header">
          <span className="cron-section-label">描述</span>
        </div>
        <div className="cron-description">{description}</div>
      </div>

      {/* 执行预览 */}
      <div className="cron-section">
        <div className="cron-section-header">
          <span className="cron-section-label">执行预览</span>
          <div className="cron-preview-count">
            {[5, 10, 20].map((count) => (
              <button
                key={count}
                className={`cron-count-btn ${nextRunCount === count ? 'active' : ''}`}
                onClick={() => setNextRunCount(count)}
              >
                {count}次
              </button>
            ))}
          </div>
        </div>
        <div className="cron-next-runs">
          {nextRuns.map((date, index) => (
            <div key={index} className="cron-next-run-item">
              <Clock size={14} className="cron-next-run-icon" />
              <span className="cron-next-run-time">{formatDate(date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderParser = (): React.JSX.Element => (
    <div className="cron-parser-content">
      {/* 输入 */}
      <div className="cron-section">
        <div className="cron-section-header">
          <span className="cron-section-label">输入 Cron 表达式</span>
          <button className="cron-copy-btn" onClick={copyParserCron}>
            {toast ? <Check size={14} /> : <Copy size={14} />}
            {toast || '复制'}
          </button>
        </div>
        <input
          className="cron-parser-input"
          type="text"
          value={parserInput}
          onChange={(e) => setParserInput(e.target.value)}
          placeholder="* * * * *"
          spellCheck={false}
        />
      </div>

      {/* 解析结果 */}
      {parsedConfig && (
        <>
          {/* 字段高亮 */}
          <div className="cron-section">
            <div className="cron-section-header">
              <span className="cron-section-label">字段解析</span>
            </div>
            <div className="cron-parsed-fields">
              <div className="cron-parsed-field">
                <span className="cron-parsed-field-label">Minute</span>
                <span className="cron-parsed-field-value">{parsedConfig.minute}</span>
              </div>
              <div className="cron-parsed-field">
                <span className="cron-parsed-field-label">Hour</span>
                <span className="cron-parsed-field-value">{parsedConfig.hour}</span>
              </div>
              <div className="cron-parsed-field">
                <span className="cron-parsed-field-label">Day</span>
                <span className="cron-parsed-field-value">{parsedConfig.dayOfMonth}</span>
              </div>
              <div className="cron-parsed-field">
                <span className="cron-parsed-field-label">Month</span>
                <span className="cron-parsed-field-value">{parsedConfig.month}</span>
              </div>
              <div className="cron-parsed-field">
                <span className="cron-parsed-field-label">Weekday</span>
                <span className="cron-parsed-field-value">
                  {parsedConfig.dayOfWeek.length === 0 ? '*' : parsedConfig.dayOfWeek.join(', ')}
                </span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <div className="cron-section">
            <div className="cron-section-header">
              <span className="cron-section-label">描述</span>
            </div>
            <div className="cron-description">{parsedDescription}</div>
          </div>

          {/* 执行预览 */}
          <div className="cron-section">
            <div className="cron-section-header">
              <span className="cron-section-label">执行预览</span>
            </div>
            <div className="cron-next-runs">
              {parsedNextRuns.map((date, index) => (
                <div key={index} className="cron-next-run-item">
                  <Clock size={14} className="cron-next-run-icon" />
                  <span className="cron-next-run-time">{formatDate(date)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!parsedConfig && parserInput && (
        <div className="cron-section">
          <div className="cron-error">无效的 Cron 表达式，请输入 5 个字段（分 时 日 月 周）</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="cron-page">
      <div className="cron-bg-decoration" />

      <div className="cron-container">
        <div className="cron-header">
          <h2 className="cron-title">Cron Generator</h2>
          <p className="cron-subtitle">可视化生成和解析 Cron 表达式</p>
        </div>

        {/* 模式切换 */}
        <div className="cron-mode-tabs">
          <button
            className={`cron-mode-tab ${mode === 'generator' ? 'active' : ''}`}
            onClick={() => setMode('generator')}
          >
            <Settings size={14} />
            Generator
          </button>
          <button
            className={`cron-mode-tab ${mode === 'parser' ? 'active' : ''}`}
            onClick={() => setMode('parser')}
          >
            <Timer size={14} />
            Parser
          </button>
        </div>

        {/* 重置按钮 */}
        {mode === 'generator' && (
          <div className="cron-actions">
            <button className="cron-reset-btn" onClick={reset}>
              <RefreshCw size={14} />
              重置
            </button>
          </div>
        )}

        {mode === 'generator' ? renderGenerator() : renderParser()}
      </div>

      {toast && (
        <div className="cron-toast">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
