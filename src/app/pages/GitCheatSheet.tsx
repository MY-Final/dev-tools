import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Search, GitBranch, User, Terminal } from 'lucide-react'
import gitCommands from '@renderer/tools/git-cheat-sheet/git-commands.json'

interface GitCommand {
  command: string
  description: string
  example: string
}

interface GitCategory {
  id: string
  label: string
  icon: string
  commands: GitCommand[]
}

const GIT_COMMANDS: GitCategory[] = gitCommands as GitCategory[]

interface ConfigSnippet {
  desc: string
  template: string
}

const SETUP_SNIPPETS: ConfigSnippet[] = [
  {
    desc: '设置用户名',
    template: 'git config --global user.name "<name>"'
  },
  {
    desc: '设置邮箱',
    template: 'git config --global user.email "<email>"'
  },
  {
    desc: '永久保存凭证',
    template: 'git config --global credential.helper store'
  },
  {
    desc: '生成 SSH 密钥 (Ed25519)',
    template: 'ssh-keygen -t ed25519 -C "<email>"'
  },
  {
    desc: '生成 SSH 密钥 (RSA 4096)',
    template: 'ssh-keygen -t rsa -b 4096 -C "<email>"'
  },
  {
    desc: '查看 SSH 公钥',
    template: 'cat ~/.ssh/id_ed25519.pub'
  },
  {
    desc: '测试 GitHub SSH',
    template: 'ssh -T git@github.com'
  },
  {
    desc: '测试 GitLab SSH',
    template: 'ssh -T git@gitlab.com'
  },
  {
    desc: '设置默认分支名',
    template: 'git config --global init.defaultBranch main'
  },
  {
    desc: '克隆仓库 (SSH)',
    template: 'git clone git@github.com:<user>/<repo>.git'
  },
  {
    desc: '克隆仓库 (HTTPS)',
    template: 'git clone https://github.com/<user>/<repo>.git'
  },
  {
    desc: '修改远程地址为 SSH',
    template: 'git remote set-url origin git@github.com:<user>/<repo>.git'
  }
]

type TabType = 'cheatsheet' | 'setup'

export default function GitCheatSheet(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('cheatsheet')
  const [search, setSearch] = useState('')
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Setup tab state
  const [gitName, setGitName] = useState('')
  const [gitEmail, setGitEmail] = useState('')

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return GIT_COMMANDS
    const query = search.toLowerCase()
    return GIT_COMMANDS.map((category) => ({
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

  const fillSnippet = useCallback(
    (template: string): string => {
      return template.replace('<name>', gitName || 'Your Name').replace('<email>', gitEmail || 'you@example.com').replace('<user>', gitName || 'user').replace('<repo>', 'repo')
    },
    [gitName, gitEmail]
  )

  return (
    <div className="gcs-page">
      <div className="gcs-card">
        <div className="gcs-header">
          <h2 className="gcs-title">Git Cheat Sheet</h2>
          <p className="gcs-subtitle">Git 命令速查手册 & 快捷配置</p>
        </div>

        <div className="mvn-tabs">
          <button
            className={`mvn-tab ${activeTab === 'cheatsheet' ? 'active' : ''}`}
            onClick={() => setActiveTab('cheatsheet')}
          >
            速查表
          </button>
          <button
            className={`mvn-tab ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            快捷配置
          </button>
        </div>

        {activeTab === 'cheatsheet' ? (
          <>
            <div className="gcs-search">
              <Search size={16} />
              <input
                type="text"
                className="gcs-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 Git 命令..."
              />
            </div>

            <div className="gcs-content">
              {filteredCategories.map((category) => (
                <div key={category.id} className="gcs-category">
                  <div className="gcs-category-header">
                    <span className="gcs-category-icon">{category.icon}</span>
                    <span className="gcs-category-label">{category.label}</span>
                    <span className="gcs-category-count">{category.commands.length}</span>
                  </div>
                  <div className="gcs-commands">
                    {category.commands.map((cmd) => (
                      <div key={cmd.command} className="gcs-command-wrapper">
                        <div
                          className={`gcs-command ${expandedCommand === cmd.command ? 'expanded' : ''}`}
                          onClick={() => toggleExpand(cmd.command)}
                        >
                          <code className="gcs-command-text">{cmd.command}</code>
                          <span className="gcs-command-desc">{cmd.description}</span>
                          <button
                            className="gcs-copy-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyCommand(cmd.example)
                            }}
                          >
                            {copied === cmd.example ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        {expandedCommand === cmd.command && (
                          <div className="gcs-command-details">
                            <div className="gcs-detail-section">
                              <span className="gcs-detail-label">示例</span>
                              <div className="gcs-detail-code">
                                <code>{cmd.example}</code>
                                <button
                                  className="gcs-copy-btn"
                                  onClick={() => copyCommand(cmd.example)}
                                >
                                  {copied === cmd.example ? <Check size={12} /> : <Copy size={12} />}
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
              <div className="gcs-empty">
                <GitBranch size={32} />
                <span>未找到匹配的命令</span>
              </div>
            )}
          </>
        ) : (
          // Setup Tab
          <div className="gcs-setup-section">
            <div className="gcs-setup-hint">
              <User size={14} />
              <span>填入你的信息，下方命令自动替换，复制即用</span>
            </div>

            <div className="gcs-setup-inputs">
              <div className="gcs-search">
                <User size={16} />
                <input
                  type="text"
                  className="gcs-search-input"
                  value={gitName}
                  onChange={(e) => setGitName(e.target.value)}
                  placeholder="你的名字，如 Linus Torvalds"
                />
              </div>
              <div className="gcs-search">
                <Terminal size={16} />
                <input
                  type="email"
                  className="gcs-search-input"
                  value={gitEmail}
                  onChange={(e) => setGitEmail(e.target.value)}
                  placeholder="你的邮箱，如 linus@linux.org"
                />
              </div>
            </div>

            <div className="gcs-setup-commands">
              {SETUP_SNIPPETS.map((snippet) => {
                const cmd = fillSnippet(snippet.template)
                return (
                  <div key={snippet.desc} className="gcs-setup-item">
                    <span className="gcs-setup-item-desc">{snippet.desc}</span>
                    <div className="gcs-detail-code">
                      <code>{cmd}</code>
                      <button className="gcs-copy-btn" onClick={() => copyCommand(cmd)}>
                        {copied === cmd ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
