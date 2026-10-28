import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Settings,
  Palette,
  RotateCcw,
  RefreshCw,
  Download,
  FileText,
  ChevronRight,
  Wifi,
  Keyboard
} from 'lucide-react'
import { useSettings } from '@renderer/lib/contexts'
import { useUpdater } from '@renderer/lib/updater-context'
import { formatShortcut } from '@renderer/lib/shortcuts'
import ShortcutRecorder from '@renderer/components/ShortcutRecorder'
import StatusMessage from '@renderer/components/StatusMessage'
import Dialog from '@renderer/components/ui/dialog'
import '../styles/settings.css'

const CURRENT_RELEASE_NOTES = `
  <h3>v1.0.17</h3>
  <ul>
    <li>新增 Todo Notes 待办记事本，支持日期、筛选和本地持久化。</li>
    <li>File to Base64 支持任意文件，并支持图片/视频/音频预览。</li>
    <li>设置页重构为左侧分组导航，Sidebar 新增快速搜索入口。</li>
    <li>优化工具页通用布局、Command Palette、Sidebar 点击区域和 Cheat Sheet 布局。</li>
    <li>修复 Unit Converter 复制按钮显示和 Unicode Inspector 字符选择交互。</li>
    <li>全量核查并修正工具分类。</li>
  </ul>
`

export default function SettingsPage(): React.JSX.Element {
  const {
    settings,
    updateAppearance,
    updateEditor,
    updateUpdater,
    updateWindow,
    updateTranslator,
    updateNpmRegistry,
    updateMavenSearchUrl,
    updateProxy,
    updateShortcuts,
    resetToDefaults
  } = useSettings()
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
  const notesTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [testResult, setTestResult] = useState('未测试')
  const [testing, setTesting] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [settingsPath, setSettingsPath] = useState('')
  const [activeSection, setActiveSection] = useState('appearance')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    appearance: false,
    editor: false,
    translator: false,
    npm: false,
    maven: false,
    proxy: false,
    shortcuts: false,
    updater: false
  })

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const selectSection = useCallback((key: string) => {
    setActiveSection(key)
    setCollapsedSections((prev) => ({ ...prev, [key]: false }))
  }, [])

  const openNotes = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    notesTriggerRef.current = event.currentTarget
    setShowNotes(true)
  }, [])

  const translatorBaseUrl = settings.translator.baseUrl
  const translatorApiKey = settings.translator.apiKey

  // Auto-fetch models on mount if config exists
  useEffect(() => {
    if (translatorBaseUrl && translatorApiKey) {
      window.translator
        .testConnection()
        .then((res) => {
          if (res.success && res.models) setFetchedModels(res.models)
        })
        .catch(() => {
          // Ignore background model discovery failures.
        })
    }
  }, [translatorApiKey, translatorBaseUrl])

  // Fetch settings.json path
  useEffect(() => {
    window.api
      .getSettingsPath()
      .then(setSettingsPath)
      .catch(() => setSettingsPath('未知'))
  }, [])

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
      return new Date(date).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return date
    }
  }, [])

  const displayedReleaseNotes = releaseNotes ?? CURRENT_RELEASE_NOTES

  const getUpdaterStatusMessage = (): string => {
    switch (status.type) {
      case 'checking':
        return '正在检查更新...'
      case 'not-available':
        return '✓ 已是最新版本'
      case 'available':
        return `发现新版本 ${status.version}`
      case 'downloading':
        return `下载中 ${status.percent}%`
      case 'downloaded':
        return '下载完成，重启应用以安装更新'
      case 'error':
        return `✗ ${status.message}`
      default:
        return '尚未检查更新'
    }
  }

  const updaterStatusMessage = getUpdaterStatusMessage()
  const updaterStatusTone: 'neutral' | 'success' | 'error' =
    status.type === 'error'
      ? 'error'
      : status.type === 'not-available' || status.type === 'downloaded'
        ? 'success'
        : 'neutral'

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h2 className="settings-title">设置</h2>
          <p className="settings-subtitle">自定义你的开发工具</p>
        </div>

        <div className="settings-layout">
          <aside className="settings-nav" aria-label="设置分组">
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
              aria-current={activeSection === 'appearance' ? 'page' : undefined}
              onClick={() => selectSection('appearance')}
            >
              <Palette size={15} />
              <span>外观</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'editor' ? 'active' : ''}`}
              aria-current={activeSection === 'editor' ? 'page' : undefined}
              onClick={() => selectSection('editor')}
            >
              <Settings size={15} />
              <span>编辑器</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'translator' ? 'active' : ''}`}
              aria-current={activeSection === 'translator' ? 'page' : undefined}
              onClick={() => selectSection('translator')}
            >
              <span className="settings-nav-emoji">AI</span>
              <span>AI 翻译</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'npm' ? 'active' : ''}`}
              aria-current={activeSection === 'npm' ? 'page' : undefined}
              onClick={() => selectSection('npm')}
            >
              <span className="settings-nav-emoji">npm</span>
              <span>npm Registry</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'maven' ? 'active' : ''}`}
              aria-current={activeSection === 'maven' ? 'page' : undefined}
              onClick={() => selectSection('maven')}
            >
              <span className="settings-nav-emoji">MVN</span>
              <span>Maven Search</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'proxy' ? 'active' : ''}`}
              aria-current={activeSection === 'proxy' ? 'page' : undefined}
              onClick={() => selectSection('proxy')}
            >
              <Wifi size={15} />
              <span>代理</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'shortcuts' ? 'active' : ''}`}
              aria-current={activeSection === 'shortcuts' ? 'page' : undefined}
              onClick={() => selectSection('shortcuts')}
            >
              <Keyboard size={15} />
              <span>快捷键</span>
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'updater' ? 'active' : ''}`}
              aria-current={activeSection === 'updater' ? 'page' : undefined}
              onClick={() => selectSection('updater')}
            >
              <RefreshCw size={15} />
              <span>更新</span>
            </button>
          </aside>

          <div className="settings-content">
            {/* 外观设置 */}
            {activeSection === 'appearance' && (
              <>
                <button
                  type="button"
                  id="settings-appearance-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('appearance')}
                  aria-expanded={!collapsedSections.appearance}
                  aria-controls="settings-appearance"
                >
                  <h3 className="settings-section-title">
                    <Palette size={18} className="settings-section-icon" />
                    外观
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.appearance ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-appearance"
                  role="region"
                  aria-labelledby="settings-appearance-header"
                  className={`settings-section-body ${!collapsedSections.appearance ? 'open' : ''}`}
                >
                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-theme-label" className="settings-item-label">
                        主题
                      </p>
                      <p className="settings-item-description">选择应用的外观主题</p>
                    </div>
                    <div
                      className="settings-segmented"
                      role="group"
                      aria-labelledby="settings-theme-label"
                    >
                      <button
                        type="button"
                        aria-pressed={settings.appearance.theme === 'light'}
                        className={`settings-option ${settings.appearance.theme === 'light' ? 'active' : ''}`}
                        onClick={() => updateAppearance({ theme: 'light' })}
                      >
                        <span className="settings-option-label">浅色</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.appearance.theme === 'dark'}
                        className={`settings-option ${settings.appearance.theme === 'dark' ? 'active' : ''}`}
                        onClick={() => updateAppearance({ theme: 'dark' })}
                      >
                        <span className="settings-option-label">深色</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.appearance.theme === 'system'}
                        className={`settings-option ${settings.appearance.theme === 'system' ? 'active' : ''}`}
                        onClick={() => updateAppearance({ theme: 'system' })}
                      >
                        <span className="settings-option-label">跟随系统</span>
                      </button>
                    </div>
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-font-size-label" className="settings-item-label">
                        字体大小
                      </p>
                      <p className="settings-item-description">调整应用的字体大小</p>
                    </div>
                    <div
                      className="settings-segmented"
                      role="group"
                      aria-labelledby="settings-font-size-label"
                    >
                      <button
                        type="button"
                        aria-pressed={settings.appearance.fontSize === 'small'}
                        className={`settings-option ${settings.appearance.fontSize === 'small' ? 'active' : ''}`}
                        onClick={() => updateAppearance({ fontSize: 'small' })}
                      >
                        <span className="settings-option-label">小</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.appearance.fontSize === 'medium'}
                        className={`settings-option ${settings.appearance.fontSize === 'medium' ? 'active' : ''}`}
                        onClick={() => updateAppearance({ fontSize: 'medium' })}
                      >
                        <span className="settings-option-label">中</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.appearance.fontSize === 'large'}
                        className={`settings-option ${settings.appearance.fontSize === 'large' ? 'active' : ''}`}
                        onClick={() => updateAppearance({ fontSize: 'large' })}
                      >
                        <span className="settings-option-label">大</span>
                      </button>
                    </div>
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-sidebar-label" className="settings-item-label">
                        显示侧边栏
                      </p>
                      <p id="settings-sidebar-description" className="settings-item-description">
                        启动时侧边栏的默认状态
                      </p>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={!settings.appearance.sidebarCollapsed}
                        aria-labelledby="settings-sidebar-label"
                        aria-describedby="settings-sidebar-description"
                        onChange={(e) => updateAppearance({ sidebarCollapsed: !e.target.checked })}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-tool-description-label" className="settings-item-label">
                        工具描述
                      </p>
                      <p
                        id="settings-tool-description-description"
                        className="settings-item-description"
                      >
                        在侧边栏工具名称下方显示中文描述
                      </p>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={settings.appearance.showSidebarShortDesc}
                        aria-labelledby="settings-tool-description-label"
                        aria-describedby="settings-tool-description-description"
                        onChange={(e) =>
                          updateAppearance({ showSidebarShortDesc: e.target.checked })
                        }
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-close-behavior-label" className="settings-item-label">
                        关闭窗口
                      </p>
                      <p className="settings-item-description">
                        点击关闭按钮时退出应用，或放到系统托盘后台运行
                      </p>
                    </div>
                    <div
                      className="settings-segmented"
                      role="group"
                      aria-labelledby="settings-close-behavior-label"
                    >
                      <button
                        type="button"
                        aria-pressed={settings.window.closeBehavior === 'ask'}
                        className={`settings-option ${settings.window.closeBehavior === 'ask' ? 'active' : ''}`}
                        onClick={() => updateWindow({ closeBehavior: 'ask' })}
                      >
                        <span className="settings-option-label">询问</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.window.closeBehavior === 'minimize-to-tray'}
                        className={`settings-option ${settings.window.closeBehavior === 'minimize-to-tray' ? 'active' : ''}`}
                        onClick={() => updateWindow({ closeBehavior: 'minimize-to-tray' })}
                      >
                        <span className="settings-option-label">放到托盘</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.window.closeBehavior === 'exit'}
                        className={`settings-option ${settings.window.closeBehavior === 'exit' ? 'active' : ''}`}
                        onClick={() => updateWindow({ closeBehavior: 'exit' })}
                      >
                        <span className="settings-option-label">退出</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 编辑器设置 */}
            {activeSection === 'editor' && (
              <>
                <button
                  type="button"
                  id="settings-editor-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('editor')}
                  aria-expanded={!collapsedSections.editor}
                  aria-controls="settings-editor"
                >
                  <h3 className="settings-section-title">
                    <Settings size={18} className="settings-section-icon" />
                    编辑器
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.editor ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-editor"
                  role="region"
                  aria-labelledby="settings-editor-header"
                  className={`settings-section-body ${!collapsedSections.editor ? 'open' : ''}`}
                >
                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-json-indent-label" className="settings-item-label">
                        JSON 缩进
                      </p>
                      <p className="settings-item-description">格式化 JSON 时使用的缩进空格数</p>
                    </div>
                    <div
                      className="settings-segmented"
                      role="group"
                      aria-labelledby="settings-json-indent-label"
                    >
                      <button
                        type="button"
                        aria-pressed={settings.editor.jsonIndent === 2}
                        className={`settings-option ${settings.editor.jsonIndent === 2 ? 'active' : ''}`}
                        onClick={() => updateEditor({ jsonIndent: 2 })}
                      >
                        <span className="settings-option-label">2空格</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.editor.jsonIndent === 4}
                        className={`settings-option ${settings.editor.jsonIndent === 4 ? 'active' : ''}`}
                        onClick={() => updateEditor({ jsonIndent: 4 })}
                      >
                        <span className="settings-option-label">4空格</span>
                      </button>
                    </div>
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-auto-copy-label" className="settings-item-label">
                        自动复制
                      </p>
                      <p id="settings-auto-copy-description" className="settings-item-description">
                        生成结果后自动复制到剪贴板
                      </p>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={settings.editor.autoCopy}
                        aria-labelledby="settings-auto-copy-label"
                        aria-describedby="settings-auto-copy-description"
                        onChange={(e) => updateEditor({ autoCopy: e.target.checked })}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* AI 翻译设置 */}
            {activeSection === 'translator' && (
              <>
                <button
                  type="button"
                  id="settings-translator-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('translator')}
                  aria-expanded={!collapsedSections.translator}
                  aria-controls="settings-translator"
                >
                  <h3 className="settings-section-title">
                    <span className="settings-section-icon" style={{ fontSize: 18 }}>
                      🤖
                    </span>
                    AI 翻译
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.translator ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-translator"
                  role="region"
                  aria-labelledby="settings-translator-header"
                  className={`settings-section-body ${!collapsedSections.translator ? 'open' : ''}`}
                >
                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <label className="settings-item-label" htmlFor="settings-translator-base-url">
                        Base URL
                      </label>
                      <p
                        id="settings-translator-base-url-description"
                        className="settings-item-description"
                      >
                        支持 OpenAI 兼容 API（NewAPI / OpenAI / Azure 等）
                      </p>
                    </div>
                    <input
                      id="settings-translator-base-url"
                      className="settings-input"
                      type="text"
                      aria-describedby="settings-translator-base-url-description"
                      value={settings.translator.baseUrl}
                      onChange={(e) => updateTranslator({ baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <label className="settings-item-label" htmlFor="settings-translator-api-key">
                        API Key
                      </label>
                      <p
                        id="settings-translator-api-key-description"
                        className="settings-item-description"
                      >
                        密钥仅存储在本地，不会上传
                      </p>
                    </div>
                    <input
                      id="settings-translator-api-key"
                      className="settings-input"
                      type="password"
                      aria-describedby="settings-translator-api-key-description"
                      value={settings.translator.apiKey}
                      onChange={(e) => updateTranslator({ apiKey: e.target.value })}
                      placeholder="sk-..."
                    />
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <label className="settings-item-label" htmlFor="settings-translator-model">
                        Model
                      </label>
                      <p className="settings-item-description">
                        {fetchedModels.length > 0
                          ? `${fetchedModels.length} 个可用模型`
                          : '配置 URL 和 Key 后自动获取模型列表'}
                      </p>
                    </div>
                    <select
                      id="settings-translator-model"
                      className="settings-select"
                      value={settings.translator.model}
                      onChange={(e) => updateTranslator({ model: e.target.value })}
                    >
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <label
                        className="settings-item-label"
                        htmlFor="settings-translator-system-prompt"
                      >
                        System Prompt
                      </label>
                      <p className="settings-item-description">
                        自定义翻译提示词。 <code>{'{sourceLang}'}</code> = 源语言，{' '}
                        <code>{'{targetLang}'}</code> = 目标语言
                      </p>
                    </div>
                    <textarea
                      id="settings-translator-system-prompt"
                      className="settings-textarea"
                      value={settings.translator.systemPrompt}
                      onChange={(e) => updateTranslator({ systemPrompt: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <label
                        className="settings-item-label"
                        htmlFor="settings-translator-temperature"
                      >
                        Temperature
                      </label>
                      <p className="settings-item-description">随机性 (0-2)，翻译建议 0.1-0.3</p>
                    </div>
                    <input
                      id="settings-translator-temperature"
                      className="settings-input settings-input-sm"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={settings.translator.temperature}
                      onChange={(e) =>
                        updateTranslator({ temperature: parseFloat(e.target.value) || 0.3 })
                      }
                    />
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <label
                        className="settings-item-label"
                        htmlFor="settings-translator-max-tokens"
                      >
                        Max Tokens
                      </label>
                      <p className="settings-item-description">
                        最大输出长度 (1-16384)，长文本翻译可调大
                      </p>
                    </div>
                    <input
                      id="settings-translator-max-tokens"
                      className="settings-input settings-input-sm"
                      type="number"
                      min={1}
                      max={16384}
                      step={256}
                      value={settings.translator.maxTokens}
                      onChange={(e) =>
                        updateTranslator({ maxTokens: parseInt(e.target.value) || 4096 })
                      }
                    />
                  </div>

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p className="settings-item-label">连接状态</p>
                      <StatusMessage
                        className="settings-item-description"
                        tone={
                          testResult.startsWith('❌')
                            ? 'error'
                            : testResult.startsWith('✅')
                              ? 'success'
                              : 'neutral'
                        }
                        busy={testing}
                      >
                        {testResult}
                      </StatusMessage>
                    </div>
                    <button
                      className="settings-btn settings-btn-secondary"
                      onClick={testConnection}
                      disabled={
                        !settings.translator.baseUrl || !settings.translator.apiKey || testing
                      }
                    >
                      {testing ? '测试中...' : '🔗 测试连接'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* npm 源设置 */}
            {activeSection === 'npm' && (
              <>
                <button
                  type="button"
                  id="settings-npm-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('npm')}
                  aria-expanded={!collapsedSections.npm}
                  aria-controls="settings-npm"
                >
                  <h3 className="settings-section-title">
                    <span className="settings-section-icon" style={{ fontSize: 18 }}>
                      📦
                    </span>
                    npm Registry
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.npm ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-npm"
                  role="region"
                  aria-labelledby="settings-npm-header"
                  className={`settings-section-body ${!collapsedSections.npm ? 'open' : ''}`}
                >
                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <label className="settings-item-label" htmlFor="settings-npm-registry">
                        自定义 npm 源
                      </label>
                      <p className="settings-item-description">
                        留空则依次尝试 registry.npmjs.org → npmmirror.com
                      </p>
                    </div>
                    <input
                      id="settings-npm-registry"
                      className="settings-input"
                      type="text"
                      value={settings.npmRegistry}
                      onChange={(e) => updateNpmRegistry(e.target.value)}
                      placeholder="https://registry.npmjs.org"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Maven 搜索设置 */}
            {activeSection === 'maven' && (
              <>
                <button
                  type="button"
                  id="settings-maven-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('maven')}
                  aria-expanded={!collapsedSections.maven}
                  aria-controls="settings-maven"
                >
                  <h3 className="settings-section-title">
                    <span className="settings-section-icon" style={{ fontSize: 18 }}>
                      🔍
                    </span>
                    Maven Search
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.maven ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-maven"
                  role="region"
                  aria-labelledby="settings-maven-header"
                  className={`settings-section-body ${!collapsedSections.maven ? 'open' : ''}`}
                >
                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <label className="settings-item-label" htmlFor="settings-maven-search-url">
                        Maven 搜索地址
                      </label>
                      <p className="settings-item-description">
                        默认 search.maven.org，国内可换用镜像站
                      </p>
                    </div>
                    <input
                      id="settings-maven-search-url"
                      className="settings-input"
                      type="text"
                      value={settings.mavenSearchUrl}
                      onChange={(e) => updateMavenSearchUrl(e.target.value)}
                      placeholder="https://search.maven.org/solrsearch/select"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 代理设置 */}
            {activeSection === 'proxy' && (
              <>
                <button
                  type="button"
                  id="settings-proxy-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('proxy')}
                  aria-expanded={!collapsedSections.proxy}
                  aria-controls="settings-proxy"
                >
                  <h3 className="settings-section-title">
                    <Wifi size={18} className="settings-section-icon" />
                    代理
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.proxy ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-proxy"
                  role="region"
                  aria-labelledby="settings-proxy-header"
                  className={`settings-section-body ${!collapsedSections.proxy ? 'open' : ''}`}
                >
                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-proxy-enabled-label" className="settings-item-label">
                        启用代理
                      </p>
                      <p
                        id="settings-proxy-enabled-description"
                        className="settings-item-description"
                      >
                        开启后，网络请求将通过代理转发
                      </p>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={settings.proxy.enabled}
                        aria-labelledby="settings-proxy-enabled-label"
                        aria-describedby="settings-proxy-enabled-description"
                        onChange={(e) => updateProxy({ enabled: e.target.checked })}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>
                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <label className="settings-item-label" htmlFor="settings-proxy-url">
                        代理地址
                      </label>
                      <p className="settings-item-description">
                        支持 HTTP/HTTPS/SOCKS 代理，例如 http://127.0.0.1:7890
                      </p>
                    </div>
                    <input
                      id="settings-proxy-url"
                      className="settings-input"
                      type="text"
                      value={settings.proxy.url}
                      onChange={(e) => updateProxy({ url: e.target.value })}
                      placeholder="http://127.0.0.1:7890"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 快捷键设置 */}
            {activeSection === 'shortcuts' && (
              <>
                <button
                  type="button"
                  id="settings-shortcuts-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('shortcuts')}
                  aria-expanded={!collapsedSections.shortcuts}
                  aria-controls="settings-shortcuts"
                >
                  <h3 className="settings-section-title">
                    <Keyboard size={18} className="settings-section-icon" />
                    快捷键
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.shortcuts ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-shortcuts"
                  role="region"
                  aria-labelledby="settings-shortcuts-header"
                  className={`settings-section-body ${!collapsedSections.shortcuts ? 'open' : ''}`}
                >
                  <div className="settings-item settings-item-column">
                    <div className="settings-item-info">
                      <p className="settings-item-label">自定义全局快捷键</p>
                      <p className="settings-item-description">
                        点击按钮后按下组合键即可修改，Esc 取消录制。 修改后即时生效，无需重启。
                      </p>
                    </div>
                  </div>

                  <div className="settings-item" style={{ display: 'block' }}>
                    <table className="shortcuts-table">
                      <tbody>
                        <tr>
                          <td>切换侧边栏</td>
                          <td>
                            <kbd>{formatShortcut(settings.shortcuts.toggleSidebar)}</kbd>
                          </td>
                          <td>
                            <ShortcutRecorder
                              value={settings.shortcuts.toggleSidebar}
                              onChange={(v) => updateShortcuts({ toggleSidebar: v })}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>打开设置</td>
                          <td>
                            <kbd>{formatShortcut(settings.shortcuts.openSettings)}</kbd>
                          </td>
                          <td>
                            <ShortcutRecorder
                              value={settings.shortcuts.openSettings}
                              onChange={(v) => updateShortcuts({ openSettings: v })}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>返回首页</td>
                          <td>
                            <kbd>{formatShortcut(settings.shortcuts.goHome)}</kbd>
                          </td>
                          <td>
                            <ShortcutRecorder
                              value={settings.shortcuts.goHome}
                              onChange={(v) => updateShortcuts({ goHome: v })}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>命令面板</td>
                          <td>
                            <kbd>{navigator.platform.includes('Mac') ? '⌘ + K' : 'Ctrl + K'}</kbd>
                          </td>
                          <td>
                            <span className="settings-item-description">
                              全局快捷键（不可修改）
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 工具禁用 */}
            {/* 更新设置 */}
            {activeSection === 'updater' && (
              <>
                <button
                  type="button"
                  id="settings-updater-header"
                  className="settings-section-header"
                  onClick={() => toggleSection('updater')}
                  aria-expanded={!collapsedSections.updater}
                  aria-controls="settings-updater"
                >
                  <h3 className="settings-section-title">
                    <RefreshCw size={18} className="settings-section-icon" />
                    更新
                  </h3>
                  <ChevronRight
                    size={16}
                    className={`settings-section-chevron ${!collapsedSections.updater ? 'open' : ''}`}
                  />
                </button>
                <div
                  id="settings-updater"
                  role="region"
                  aria-labelledby="settings-updater-header"
                  className={`settings-section-body ${!collapsedSections.updater ? 'open' : ''}`}
                >
                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p id="settings-updater-auto-check-label" className="settings-item-label">
                        自动检查更新
                      </p>
                      <p
                        id="settings-updater-auto-check-description"
                        className="settings-item-description"
                      >
                        启动时自动检查新版本
                      </p>
                    </div>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={settings.updater.autoCheck}
                        aria-labelledby="settings-updater-auto-check-label"
                        aria-describedby="settings-updater-auto-check-description"
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
                      <StatusMessage
                        className={`settings-item-description ${hasError ? 'updater-error' : ''}`}
                        tone={updaterStatusTone}
                        busy={status.type === 'checking' || status.type === 'downloading'}
                      >
                        {updaterStatusMessage}
                      </StatusMessage>
                    </div>
                    {isAvailable && (releaseNotes || releaseDate) && (
                      <button className="settings-link-btn" onClick={openNotes}>
                        <FileText size={13} />
                        更新说明
                      </button>
                    )}
                  </div>

                  {isDownloading && status.type === 'downloading' && (
                    <div
                      className="updater-progress"
                      role="progressbar"
                      aria-label="更新下载进度"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={status.percent}
                    >
                      <div
                        className="updater-progress-bar"
                        style={{ width: `${status.percent}%` }}
                      />
                    </div>
                  )}

                  {settingsPath && (
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <p className="settings-item-label">配置文件</p>
                        <p className="settings-item-description">本地设置文件路径</p>
                      </div>
                      <code className="settings-path-value">{settingsPath}</code>
                    </div>
                  )}

                  <div className="settings-item">
                    <div className="settings-item-info">
                      <p className="settings-item-label">维护操作</p>
                      <p className="settings-item-description">
                        检查应用更新，或将设置恢复为默认值
                      </p>
                    </div>
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
                          <button
                            className="settings-btn settings-btn-primary"
                            onClick={downloadUpdate}
                          >
                            <Download size={15} />
                            下载更新
                          </button>
                          {(releaseNotes || releaseDate) && (
                            <button
                              className="settings-btn settings-btn-secondary"
                              onClick={openNotes}
                            >
                              <FileText size={13} />
                              更新说明
                            </button>
                          )}
                        </>
                      )}
                      {isDownloaded && (
                        <button
                          className="settings-btn settings-btn-primary"
                          onClick={quitAndInstall}
                        >
                          重启并安装
                        </button>
                      )}
                      <button className="settings-btn settings-btn-secondary" onClick={openNotes}>
                        <FileText size={13} />
                        更新说明
                      </button>
                      <button
                        className="settings-btn settings-btn-secondary"
                        onClick={resetToDefaults}
                      >
                        <RotateCcw size={15} />
                        恢复默认
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={showNotes}
        onClose={() => setShowNotes(false)}
        returnFocusRef={notesTriggerRef}
        title={
          <>
            <FileText size={16} aria-hidden="true" />
            版本更新说明
          </>
        }
        footer={
          isAvailable ? (
            <button
              className="settings-btn settings-btn-primary"
              onClick={() => {
                downloadUpdate()
                setShowNotes(false)
              }}
            >
              <Download size={14} aria-hidden="true" />
              下载更新
            </button>
          ) : undefined
        }
      >
        {releaseDate && (
          <div className="settings-modal-date">发布日期：{formatReleaseDate(releaseDate)}</div>
        )}
        <div
          className="settings-modal-notes"
          dangerouslySetInnerHTML={{ __html: displayedReleaseNotes }}
        />
      </Dialog>
    </div>
  )
}
