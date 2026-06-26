import { useState, useEffect } from 'react'
import { Info, GitBranch, Heart, ExternalLink, Star, Keyboard } from 'lucide-react'
import appIcon from '../assets/about.png'
import '../styles/about.css'

export default function About(): React.JSX.Element {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.updater
      .getVersion()
      .then(setVersion)
      .catch(() => setVersion('1.0.0'))
  }, [])

  return (
    <div className="about-page">
      <div className="about-bg-decoration" />

      <div className="about-card">
        <div className="about-header">
          <div className="about-logo">
            <img src={appIcon} alt="dev-tools" className="about-logo-img" />
          </div>
          <h2 className="about-title">dev-tools</h2>
          <p className="about-subtitle">常用开发工具集合，提升你的开发效率</p>
        </div>

        <div className="about-info">
          <div className="about-section">
            <h3 className="about-section-title">
              <Info size={16} className="about-section-icon" />
              关于应用
            </h3>
            <div className="about-section-content">
              <p className="about-text">
                dev-tools 是一款基于 Electron
                开发的桌面开发工具集合，集成了常用的开发工具，帮助开发者提升工作效率。
              </p>
              <p className="about-text">
                应用采用现代化的技术栈，使用 React + TypeScript 构建，界面简洁美观，操作流畅。
              </p>
            </div>
          </div>

          <div className="about-section">
            <h3 className="about-section-title">
              <Star size={16} className="about-section-icon" />
              主要特性
            </h3>
            <div className="about-features">
              <div className="about-feature-item">
                <span className="about-feature-dot" />
                <span>62+ 实用开发工具，涵盖编码、转换、生成、调试</span>
              </div>
              <div className="about-feature-item">
                <span className="about-feature-dot" />
                <span>全局命令面板 (Ctrl+K)，键盘驱动的快捷操作</span>
              </div>
              <div className="about-feature-item">
                <span className="about-feature-dot" />
                <span>深色 / 浅色 / 跟随系统 三种主题模式</span>
              </div>
              <div className="about-feature-item">
                <span className="about-feature-dot" />
                <span>代码编辑器集成 (CodeMirror)，语法高亮</span>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h3 className="about-section-title">
              <Star size={16} className="about-section-icon" />
              技术栈
            </h3>
            <div className="about-tech-stack">
              <span className="about-tech-badge">Electron</span>
              <span className="about-tech-badge">React 19</span>
              <span className="about-tech-badge">TypeScript</span>
              <span className="about-tech-badge">Vite</span>
              <span className="about-tech-badge">CodeMirror 6</span>
              <span className="about-tech-badge">Lucide</span>
              <span className="about-tech-badge">Radix UI</span>
            </div>
          </div>

          <div className="about-section">
            <h3 className="about-section-title">
              <Keyboard size={16} className="about-section-icon" />
              快捷键
            </h3>
            <div className="about-shortcuts">
              <div className="about-shortcut-item">
                <kbd>Ctrl+K</kbd>
                <span>全局命令面板</span>
              </div>
              <div className="about-shortcut-item">
                <kbd>Ctrl+Shift+V</kbd>
                <span>读取剪贴板</span>
              </div>
              <div className="about-shortcut-item">
                <kbd>Space</kbd>
                <span>计时器开始 / 暂停</span>
              </div>
              <div className="about-shortcut-item">
                <kbd>R</kbd>
                <span>计时器重置</span>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h3 className="about-section-title">
              <ExternalLink size={16} className="about-section-icon" />
              相关链接
            </h3>
            <div className="about-links">
              <a
                className="about-link"
                href="https://github.com/MY-Final/dev-tools"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitBranch size={15} className="about-section-icon" />
                GitHub 仓库
              </a>
            </div>
          </div>
        </div>

        <div className="about-footer">
          <p className="about-copyright">
            Made with <Heart size={12} className="about-heart" /> by dev-tools
          </p>
          <p className="about-version">Version {version || '1.0.0'}</p>
        </div>
      </div>
    </div>
  )
}
