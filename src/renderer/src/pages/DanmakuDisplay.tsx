import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Monitor, X } from 'lucide-react'
import { useDanmakuDisplay } from '../tools/danmaku-display/useDanmakuDisplay'
import type { ScrollDirection } from '../tools/danmaku-display/useDanmakuDisplay'
import '../styles/danmaku-display.css'

export default function DanmakuDisplay(): React.JSX.Element {
  const { config, update, isFullscreen, enterFullscreen, exitFullscreen } = useDanmakuDisplay()

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

  return (
    <>
      {/* ── 编辑面板 ── */}
      <div className="dd-page">
        <div className="dd-card">
          <div className="dd-header">
            <h2 className="dd-title">Danmaku Display</h2>
            <p className="dd-subtitle">全屏展示自定义消息，适合离开工位时留言</p>
          </div>

          <textarea
            className="dd-textarea"
            value={config.text}
            onChange={(e) => update('text', e.target.value)}
            placeholder="输入你要展示的消息…"
            rows={4}
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
                          {
                            left: '向左滚动',
                            right: '向右滚动',
                            up: '向上滚动',
                            down: '向下滚动'
                          }[d]
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
          </div>

          <div className="dd-preview" style={{ background: config.bgColor }}>
            <div className="dd-preview-inner">
              <span
                className={`dd-preview-text ${previewAnimClass}`}
                style={{
                  color: config.fontColor,
                  fontSize: Math.min(config.fontSize, 64)
                }}
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

          <div className={`dd-overlay-body ${config.mode === 'scroll' ? 'dd-overlay-scroll' : ''}`}>
            <span
              className={
                config.mode === 'scroll'
                  ? `dd-overlay-text ${dirAnimClass[config.direction]}`
                  : 'dd-overlay-text dd-overlay-static'
              }
              style={{
                color: config.fontColor,
                fontSize: config.fontSize,
                animationDuration: config.mode === 'scroll' ? `${speedSec}s` : undefined
              }}
            >
              {config.text.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  {i < config.text.split('\n').length - 1 && <br />}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
