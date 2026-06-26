import { useState, useEffect, useCallback } from 'react'
import { Settings, Palette, RotateCcw, RefreshCw, Download, FileText, X } from 'lucide-react'
import { useSettings } from '@renderer/lib/contexts'
import { useUpdater } from '@renderer/lib/updater-context'
import '../styles/settings.css'

export default function SettingsPage(): React.JSX.Element {
  const { settings, updateAppearance, updateEditor, updateUpdater, updateTranslator, updateNpmRegistry, resetToDefaults } = useSettings()
  const {
    status,
    version,
    isChecking,
    isDownloading,
    isAvailable,
    isDownloaded,
    hasError,
    releaseNotes,
    releaseDate,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall
  } = useUpdater()

  const [showNotes, setShowNotes] = useState(false)
  const [testResult, setTestResult] = useState('未测试')
  const [testing, setTesting] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])

  // Auto-fetch models on mount if config exists
  useEffect(() => {
    const { baseUrl, apiKey } = settings.translator
    if (baseUrl && apiKey) {
      window.translator.testConnection().then((res) => {
        if (res.success && res.models) setFetchedModels(res.models)
      }).catch(() => { /* ignore */ })
    }
  }, [settings.translator.baseUrl, settings.translator.apiKey])

  const modelOptions = (() => {
    const current = settings.translator.model
    const all = [...new Set([...fetchedModels, current])].filter(Boolean).sort()
    return all
  })()

  const testConnection = useCallback(async () => {
    setTesting(true)
    setTestResult('测试中...')
    try {
      const result = await window.translator.testConnection()
      if (result.success) {
        setTestResult(`✅ 连接成功 (${result.models?.length || 0} 个可用模型)`)
        if (result.models) setFetchedModels(result.models)
      } else {
        setTestResult(`❌ ${result.error}`)
      }
    } catch {
      setTestResult('❌ 测试失败')
    } finally {
      setTesting(false)
    }
  }, [])

  const formatReleaseDate = useCallback((date?: string): string => {
    if (!date) return ''
    try {
      return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return date
    }
  }, [])

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h2 className="settings-title">设置</h2>
          <p className="settings-subtitle">自定义你的开发工具</p>
        </div>

        <div className="settings-content">
          {/* 外观设置 */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <Palette size={18} className="settings-section-icon" />
              外观
            </h3>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">主题</p>
                <p className="settings-item-description">选择应用的外观主题</p>
              </div>
              <div className="settings-segmented">
                <button
                  className={`settings-option ${settings.appearance.theme === 'light' ? 'active' : ''}`}
                  onClick={() => updateAppearance({ theme: 'light' })}
                >
                  <span className="settings-option-label">浅色</span>
                </button>
                <button
                  className={`settings-option ${settings.appearance.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => updateAppearance({ theme: 'dark' })}
                >
                  <span className="settings-option-label">深色</span>
                </button>
                <button
                  className={`settings-option ${settings.appearance.theme === 'system' ? 'active' : ''}`}
                  onClick={() => updateAppearance({ theme: 'system' })}
                >
                  <span className="settings-option-label">跟随系统</span>
                </button>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">字体大小</p>
                <p className="settings-item-description">调整应用的字体大小</p>
              </div>
              <div className="settings-segmented">
                <button
                  className={`settings-option ${settings.appearance.fontSize === 'small' ? 'active' : ''}`}
                  onClick={() => updateAppearance({ fontSize: 'small' })}
                >
                  <span className="settings-option-label">小</span>
                </button>
                <button
                  className={`settings-option ${settings.appearance.fontSize === 'medium' ? 'active' : ''}`}
                  onClick={() => updateAppearance({ fontSize: 'medium' })}
                >
                  <span className="settings-option-label">中</span>
                </button>
                <button
                  className={`settings-option ${settings.appearance.fontSize === 'large' ? 'active' : ''}`}
                  onClick={() => updateAppearance({ fontSize: 'large' })}
                >
                  <span className="settings-option-label">大</span>
                </button>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">侧边栏</p>
                <p className="settings-item-description">启动时侧边栏的默认状态</p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={!settings.appearance.sidebarCollapsed}
                  onChange={(e) => updateAppearance({ sidebarCollapsed: !e.target.checked })}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>
          </div>

          {/* 编辑器设置 */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <Settings size={18} className="settings-section-icon" />
              编辑器
            </h3>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">JSON 缩进</p>
                <p className="settings-item-description">格式化 JSON 时使用的缩进空格数</p>
              </div>
              <div className="settings-segmented">
                <button
                  className={`settings-option ${settings.editor.jsonIndent === 2 ? 'active' : ''}`}
                  onClick={() => updateEditor({ jsonIndent: 2 })}
                >
                  <span className="settings-option-label">2空格</span>
                </button>
                <button
                  className={`settings-option ${settings.editor.jsonIndent === 4 ? 'active' : ''}`}
                  onClick={() => updateEditor({ jsonIndent: 4 })}
                >
                  <span className="settings-option-label">4空格</span>
                </button>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">自动复制</p>
                <p className="settings-item-description">生成结果后自动复制到剪贴板</p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.editor.autoCopy}
                  onChange={(e) => updateEditor({ autoCopy: e.target.checked })}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>
          </div>

          {/* AI 翻译设置 */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="settings-section-icon" style={{ fontSize: 18 }}>🤖</span>
              AI 翻译
            </h3>

            <div className="settings-item settings-item-column">
              <div className="settings-item-info">
                <p className="settings-item-label">Base URL</p>
                <p className="settings-item-description">
                  支持 OpenAI 兼容 API（NewAPI / OpenAI / Azure 等）
                </p>
              </div>
              <input
                className="settings-input"
                type="text"
                value={settings.translator.baseUrl}
                onChange={(e) => updateTranslator({ baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="settings-item settings-item-column">
              <div className="settings-item-info">
                <p className="settings-item-label">API Key</p>
                <p className="settings-item-description">密钥仅存储在本地，不会上传</p>
              </div>
              <input
                className="settings-input"
                type="password"
                value={settings.translator.apiKey}
                onChange={(e) => updateTranslator({ apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Model</p>
                <p className="settings-item-description">
                  {fetchedModels.length > 0
                    ? `${fetchedModels.length} 个可用模型`
                    : '配置 URL 和 Key 后自动获取模型列表'}
                </p>
              </div>
              <select
                className="settings-select"
                value={settings.translator.model}
                onChange={(e) => updateTranslator({ model: e.target.value })}
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="settings-item settings-item-column">
              <div className="settings-item-info">
                <p className="settings-item-label">System Prompt</p>
                <p className="settings-item-description">
                  自定义翻译提示词。{' '}
                  <code>{'{sourceLang}'}</code> = 源语言，{' '}
                  <code>{'{targetLang}'}</code> = 目标语言
                </p>
              </div>
              <textarea
                className="settings-textarea"
                value={settings.translator.systemPrompt}
                onChange={(e) => updateTranslator({ systemPrompt: e.target.value })}
                rows={4}
              />
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Temperature</p>
                <p className="settings-item-description">
                  随机性 (0-2)，翻译建议 0.1-0.3
                </p>
              </div>
              <input
                className="settings-input settings-input-sm"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={settings.translator.temperature}
                onChange={(e) => updateTranslator({ temperature: parseFloat(e.target.value) || 0.3 })}
              />
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Max Tokens</p>
                <p className="settings-item-description">
                  最大输出长度 (1-16384)，长文本翻译可调大
                </p>
              </div>
              <input
                className="settings-input settings-input-sm"
                type="number"
                min={1}
                max={16384}
                step={256}
                value={settings.translator.maxTokens}
                onChange={(e) => updateTranslator({ maxTokens: parseInt(e.target.value) || 4096 })}
              />
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">连接状态</p>
                <p className="settings-item-description">{testResult}</p>
              </div>
              <button
                className="settings-btn settings-btn-secondary"
                onClick={testConnection}
                disabled={!settings.translator.baseUrl || !settings.translator.apiKey || testing}
              >
                {testing ? '测试中...' : '🔗 测试连接'}
              </button>
            </div>
          </div>

          {/* npm 源设置 */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="settings-section-icon" style={{ fontSize: 18 }}>📦</span>
              npm Registry
            </h3>

            <div className="settings-item settings-item-column">
              <div className="settings-item-info">
                <p className="settings-item-label">自定义 npm 源</p>
                <p className="settings-item-description">
                  留空则依次尝试 registry.npmjs.org → npmmirror.com
                </p>
              </div>
              <input
                className="settings-input"
                type="text"
                value={settings.npmRegistry}
                onChange={(e) => updateNpmRegistry(e.target.value)}
                placeholder="https://registry.npmjs.org"
              />
            </div>
          </div>

          {/* 更新设置 */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <RefreshCw size={18} className="settings-section-icon" />
              更新
            </h3>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">自动检查更新</p>
                <p className="settings-item-description">启动时自动检查新版本</p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.updater.autoCheck}
                  onChange={(e) => updateUpdater({ autoCheck: e.target.checked })}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">当前版本</p>
                <p className="settings-item-description">{version || '加载中...'}</p>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">状态</p>
                <p className={`settings-item-description ${hasError ? 'updater-error' : ''}`}>
                  {isChecking && '正在检查更新...'}
                  {status.type === 'not-available' && '✓ 已是最新版本'}
                  {isAvailable && `发现新版本 ${status.type === 'available' ? status.version : ''}`}
                  {isDownloading && status.type === 'downloading' && `下载中 ${status.percent}%`}
                  {isDownloaded && '下载完成，重启应用以安装更新'}
                  {hasError && status.type === 'error' && `✗ ${status.message}`}
                </p>
              </div>
              {isAvailable && (releaseNotes || releaseDate) && (
                <button className="settings-link-btn" onClick={() => setShowNotes(true)}>
                  <FileText size={13} />
                  更新说明
                </button>
              )}
            </div>

            {isDownloading && status.type === 'downloading' && (
              <div className="updater-progress">
                <div className="updater-progress-bar" style={{ width: `${status.percent}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <div className="updater-actions">
            {!isAvailable && !isDownloading && !isDownloaded && (
              <button
                className="settings-btn settings-btn-primary"
                onClick={checkForUpdates}
                disabled={isChecking}
              >
                <RefreshCw size={15} className={isChecking ? 'updater-spin' : ''} />
                检查更新
              </button>
            )}
            {isAvailable && (
              <>
                <button className="settings-btn settings-btn-primary" onClick={downloadUpdate}>
                  <Download size={15} />
                  下载更新
                </button>
                {(releaseNotes || releaseDate) && (
                  <button className="settings-btn settings-btn-secondary" onClick={() => setShowNotes(true)}>
                    <FileText size={13} />
                    更新说明
                  </button>
                )}
              </>
            )}
            {isDownloaded && (
              <button className="settings-btn settings-btn-primary" onClick={quitAndInstall}>
                重启并安装
              </button>
            )}
          </div>
          <button className="settings-btn settings-btn-secondary" onClick={resetToDefaults}>
            <RotateCcw size={15} />
            恢复默认
          </button>
        </div>
      </div>

      {/* Release Notes Modal */}
      {showNotes && (releaseNotes || releaseDate) && (
        <div className="settings-overlay" onClick={() => setShowNotes(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                <FileText size={16} />
                版本更新说明
              </h3>
              <button className="settings-modal-close" onClick={() => setShowNotes(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="settings-modal-body">
              {releaseDate && (
                <div className="settings-modal-date">
                  发布日期：{formatReleaseDate(releaseDate)}
                </div>
              )}
              {releaseNotes ? (
                <div className="settings-modal-notes" dangerouslySetInnerHTML={{ __html: releaseNotes }} />
              ) : (
                <div className="settings-modal-empty">暂无详细更新说明</div>
              )}
            </div>
            <div className="settings-modal-footer">
              <button className="settings-btn settings-btn-primary" onClick={() => { downloadUpdate(); setShowNotes(false) }}>
                <Download size={14} />
                下载更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
