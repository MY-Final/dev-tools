import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Monitor, X, Clock } from 'lucide-react'
import { useDanmakuDisplay } from '../tools/danmaku-display/useDanmakuDisplay'
import type { ScrollDirection } from '../tools/danmaku-display/useDanmakuDisplay'
import { TEMPLATES } from '../tools/danmaku-display/useDanmakuDisplay'
import '../styles/danmaku-display.css'

function formatCountdown(sec: number): string {
  if (sec <= 0) return '00:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function DanmakuDisplay(): React.JSX.Element {
  const {
    config,
    update,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    applyTemplate,
    overlayTime,
    countdownTotal
  } = useDanmakuDisplay()

  const dirIcon: Record<ScrollDirection, React.ReactNode> = {
    left: <ArrowLeft size={16} />,
    right: <ArrowRight size={16} />,
    up: <ArrowUp size={16} />,
    down: <ArrowDown size={16} />
  }

  const previewAnimClass = config.mode === 'scroll' ? `scroll-${config.direction}` : 'static'
  const speedSec = Math.round(60 - (config.speed - 1) * (52 / 9))

  const dirAnimClass: Record<ScrollDirection, string> = {
    left: 'dd-fs-scroll-left',
    right: 'dd-fs-scroll-right',
    up: 'dd-fs-scroll-up',
    down: 'dd-fs-scroll-down'
  }

  const hasReturnTime = config.returnTimeEnabled && config.returnTimeType !== 'none'

  return (
    <>
      {/* ── 编辑面板 ── */}
      <div className="dd-page">
        <div className="dd-card">
          <div className="dd-header">
            <h2 className="dd-title">Danmaku Display</h2>
            <p className="dd-subtitle">全屏展示自定义消息，适合离开工位时留言</p>
          </div>

          {/* 一键模板 */}
          <div className="dd-templates">
            {TEMPLATES.map((t) => (
              <button
                key={t.emoji + t.text}
                className="dd-template-btn"
                onClick={() => applyTemplate(t)}
              >
                <span className="dd-template-emoji">{t.emoji}</span>
                <span className="dd-template-label">{t.text}</span>
              </button>
            ))}
          </div>

          <textarea
            className="dd-textarea"
            value={config.text}
            onChange={(e) => update('text', e.target.value)}
            placeholder="输入你要展示的消息…"
            rows={3}
          />

          <div className="dd-controls">
            <div className="dd-control-row">
              <span className="dd-control-label">字体大小</span>
              <input
                type="range"
                className="dd-slider"
                min={24}
                max={200}
                value={config.fontSize}
                onChange={(e) => update('fontSize', Number(e.target.value))}
              />
              <span className="dd-slider-value">{config.fontSize}px</span>
            </div>

            <div className="dd-control-row">
              <span className="dd-control-label">字体颜色</span>
              <input
                type="color"
                className="dd-color-input"
                value={config.fontColor}
                onChange={(e) => update('fontColor', e.target.value)}
              />
              <span className="dd-control-label dd-control-label-long" style={{ marginLeft: 24 }}>
                背景颜色
              </span>
              <input
                type="color"
                className="dd-color-input"
                value={config.bgColor}
                onChange={(e) => update('bgColor', e.target.value)}
              />
            </div>

            <div className="dd-control-row">
              <span className="dd-control-label">显示模式</span>
              <div className="dd-mode-selector">
                <button
                  className={`dd-mode-btn ${config.mode === 'scroll' ? 'active' : ''}`}
                  onClick={() => update('mode', 'scroll')}
                >
                  滚动
                </button>
                <button
                  className={`dd-mode-btn ${config.mode === 'static' ? 'active' : ''}`}
                  onClick={() => update('mode', 'static')}
                >
                  静止
                </button>
              </div>
            </div>

            {config.mode === 'scroll' && (
              <>
                <div className="dd-control-row">
                  <span className="dd-control-label">滚动方向</span>
                  <div className="dd-direction-group">
                    {(['left', 'right', 'up', 'down'] as ScrollDirection[]).map((d) => (
                      <button
                        key={d}
                        className={`dd-dir-btn ${config.direction === d ? 'active' : ''}`}
                        onClick={() => update('direction', d)}
                        title={
                          { left: '向左滚动', right: '向右滚动', up: '向上滚动', down: '向下滚动' }[
                            d
                          ]
                        }
                      >
                        {dirIcon[d]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="dd-control-row">
                  <span className="dd-control-label">滚动速度</span>
                  <input
                    type="range"
                    className="dd-slider"
                    min={1}
                    max={10}
                    value={config.speed}
                    onChange={(e) => update('speed', Number(e.target.value))}
                  />
                  <span className="dd-slider-value">{config.speed}</span>
                </div>
              </>
            )}

            {/* 分隔线 */}
            <div className="dd-section-title">返回时间</div>

            <div className="dd-control-row">
              <span className="dd-control-label">启用</span>
              <label className="dd-toggle">
                <input
                  type="checkbox"
                  checked={config.returnTimeEnabled}
                  onChange={(e) => update('returnTimeEnabled', e.target.checked)}
                />
                <span className="dd-toggle-slider" />
              </label>
            </div>

            {config.returnTimeEnabled && (
              <>
                <div className="dd-control-row">
                  <span className="dd-control-label">方式</span>
                  <div className="dd-mode-selector">
                    <button
                      className={`dd-mode-btn ${config.returnTimeType === 'absolute' ? 'active' : ''}`}
                      onClick={() => update('returnTimeType', 'absolute')}
                    >
                      指定时间
                    </button>
                    <button
                      className={`dd-mode-btn ${config.returnTimeType === 'relative' ? 'active' : ''}`}
                      onClick={() => update('returnTimeType', 'relative')}
                    >
                      相对时间
                    </button>
                  </div>
                </div>

                {config.returnTimeType === 'absolute' && (
                  <div className="dd-control-row">
                    <span className="dd-control-label">预计</span>
                    <input
                      type="time"
                      className="dd-time-input"
                      value={config.returnTimeAbsolute}
                      onChange={(e) => update('returnTimeAbsolute', e.target.value)}
                    />
                    <span className="dd-hint-text">回来</span>
                  </div>
                )}

                {config.returnTimeType === 'relative' && (
                  <div className="dd-control-row">
                    <span className="dd-control-label">预计</span>
                    <input
                      type="number"
                      className="dd-number-input"
                      min={1}
                      max={1440}
                      value={config.returnTimeRelative}
                      onChange={(e) =>
                        update('returnTimeRelative', Math.max(1, Number(e.target.value)))
                      }
                    />
                    <span className="dd-hint-text">分钟后回来</span>
                  </div>
                )}
              </>
            )}

            <div className="dd-section-title">显示选项</div>

            <div className="dd-control-row">
              <label className="dd-toggle-label">
                <span className="dd-toggle-icon">
                  <Clock size={14} />
                </span>
                显示当前时间
                <input
                  type="checkbox"
                  checked={config.showClock}
                  onChange={(e) => update('showClock', e.target.checked)}
                  className="dd-toggle-inline"
                />
              </label>
            </div>
          </div>

          <div className="dd-preview" style={{ background: config.bgColor }}>
            <div className="dd-preview-inner">
              <span
                className={`dd-preview-text ${previewAnimClass}`}
                style={{ color: config.fontColor, fontSize: Math.min(config.fontSize, 64) }}
              >
                {config.text || '预览'}
              </span>
            </div>
          </div>

          <button className="dd-fullscreen-btn" onClick={enterFullscreen}>
            <Monitor size={20} />
            全屏显示
          </button>
        </div>
      </div>

      {/* ── 全屏覆盖层 ── */}
      {isFullscreen && (
        <div className="dd-overlay" style={{ background: config.bgColor }} onClick={exitFullscreen}>
          <button className="dd-overlay-close" onClick={exitFullscreen}>
            <X size={20} />
          </button>

          {/* 当前时间 */}
          {config.showClock && <div className="dd-overlay-clock">{overlayTime}</div>}

          <div className={`dd-overlay-body ${config.mode === 'scroll' ? 'dd-overlay-scroll' : ''}`}>
            {config.mode === 'scroll' ? (
              <span
                className={`dd-overlay-text ${dirAnimClass[config.direction]}`}
                style={{
                  color: config.fontColor,
                  fontSize: config.fontSize,
                  animationDuration: `${speedSec}s`
                }}
              >
                {config.text.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < config.text.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </span>
            ) : (
              <div className="dd-overlay-center">
                <span
                  className="dd-overlay-text dd-overlay-static"
                  style={{ color: config.fontColor, fontSize: config.fontSize }}
                >
                  {config.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < config.text.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </span>
                {hasReturnTime && countdownTotal > 0 && (
                  <div className="dd-overlay-countdown" style={{ color: config.fontColor }}>
                    <div className="dd-overlay-countdown-label">回来倒计时</div>
                    <div className="dd-overlay-countdown-time">
                      {formatCountdown(countdownTotal)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {config.mode === 'scroll' && hasReturnTime && countdownTotal > 0 && (
            <div
              className="dd-overlay-countdown dd-overlay-countdown-bottom"
              style={{ color: config.fontColor }}
            >
              <div className="dd-overlay-countdown-label">回来倒计时</div>
              <div className="dd-overlay-countdown-time">{formatCountdown(countdownTotal)}</div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
