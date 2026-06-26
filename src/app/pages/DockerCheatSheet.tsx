import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Copy, Check, Search, Box, Terminal, Globe, Star, Download } from 'lucide-react'
import dockerCommands from '@renderer/tools/docker-cheat-sheet/docker-commands.json'

interface DockerCommand {
  command: string
  description: string
  example: string
  params?: { flag: string; desc: string }[]
}

interface DockerCategory {
  id: string
  label: string
  icon: string
  commands: DockerCommand[]
}

const DOCKER_COMMANDS: DockerCategory[] = dockerCommands as DockerCategory[]

interface ContainerAction {
  command: string
  desc: string
  suffix?: string
  prefix?: boolean
}

const CONTAINER_ACTIONS: ContainerAction[] = [
  { command: 'docker restart', desc: '重启容器' },
  { command: 'docker stop', desc: '停止容器' },
  { command: 'docker start', desc: '启动容器' },
  { command: 'docker logs -f', desc: '跟踪日志' },
  { command: 'docker logs --tail 100', desc: '最近 100 行日志' },
  { command: 'docker exec -it', desc: '进入容器 Shell', suffix: '/bin/bash' },
  { command: 'docker inspect', desc: '查看详情' },
  { command: 'docker top', desc: '查看进程' },
  { command: 'docker stats', desc: '资源监控' },
  { command: 'docker rm -f', desc: '强制删除' },
  { command: 'docker cp', desc: '复制文件到容器', suffix: ':/path' },
  { command: 'docker cp', desc: '从容器复制文件', prefix: true, suffix: ':/path ./local-path' }
]

type TabType = 'cheatsheet' | 'container' | 'dockerhub'

interface DockerSearchResult {
  name: string
  description: string
  stars: number
  pulls: number
  isOfficial: boolean
  isAutomated: boolean
  imageName: string
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export default function DockerCheatSheet(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('cheatsheet')
  const [search, setSearch] = useState('')
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [containerName, setContainerName] = useState('')

  // Docker Hub search
  const [hubQuery, setHubQuery] = useState('')
  const [hubResults, setHubResults] = useState<DockerSearchResult[]>([])
  const [hubLoading, setHubLoading] = useState(false)
  const [hubError, setHubError] = useState('')
  const [hubCopied, setHubCopied] = useState('')
  const hubDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doHubSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setHubResults([]); setHubError(''); return }
    setHubLoading(true); setHubError('')
    try {
      const res = await window.docker.search(q, 20)
      if (res && res.length > 0) setHubResults(res)
      else setHubError('未找到匹配的镜像')
    } catch {
      setHubError('搜索失败，请检查网络')
    }
    setHubLoading(false)
  }, [])

  useEffect(() => {
    if (hubDebounce.current) clearTimeout(hubDebounce.current)
    hubDebounce.current = setTimeout(() => doHubSearch(hubQuery), 300)
    return () => { if (hubDebounce.current) clearTimeout(hubDebounce.current) }
  }, [hubQuery, doHubSearch])

  const copyHub = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setHubCopied(key); setTimeout(() => setHubCopied(''), 1500) } catch { /* ignore */ }
  }, [])

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return DOCKER_COMMANDS
    const query = search.toLowerCase()
    return DOCKER_COMMANDS.map((category) => ({
      ...category,
      commands: category.commands.filter(
        (cmd) =>
          cmd.command.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query) ||
          cmd.example.toLowerCase().includes(query)
      )
    })).filter((category) => category.commands.length > 0)
  }, [search])

  const copyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(command)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const toggleExpand = useCallback((command: string) => {
    setExpandedCommand((prev) => (prev === command ? null : command))
  }, [])

  const buildContainerCmd = (action: ContainerAction): string => {
    if (!containerName.trim()) return `${action.command} <container>`
    if (action.prefix) {
      return `${containerName} ${action.command} ${action.suffix ?? ''}`.trim()
    }
    return `${action.command} ${containerName} ${action.suffix ?? ''}`.trim()
  }

  return (
    <div className="dcs-page">
      <div className="dcs-card">
        <div className="dcs-header">
          <h2 className="dcs-title">Docker Cheat Sheet</h2>
          <p className="dcs-subtitle">Docker 命令速查手册 & 容器管理</p>
        </div>

        {/* Tabs */}
        <div className="mvn-tabs">
          <button
            className={`mvn-tab ${activeTab === 'cheatsheet' ? 'active' : ''}`}
            onClick={() => setActiveTab('cheatsheet')}
          >
            速查表
          </button>
          <button
            className={`mvn-tab ${activeTab === 'container' ? 'active' : ''}`}
            onClick={() => setActiveTab('container')}
          >
            容器管理
          </button>
          <button
            className={`mvn-tab ${activeTab === 'dockerhub' ? 'active' : ''}`}
            onClick={() => setActiveTab('dockerhub')}
          >
            <Globe size={13} />
            Docker Hub
          </button>
        </div>

        {activeTab === 'cheatsheet' ? (
          <>
            <div className="dcs-search">
              <Search size={16} />
              <input
                type="text"
                className="dcs-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 Docker 命令..."
              />
            </div>

            <div className="dcs-content">
              {filteredCategories.map((category) => (
                <div key={category.id} className="dcs-category">
                  <div className="dcs-category-header">
                    <span className="dcs-category-icon">{category.icon}</span>
                    <span className="dcs-category-label">{category.label}</span>
                    <span className="dcs-category-count">{category.commands.length}</span>
                  </div>
                  <div className="dcs-commands">
                    {category.commands.map((cmd) => (
                      <div key={cmd.command} className="dcs-command-wrapper">
                        <div
                          className={`dcs-command ${expandedCommand === cmd.command ? 'expanded' : ''}`}
                          onClick={() => toggleExpand(cmd.command)}
                        >
                          <code className="dcs-command-text">{cmd.command}</code>
                          <span className="dcs-command-desc">{cmd.description}</span>
                          <button
                            className="dcs-copy-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyCommand(cmd.example)
                            }}
                          >
                            {copied === cmd.example ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        {expandedCommand === cmd.command && (
                          <div className="dcs-command-details">
                            {cmd.params && cmd.params.length > 0 && (
                              <div className="dcs-detail-section">
                                <span className="dcs-detail-label">参数</span>
                                <div className="dcs-params">
                                  {cmd.params.map((param) => (
                                    <div key={param.flag} className="dcs-param">
                                      <code className="dcs-param-flag">{param.flag}</code>
                                      <span className="dcs-param-desc">{param.desc}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="dcs-detail-section">
                              <span className="dcs-detail-label">示例</span>
                              <div className="dcs-detail-code">
                                <code>{cmd.example}</code>
                                <button
                                  className="dcs-copy-btn"
                                  onClick={() => copyCommand(cmd.example)}
                                >
                                  {copied === cmd.example ? (
                                    <Check size={12} />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {filteredCategories.length === 0 && (
              <div className="dcs-empty">
                <Box size={32} />
                <span>未找到匹配的命令</span>
              </div>
            )}
          </>
        ) : activeTab === 'container' ? (
          // Container Management Tab
          <div className="dcs-container-section">
            <div className="dcs-search">
              <Terminal size={16} />
              <input
                type="text"
                className="dcs-search-input"
                value={containerName}
                onChange={(e) => setContainerName(e.target.value)}
                placeholder="输入容器名称或 ID，例如 napcat"
              />
            </div>

            <div className="dcs-container-hint">
              输入容器名称后，下方命令会自动填充容器名，直接复制即可使用
            </div>

            <div className="dcs-container-actions">
              {CONTAINER_ACTIONS.map((action) => {
                const cmd = buildContainerCmd(action)
                return (
                  <div key={action.desc} className="dcs-container-action-item">
                    <div className="dcs-container-action-info">
                      <span className="dcs-container-action-desc">{action.desc}</span>
                    </div>
                    <div className="dcs-detail-code">
                      <code>{cmd}</code>
                      <button className="dcs-copy-btn" onClick={() => copyCommand(cmd)}>
                        {copied === cmd ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="dcs-dockerhub">
            <div className="npm-search-area">
              <Search size={16} className="npm-search-icon" />
              <input className="npm-search-input" value={hubQuery} onChange={(e) => setHubQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doHubSearch(hubQuery); }} placeholder="搜索 Docker Hub 镜像..." />
              {hubLoading && <Terminal size={16} className="npm-spin" />}
            </div>
            {hubError && <div className="npm-error">{hubError}</div>}
            {!hubLoading && !hubError && hubQuery && hubResults.length === 0 && <div className="npm-empty">未找到匹配的镜像</div>}
            {hubResults.map((img) => (
              <div key={img.name} className="dcs-hub-item">
                <div className="dcs-hub-header">
                  <div className="dcs-hub-name">
                    <span>{img.imageName}</span>
                    {img.isOfficial && <span className="dcs-hub-badge">Official</span>}
                  </div>
                </div>
                <div className="dcs-hub-desc">{img.description || '暂无描述'}</div>
                <div className="dcs-hub-meta">
                  <span><Star size={12} /> {formatCount(img.stars)}</span>
                  <span><Download size={12} /> {formatCount(img.pulls)}</span>
                </div>
                <div className="dcs-hub-cmd">
                  <code>docker pull {img.imageName}</code>
                  <button className="dcs-copy-btn" onClick={() => copyHub('docker pull ' + img.imageName, img.name)}>
                    {hubCopied === img.name ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
