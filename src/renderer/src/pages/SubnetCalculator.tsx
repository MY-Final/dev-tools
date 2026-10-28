import { useState, useMemo, useCallback } from 'react'
import { Network, Copy, Check } from 'lucide-react'

interface SubnetInfo {
  networkAddress: string
  broadcastAddress: string
  subnetMask: string
  wildcardMask: string
  cidr: number
  binaryMask: string
  firstHost: string
  lastHost: string
  totalHosts: number
  usableHosts: number
  ipClass: string
  isPrivate: boolean
  ipBinary: string
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 0 || num > 255) return null
    result = (result << 8) | num
  }
  return result >>> 0
}

function numberToIp(num: number): string {
  return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.')
}

function formatBinaryIp(num: number): string {
  const binary = num.toString(2).padStart(32, '0')
  return `${binary.slice(0, 8)}.${binary.slice(8, 16)}.${binary.slice(16, 24)}.${binary.slice(24, 32)}`
}

function getIpClass(ip: string): string {
  const first = parseInt(ip.split('.')[0], 10)
  if (first >= 1 && first <= 126) return 'A'
  if (first >= 128 && first <= 191) return 'B'
  if (first >= 192 && first <= 223) return 'C'
  if (first >= 224 && first <= 239) return 'D (Multicast)'
  return 'E (Reserved)'
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  return false
}

function calculateSubnet(ip: string, cidr: number): SubnetInfo | null {
  const ipNum = ipToNumber(ip)
  if (ipNum === null || cidr < 0 || cidr > 32) return null

  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0
  const wildcard = ~mask >>> 0
  const network = (ipNum & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const totalHosts = Math.pow(2, 32 - cidr)
  const usableHosts = cidr === 32 ? 1 : cidr === 31 ? 2 : totalHosts - 2
  const firstHost = cidr >= 31 ? network : (network + 1) >>> 0
  const lastHost = cidr >= 31 ? broadcast : (broadcast - 1) >>> 0

  return {
    networkAddress: numberToIp(network),
    broadcastAddress: numberToIp(broadcast),
    subnetMask: numberToIp(mask),
    wildcardMask: numberToIp(wildcard),
    cidr,
    binaryMask: formatBinaryIp(mask),
    firstHost: numberToIp(firstHost),
    lastHost: numberToIp(lastHost),
    totalHosts,
    usableHosts,
    ipClass: getIpClass(ip),
    isPrivate: isPrivateIp(ip),
    ipBinary: formatBinaryIp(ipNum)
  }
}

const PREFIX_PRESETS = [8, 16, 24, 25]

function ResultRow({
  label,
  value,
  copyKey,
  copied,
  onCopy
}: {
  label: string
  value: string | number
  copyKey: string
  copied: string | null
  onCopy: (value: string, key: string) => void
}): React.JSX.Element {
  return (
    <div className="sc-result-row">
      <span className="sc-result-label">{label}</span>
      <code className="sc-result-value">{value}</code>
      <button
        type="button"
        className="tool-icon-btn sc-copy-btn"
        onClick={() => onCopy(String(value), copyKey)}
        aria-label={`复制${label}`}
        title={`复制${label}`}
      >
        {copied === copyKey ? (
          <Check size={12} aria-hidden="true" />
        ) : (
          <Copy size={12} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export default function SubnetCalculator(): React.JSX.Element {
  const [ipInput, setIpInput] = useState('192.168.1.100')
  const [cidrInput, setCidrInput] = useState('24')
  const [copied, setCopied] = useState<string | null>(null)

  const cidr = useMemo(() => {
    const num = parseInt(cidrInput, 10)
    return isNaN(num) ? -1 : Math.max(0, Math.min(32, num))
  }, [cidrInput])

  const info = useMemo(() => {
    if (cidr < 0) return null
    return calculateSubnet(ipInput, cidr)
  }, [ipInput, cidr])

  const parseCIDR = useCallback((value: string) => {
    const match = value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
    if (match) {
      setIpInput(match[1])
      setCidrInput(match[2])
    }
  }, [])

  const copyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  return (
    <div className="sc-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">IPv4 Subnet Calculator</h2>
          <p className="tool-page-desc">
            输入 IP 与前缀长度，实时计算网络地址、掩码、主机范围与二进制形式。
          </p>
        </div>
      </header>

      <section className="tool-panel sc-input-panel">
        <div className="sc-input-row">
          <label className="sc-input-group sc-input-ip">
            <span>IP 地址 / CIDR</span>
            <input
              type="text"
              className="tool-input tool-input--mono"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onBlur={(e) => parseCIDR(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') parseCIDR((e.target as HTMLInputElement).value)
              }}
              placeholder="192.168.1.100 或 192.168.1.100/24"
              spellCheck={false}
            />
          </label>

          <span className="sc-slash" aria-hidden="true">
            /
          </span>

          <label className="sc-input-group sc-input-prefix">
            <span>前缀</span>
            <input
              type="number"
              className="tool-input tool-input--mono"
              value={cidrInput}
              onChange={(e) => setCidrInput(e.target.value)}
              min={0}
              max={32}
              aria-label="CIDR 前缀长度"
            />
          </label>

          <div className="sc-presets">
            {PREFIX_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`sc-preset ${cidr === p ? 'active' : ''}`}
                onClick={() => setCidrInput(String(p))}
                aria-pressed={cidr === p}
              >
                /{p}
              </button>
            ))}
          </div>
        </div>
        {!info && (
          <p className="sc-error" role="status">
            请输入有效的 IPv4 地址，前缀长度需在 0–32 之间。
          </p>
        )}
      </section>

      {info ? (
        <>
          <section className="tool-panel sc-results-panel">
            <div className="tool-panel-head">
              <h3 className="tool-panel-title">计算结果</h3>
            </div>
            <div className="sc-results">
              <ResultRow
                label="网络地址"
                value={info.networkAddress}
                copyKey="network"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="广播地址"
                value={info.broadcastAddress}
                copyKey="broadcast"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="子网掩码"
                value={info.subnetMask}
                copyKey="mask"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="通配符掩码"
                value={info.wildcardMask}
                copyKey="wildcard"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="首个可用主机"
                value={info.firstHost}
                copyKey="first"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="最后可用主机"
                value={info.lastHost}
                copyKey="last"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="可用主机数"
                value={info.usableHosts.toLocaleString()}
                copyKey="usable"
                copied={copied}
                onCopy={copyValue}
              />
              <ResultRow
                label="地址总数"
                value={info.totalHosts.toLocaleString()}
                copyKey="total"
                copied={copied}
                onCopy={copyValue}
              />
            </div>
          </section>

          <section className="tool-panel sc-meta-panel">
            <div className="sc-info-grid">
              <div className="sc-info-item">
                <span className="sc-info-label">IP 类别</span>
                <span className="sc-info-value">{info.ipClass}</span>
              </div>
              <div className="sc-info-item">
                <span className="sc-info-label">地址类型</span>
                <span className="sc-info-value">{info.isPrivate ? 'Private' : 'Public'}</span>
              </div>
              <div className="sc-info-item">
                <span className="sc-info-label">前缀长度</span>
                <span className="sc-info-value">/{info.cidr}</span>
              </div>
            </div>
            <div className="sc-binary-list">
              <div className="sc-binary-item">
                <span className="sc-binary-label">IP Address</span>
                <code className="sc-binary-value">{info.ipBinary}</code>
              </div>
              <div className="sc-binary-item">
                <span className="sc-binary-label">Subnet Mask</span>
                <code className="sc-binary-value">{info.binaryMask}</code>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="tool-panel sc-empty">
          <Network size={26} aria-hidden="true" />
          <span>输入有效的 IPv4 地址和 CIDR 后显示结果</span>
        </section>
      )}
    </div>
  )
}
