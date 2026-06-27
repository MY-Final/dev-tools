import { useState, useMemo } from 'react'
import { MonitorSmartphone, Copy, Check, RotateCcw } from 'lucide-react'
import '../styles/user-agent-parser.css'

interface UAResult {
  browser: { name: string; version: string }
  os: { name: string; version: string }
  device: { type: string; vendor: string; model: string }
  engine: { name: string; version: string }
}

function parseUA(ua: string): UAResult | null {
  if (!ua.trim()) return null

  const s = ua

  // Browser
  let browserName = '未知'
  let browserVersion = ''
  const browserPatterns: [RegExp, string][] = [
    [/Edge\/([\d.]+)/, 'Edge'],
    [/Edg\/([\d.]+)/, 'Edge (Chromium)'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Safari\/([\d.]+)/, 'Safari'],
    [/MSIE ([\d.]+)/, 'IE'],
    [/Trident\/.*rv:([\d.]+)/, 'IE'],
  ]
  for (const [re, name] of browserPatterns) {
    const m = s.match(re)
    if (m) {
      browserName = name
      browserVersion = m[1]
      break
    }
  }

  // Engine
  let engineName = '未知'
  let engineVersion = ''
  if (/AppleWebKit\//.test(s) && !/Chrome\//.test(s) && !/Edge\//.test(s) && !/Edg\//.test(s)) {
    engineName = 'WebKit'
    const m = s.match(/AppleWebKit\/([\d.]+)/)
    if (m) engineVersion = m[1]
  } else if (/Gecko\//.test(s) && /Firefox/.test(s)) {
    engineName = 'Gecko'
    const m = s.match(/rv:([\d.]+)/) || s.match(/Gecko\/([\d.]+)/)
    if (m) engineVersion = m[1]
  } else if (/Trident\//.test(s)) {
    engineName = 'Trident'
    const m = s.match(/Trident\/([\d.]+)/)
    if (m) engineVersion = m[1]
  } else if (/Edge\//.test(s) || /Edg\//.test(s)) {
    engineName = 'EdgeHTML / Blink'
  } else if (/Chrome\//.test(s)) {
    engineName = 'Blink'
  }

  // OS
  let osName = '未知'
  let osVersion = ''
  if (/Windows NT ([\d.]+)/.test(s)) {
    osName = 'Windows'
    const m = s.match(/Windows NT ([\d.]+)/)
    if (m) {
      osVersion = m[1]
      const winMap: Record<string, string> = {
        '10.0': '10 / 11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
        '6.0': 'Vista',
        '5.2': 'XP x64',
        '5.1': 'XP',
      }
      osVersion = winMap[osVersion] || osVersion
    }
  } else if (/Mac OS X ([\d_]+)/.test(s)) {
    osName = 'macOS'
    const m = s.match(/Mac OS X ([\d_]+)/)
    if (m) osVersion = m[1].replace(/_/g, '.')
  } else if (/Android ([\d.]+)/.test(s)) {
    osName = 'Android'
    const m = s.match(/Android ([\d.]+)/)
    if (m) osVersion = m[1]
  } else if (/iPhone OS ([\d_]+)/.test(s) || /iPad OS ([\d_]+)/.test(s) || /CPU OS ([\d_]+)/.test(s)) {
    osName = 'iOS'
    const m = s.match(/(?:iPhone OS|iPad OS|CPU OS) ([\d_]+)/)
    if (m) osVersion = m[1].replace(/_/g, '.')
  } else if (/Linux/.test(s)) {
    osName = 'Linux'
  } else if (/CrOS/.test(s)) {
    osName = 'ChromeOS'
  }

  // Device type
  let deviceType = '桌面'
  let deviceVendor = ''
  let deviceModel = ''

  if (/iPhone/.test(s)) {
    deviceType = '手机'
    deviceVendor = 'Apple'
    deviceModel = 'iPhone'
  } else if (/iPad/.test(s)) {
    deviceType = '平板'
    deviceVendor = 'Apple'
    deviceModel = 'iPad'
  } else if (/Android/.test(s)) {
    deviceType = /Mobile/.test(s) ? '手机' : '平板'
    const m = s.match(/Android ([\d.]+); (.+?)(?: Build\/|\)) ?/)
    if (m) {
      const raw = m[2].replace(/; /g, ' ')
      deviceModel = raw
    }
  } else if (/Windows/.test(s)) {
    deviceType = '桌面'
  } else if (/Macintosh/.test(s) || /Mac OS/.test(s)) {
    deviceType = '桌面'
    deviceVendor = 'Apple'
    deviceModel = 'Mac'
  } else if (/CrOS/.test(s)) {
    deviceType = '桌面'
  } else if (/Linux/.test(s) && !/Android/.test(s)) {
    deviceType = '桌面'
  }

  // Try to extract device vendor from common patterns
  if (!deviceVendor) {
    const vendorPatterns: [RegExp, string][] = [
      [/Samsung/i, 'Samsung'],
      [/Xiaomi|Mi \d/i, 'Xiaomi'],
      [/Huawei|Honor/i, 'Huawei'],
      [/OPPO|A\d{2,3}/, 'OPPO'],
      [/vivo/i, 'Vivo'],
      [/Nexus|Pixel/, 'Google'],
      [/SM-[A-Z]/, 'Samsung'],
    ]
    for (const [p, name] of vendorPatterns) {
      if (p.test(s)) {
        deviceVendor = name
        break
      }
    }
  }

  return {
    browser: { name: browserName, version: browserVersion },
    os: { name: osName, version: osVersion },
    device: { type: deviceType, vendor: deviceVendor, model: deviceModel },
    engine: { name: engineName, version: engineVersion }
  }
}

export default function UserAgentParser(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const result = useMemo(() => parseUA(input), [input])

  // Pre-fill with current UA on mount
  useMemo(() => {
    if (typeof navigator !== 'undefined' && !input) {
      setInput(navigator.userAgent)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClear = (): void => {
    setInput(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  }

  const copyResult = (): void => {
    if (!result) return
    const text = [
      `浏览器: ${result.browser.name} ${result.browser.version}`,
      `引擎: ${result.engine.name} ${result.engine.version}`,
      `操作系统: ${result.os.name} ${result.os.version}`,
      `设备: ${result.device.type} ${result.device.vendor} ${result.device.model}`.trim()
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const InfoRow = ({ label, value }: { label: string; value: string }): React.JSX.Element => (
    <div className="uap-info-row">
      <span className="uap-info-label">{label}</span>
      <span className="uap-info-value">{value || '-'}</span>
    </div>
  )

  return (
    <div className="uap-page">
      {/* Input */}
      <div className="uap-input-area">
        <textarea
          className="uap-textarea"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴 User-Agent 字符串..."
        />
        <div className="uap-input-actions">
          <button className="uap-btn uap-btn-restore" onClick={handleClear}>
            <RotateCcw size={12} /> 重置
          </button>
        </div>
      </div>

      {/* Result */}
      {result ? (
        <div className="uap-result">
          <div className="uap-result-header">
            <span className="uap-result-title">解析结果</span>
            <button className="uap-copy-btn" onClick={copyResult}>
              {copied ? <Check size={12} /> : <Copy size={12} />} 复制结果
            </button>
          </div>

          <div className="uap-section">
            <div className="uap-section-title">🌐 浏览器</div>
            <InfoRow label="名称" value={result.browser.name} />
            <InfoRow label="版本" value={result.browser.version} />
          </div>

          <div className="uap-section">
            <div className="uap-section-title">⚙️ 引擎</div>
            <InfoRow label="名称" value={result.engine.name} />
            <InfoRow label="版本" value={result.engine.version} />
          </div>

          <div className="uap-section">
            <div className="uap-section-title">💻 操作系统</div>
            <InfoRow label="名称" value={result.os.name} />
            <InfoRow label="版本" value={result.os.version} />
          </div>

          <div className="uap-section">
            <div className="uap-section-title">📱 设备</div>
            <InfoRow label="类型" value={result.device.type} />
            <InfoRow label="厂商" value={result.device.vendor} />
            <InfoRow label="型号" value={result.device.model} />
          </div>
        </div>
      ) : (
        <div className="uap-empty">
          <MonitorSmartphone size={32} className="uap-empty-icon" />
          <span>输入 User-Agent 字符串查看解析结果</span>
        </div>
      )}
    </div>
  )
}
