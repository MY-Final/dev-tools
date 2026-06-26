import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Copy, Check, Search, ExternalLink, Globe, Loader } from 'lucide-react'
import {
  searchMavenArtifacts,
  getArtifactVersions,
  fetchPopularDeps,
  type MavenDoc
} from '@renderer/lib/maven-api'

interface MavenMirror {
  id: string
  name: string
  url: string
  description: string
}

const MAVEN_MIRRORS: MavenMirror[] = [
  {
    id: 'aliyun',
    name: '阿里云',
    url: 'https://maven.aliyun.com/repository/public',
    description: '国内最快，推荐'
  },
  {
    id: 'huawei',
    name: '华为云',
    url: 'https://repo.huaweicloud.com/repository/maven/',
    description: '华为云镜像'
  },
  {
    id: 'tencent',
    name: '腾讯云',
    url: 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/',
    description: '腾讯云镜像'
  },
  {
    id: 'tsinghua',
    name: '清华大学',
    url: 'https://mirrors.tuna.tsinghua.edu.cn/maven2/',
    description: '清华大学镜像'
  },
  {
    id: 'ustc',
    name: '中科大',
    url: 'https://mirrors.ustc.edu.cn/maven2/',
    description: '中科大镜像'
  }
]

type OutputFormat = 'maven' | 'gradle' | 'gradle-kotlin' | 'sbt'
type TabType = 'dependency' | 'mirror'

export default function MavenDependency(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('dependency')
  const [search, setSearch] = useState('')
  const [deps, setDeps] = useState<MavenDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [popularLoading, setPopularLoading] = useState(true)
  const [selectedDep, setSelectedDep] = useState<MavenDoc | null>(null)
  const [selectedVersion, setSelectedVersion] = useState('')
  const [versions, setVersions] = useState<string[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [format, setFormat] = useState<OutputFormat>('maven')
  const [copied, setCopied] = useState(false)
  const [selectedMirror, setSelectedMirror] = useState<MavenMirror>(MAVEN_MIRRORS[0])
  const [mirrorCopied, setMirrorCopied] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Load popular deps on mount
  useEffect(() => {
    fetchPopularDeps().then((docs) => {
      setDeps(docs)
      setPopularLoading(false)
    })
  }, [])

  // Debounced search
  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setLoading(true)
      const docs = await fetchPopularDeps()
      setDeps(docs)
      setLoading(false)
      return
    }
    setLoading(true)
    const docs = await searchMavenArtifacts(query)
    setDeps(docs)
    setLoading(false)
  }, [])

  // Trigger search with debounce, unless immediate is set
  const triggerSearch = useCallback(
    (query: string, immediate = false) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (immediate) {
        doSearch(query)
        return
      }
      debounceRef.current = setTimeout(() => doSearch(query), 200)
    },
    [doSearch]
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!search.trim()) {
      triggerSearch('', true)
    } else {
      triggerSearch(search)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, triggerSearch])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      doSearch(search)
    }
  }

  // Fetch versions when a dep is selected
  const selectDep = useCallback(async (dep: MavenDoc) => {
    setSelectedDep(dep)
    setSelectedVersion(dep.latestVersion)
    setVersionsLoading(true)
    const vs = await getArtifactVersions(dep.groupId, dep.artifactId)
    setVersions(vs.length > 0 ? vs : [dep.latestVersion])
    setVersionsLoading(false)
  }, [])

  const filteredDeps = useMemo(() => deps, [deps])

  const generateOutput = useCallback(
    (dep: MavenDoc, version: string, fmt: OutputFormat): string => {
      switch (fmt) {
        case 'maven':
          return `<dependency>\n    <groupId>${dep.groupId}</groupId>\n    <artifactId>${dep.artifactId}</artifactId>\n    <version>${version}</version>\n</dependency>`
        case 'gradle':
          return `implementation '${dep.groupId}:${dep.artifactId}:${version}'`
        case 'gradle-kotlin':
          return `implementation("${dep.groupId}:${dep.artifactId}:${version}")`
        case 'sbt':
          return `libraryDependencies += "${dep.groupId}" % "${dep.artifactId}" % "${version}"`
      }
    },
    []
  )

  const generateMirrorConfig = useCallback((mirror: MavenMirror): string => {
    return `<mirror>\n    <id>${mirror.id}</id>\n    <name>${mirror.name}</name>\n    <url>${mirror.url}</url>\n    <mirrorOf>central</mirrorOf>\n</mirror>`
  }, [])

  const copyOutput = useCallback(async () => {
    if (!selectedDep) return
    const output = generateOutput(selectedDep, selectedVersion, format)
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback
    }
  }, [selectedDep, selectedVersion, format, generateOutput])

  const copyMirror = useCallback(async () => {
    const config = generateMirrorConfig(selectedMirror)
    try {
      await navigator.clipboard.writeText(config)
      setMirrorCopied(true)
      setTimeout(() => setMirrorCopied(false), 1500)
    } catch {
      // fallback
    }
  }, [selectedMirror, generateMirrorConfig])

  const formatLabels: Record<OutputFormat, string> = {
    maven: 'Maven',
    gradle: 'Gradle',
    'gradle-kotlin': 'Gradle Kotlin',
    sbt: 'SBT'
  }

  return (
    <div className="mvn-page">
      <div className="mvn-card">
        <div className="mvn-header">
          <h2 className="mvn-title">Maven Dependency</h2>
          <p className="mvn-subtitle">Maven 依赖生成 & 镜像源配置</p>
        </div>

        <div className="mvn-tabs">
          <button
            className={`mvn-tab ${activeTab === 'dependency' ? 'active' : ''}`}
            onClick={() => setActiveTab('dependency')}
          >
            依赖生成
          </button>
          <button
            className={`mvn-tab ${activeTab === 'mirror' ? 'active' : ''}`}
            onClick={() => setActiveTab('mirror')}
          >
            镜像源配置
          </button>
        </div>

        {activeTab === 'dependency' ? (
          <>
            <div className="mvn-search">
              <Search size={16} />
              <input
                type="text"
                className="mvn-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="搜索 Maven 依赖 (spring, lombok, jackson...)"
              />
            </div>

            <div className="mvn-content">
              <div className="mvn-dep-list">
                {popularLoading || loading ? (
                  <div className="mvn-dep-empty">
                    <Loader size={20} className="updater-spin" />
                    <span>加载中...</span>
                  </div>
                ) : filteredDeps.length === 0 ? (
                  <div className="mvn-dep-empty">未找到匹配的依赖</div>
                ) : (
                  filteredDeps.slice(0, 30).map((dep) => (
                    <div
                      key={`${dep.groupId}:${dep.artifactId}`}
                      className={`mvn-dep-item ${selectedDep === dep ? 'active' : ''}`}
                      onClick={() => selectDep(dep)}
                    >
                      <div className="mvn-dep-main">
                        <code className="mvn-dep-artifact">{dep.artifactId}</code>
                        <span className="mvn-dep-version">{dep.latestVersion}</span>
                      </div>
                      <span className="mvn-dep-group">{dep.groupId}</span>
                    </div>
                  ))
                )}
              </div>

              {selectedDep && (
                <div className="mvn-output-area">
                  <div className="mvn-version-selector">
                    <span className="mvn-section-label">版本</span>
                    {versionsLoading ? (
                      <Loader size={16} className="updater-spin" />
                    ) : (
                      <div className="mvn-versions">
                        {versions.map((v) => (
                          <button
                            key={v}
                            className={`mvn-version-btn ${selectedVersion === v ? 'active' : ''}`}
                            onClick={() => setSelectedVersion(v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mvn-format-tabs">
                    {(Object.keys(formatLabels) as OutputFormat[]).map((f) => (
                      <button
                        key={f}
                        className={`mvn-format-btn ${format === f ? 'active' : ''}`}
                        onClick={() => setFormat(f)}
                      >
                        {formatLabels[f]}
                      </button>
                    ))}
                  </div>

                  <div className="mvn-code-block">
                    <div className="mvn-code-header">
                      <span className="mvn-code-label">{formatLabels[format]}</span>
                      <button className="mvn-copy-btn" onClick={copyOutput}>
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? '已复制' : '复制'}
                      </button>
                    </div>
                    <pre className="mvn-code">
                      {generateOutput(selectedDep, selectedVersion, format)}
                    </pre>
                  </div>

                  <a
                    className="mvn-central-link"
                    href={`https://central.sonatype.com/artifact/${selectedDep.groupId}/${selectedDep.artifactId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={13} />在 Maven Central 查看
                  </a>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mvn-mirror-section">
            <div className="mvn-mirror-hint">
              <Globe size={14} />
              <span>
                国内 Maven 镜像源配置，将以下内容添加到 ~/.m2/settings.xml 的 &lt;mirrors&gt; 节点中
              </span>
            </div>

            <div className="mvn-mirror-list">
              {MAVEN_MIRRORS.map((mirror) => (
                <div
                  key={mirror.id}
                  className={`mvn-mirror-item ${selectedMirror.id === mirror.id ? 'active' : ''}`}
                  onClick={() => setSelectedMirror(mirror)}
                >
                  <div className="mvn-mirror-main">
                    <span className="mvn-mirror-name">{mirror.name}</span>
                    <span className="mvn-mirror-desc">{mirror.description}</span>
                  </div>
                  <code className="mvn-mirror-url">{mirror.url}</code>
                </div>
              ))}
            </div>

            <div className="mvn-code-block">
              <div className="mvn-code-header">
                <span className="mvn-code-label">settings.xml 配置</span>
                <button className="mvn-copy-btn" onClick={copyMirror}>
                  {mirrorCopied ? <Check size={13} /> : <Copy size={13} />}
                  {mirrorCopied ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="mvn-code">{generateMirrorConfig(selectedMirror)}</pre>
            </div>

            <div className="mvn-mirror-tips">
              <span className="mvn-tips-label">完整 settings.xml 示例</span>
              <div className="mvn-code-block">
                <div className="mvn-code-header">
                  <span className="mvn-code-label">settings.xml</span>
                  <button
                    className="mvn-copy-btn"
                    onClick={async () => {
                      const full = `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.2.0
          https://maven.apache.org/xsd/settings-1.2.0.xsd">
  <mirrors>
    <mirror>
      <id>${selectedMirror.id}</id>
      <name>${selectedMirror.name}</name>
      <url>${selectedMirror.url}</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>`
                      await navigator.clipboard.writeText(full)
                      setMirrorCopied(true)
                      setTimeout(() => setMirrorCopied(false), 1500)
                    }}
                  >
                    {mirrorCopied ? <Check size={13} /> : <Copy size={13} />}
                    {mirrorCopied ? '已复制' : '复制完整配置'}
                  </button>
                </div>
                <pre className="mvn-code">{`<?xml version="1.0" encoding="UTF-8"?>
<settings>
  <mirrors>
    <mirror>
      <id>${selectedMirror.id}</id>
      <name>${selectedMirror.name}</name>
      <url>${selectedMirror.url}</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
