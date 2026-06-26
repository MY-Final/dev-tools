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
      <div className="sc-result-value-row">
        <code className="sc-result-value">{value}</code>
        <button className="sc-copy-btn" onClick={() => onCopy(String(value), copyKey)}>
          {copied === copyKey ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
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
    <div className="sc-page">
      <div className="sc-card">
        <div className="sc-header">
          <h2 className="sc-title">IPv4 Subnet Calculator</h2>
          <p className="sc-subtitle">计算 IPv4 子网信息</p>
        </div>

        <div className="sc-input-area">
          <div className="sc-input-group">
            <label className="sc-input-label">CIDR 表示法</label>
            <input
              type="text"
              className="sc-input sc-input-cidr"
              placeholder="192.168.1.100/24"
              onBlur={(e) => parseCIDR(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') parseCIDR((e.target as HTMLInputElement).value)
              }}
            />
          </div>

          <div className="sc-inputs-row">
            <div className="sc-input-group">
              <label className="sc-input-label">IP Address</label>
              <input
                type="text"
                className="sc-input"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="sc-input-group sc-input-cidr-small">
              <label className="sc-input-label">CIDR</label>
              <input
                type="number"
                className="sc-input"
                value={cidrInput}
                onChange={(e) => setCidrInput(e.target.value)}
                min={0}
                max={32}
                placeholder="24"
              />
            </div>
          </div>
        </div>

        {info ? (
          <>
            <div className="sc-section">
              <span className="sc-section-label">计算结果</span>
              <div className="sc-results">
                <ResultRow
                  label="Network Address"
                  value={info.networkAddress}
                  copyKey="network"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="Broadcast Address"
                  value={info.broadcastAddress}
                  copyKey="broadcast"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="Subnet Mask"
                  value={info.subnetMask}
                  copyKey="mask"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="Wildcard Mask"
                  value={info.wildcardMask}
                  copyKey="wildcard"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="First Host"
                  value={info.firstHost}
                  copyKey="first"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="Last Host"
                  value={info.lastHost}
                  copyKey="last"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="Usable Hosts"
                  value={info.usableHosts.toLocaleString()}
                  copyKey="usable"
                  copied={copied}
                  onCopy={copyValue}
                />
                <ResultRow
                  label="Total Hosts"
                  value={info.totalHosts.toLocaleString()}
                  copyKey="total"
                  copied={copied}
                  onCopy={copyValue}
                />
              </div>
            </div>

            <div className="sc-section">
              <span className="sc-section-label">IP 信息</span>
              <div className="sc-info-grid">
                <div className="sc-info-item">
                  <span className="sc-info-label">CIDR Prefix</span>
                  <span className="sc-info-value">/{info.cidr}</span>
                </div>
                <div className="sc-info-item">
                  <span className="sc-info-label">IP Class</span>
                  <span className="sc-info-value">{info.ipClass}</span>
                </div>
                <div className="sc-info-item">
                  <span className="sc-info-label">Type</span>
                  <span className="sc-info-value">{info.isPrivate ? 'Private' : 'Public'}</span>
                </div>
              </div>
            </div>

            <div className="sc-section">
              <span className="sc-section-label">Binary</span>
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
            </div>
          </>
        ) : (
          <div className="sc-empty">
            <Network size={32} />
            <span>输入有效的 IPv4 地址和 CIDR</span>
          </div>
        )}
      </div>
    </div>
  )
}
