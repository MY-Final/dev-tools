import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Network, ArrowRight } from 'lucide-react'

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

function ipRangeToCIDRs(startIp: number, endIp: number): string[] {
  const cidrs: string[] = []
  let current = startIp

  while (current <= endIp) {
    let maxSize = 32
    while (maxSize > 0) {
      const mask = (~0 << (32 - (maxSize - 1))) >>> 0
      const network = (current & mask) >>> 0
      if (network !== current) break
      maxSize--
    }

    let size = maxSize
    while (size > 0) {
      const mask = (~0 << (32 - size)) >>> 0
      const network = (current & mask) >>> 0
      const broadcast = (network | (~mask >>> 0)) >>> 0
      if (broadcast <= endIp) break
      size--
    }

    const cidr = size === 0 ? 32 : size
    cidrs.push(`${numberToIp(current)}/${cidr}`)

    const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0
    const broadcast = (current | (~mask >>> 0)) >>> 0
    current = broadcast + 1
  }

  return cidrs
}

function getCIDRHosts(cidr: string): number {
  const prefix = parseInt(cidr.split('/')[1], 10)
  return Math.pow(2, 32 - prefix)
}

interface RangeResult {
  cidrs: string[]
  totalIPs: number
  networkCount: number
  startIp: string
  endIp: string
}

export default function IPRangeExpander(): React.JSX.Element {
  const [startInput, setStartInput] = useState('192.168.1.1')
  const [endInput, setEndInput] = useState('192.168.1.254')
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo<RangeResult | null>(() => {
    const startNum = ipToNumber(startInput)
    const endNum = ipToNumber(endInput)
    if (startNum === null || endNum === null) return null
    if (startNum > endNum) return null

    const cidrs = ipRangeToCIDRs(startNum, endNum)
    const totalIPs = endNum - startNum + 1

    return {
      cidrs,
      totalIPs,
      networkCount: cidrs.length,
      startIp: startInput,
      endIp: endInput
    }
  }, [startInput, endInput])

  const copyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [])

  const copyAllCIDRs = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.cidrs.join('\n'))
      setCopied('all')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // fallback
    }
  }, [result])

  const loadSample = useCallback((start: string, end: string) => {
    setStartInput(start)
    setEndInput(end)
  }, [])

  return (
    <div className="re-page">
      <div className="re-card">
        <div className="re-header">
          <h2 className="re-title">IPv4 Range Expander</h2>
          <p className="re-subtitle">IP 范围转 CIDR 计算</p>
        </div>

        <div className="re-inputs">
          <div className="re-input-group">
            <label className="re-input-label">Start IP</label>
            <input
              type="text"
              className="re-input"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              placeholder="192.168.1.1"
            />
          </div>
          <div className="re-arrow">
            <ArrowRight size={20} />
          </div>
          <div className="re-input-group">
            <label className="re-input-label">End IP</label>
            <input
              type="text"
              className="re-input"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              placeholder="192.168.1.254"
            />
          </div>
        </div>

        <div className="re-samples">
          <button
            className="re-sample-btn"
            onClick={() => loadSample('192.168.1.1', '192.168.1.254')}
          >
            192.168.1.0/24
          </button>
          <button className="re-sample-btn" onClick={() => loadSample('10.0.0.1', '10.0.0.126')}>
            10.0.0.0/25
          </button>
          <button
            className="re-sample-btn"
            onClick={() => loadSample('192.168.1.1', '192.168.2.200')}
          >
            跨网段
          </button>
        </div>

        {result ? (
          <>
            <div className="re-stats">
              <div className="re-stat">
                <span className="re-stat-label">Total IPs</span>
                <span className="re-stat-value">{result.totalIPs.toLocaleString()}</span>
              </div>
              <div className="re-stat">
                <span className="re-stat-label">CIDR Blocks</span>
                <span className="re-stat-value">{result.networkCount}</span>
              </div>
            </div>

            <div className="re-section">
              <div className="re-section-header">
                <span className="re-section-label">CIDR Result</span>
                {result.cidrs.length > 1 && (
                  <button className="re-copy-all-btn" onClick={copyAllCIDRs}>
                    {copied === 'all' ? <Check size={12} /> : <Copy size={12} />}
                    {copied === 'all' ? '已复制' : '复制全部'}
                  </button>
                )}
              </div>
              <div className="re-cidr-list">
                {result.cidrs.map((cidr, i) => {
                  const hosts = getCIDRHosts(cidr)
                  return (
                    <div
                      key={i}
                      className="re-cidr-item"
                      onClick={() => copyValue(cidr, `cidr-${i}`)}
                    >
                      <code className="re-cidr-value">{cidr}</code>
                      <span className="re-cidr-hosts">{hosts} IPs</span>
                      {copied === `cidr-${i}` && (
                        <span className="re-copied-badge">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="re-visual">
              <div className="re-visual-row">
                <div className="re-visual-block start">
                  <span className="re-visual-label">Start</span>
                  <code className="re-visual-ip">{result.startIp}</code>
                </div>
                <div className="re-visual-line" />
                <div className="re-visual-block middle">
                  <span className="re-visual-label">
                    {result.networkCount} CIDR{result.networkCount > 1 ? 's' : ''}
                  </span>
                  <code className="re-visual-ip">{result.cidrs[0]}</code>
                </div>
                <div className="re-visual-line" />
                <div className="re-visual-block end">
                  <span className="re-visual-label">End</span>
                  <code className="re-visual-ip">{result.endIp}</code>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="re-empty">
            <Network size={32} />
            <span>输入有效的起始和结束 IP 地址</span>
          </div>
        )}
      </div>
    </div>
  )
}
