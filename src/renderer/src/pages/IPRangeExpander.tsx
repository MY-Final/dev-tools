import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, Network } from 'lucide-react'

const MAX_CIDR_BLOCKS = 64

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null

  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (value < 0 || value > 255) return null
    result = result * 256 + value
  }
  return result
}

function numberToIp(num: number): string {
  return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.')
}

function ipRangeToCIDRs(startIp: number, endIp: number): { cidrs: string[]; truncated: boolean } {
  const cidrs: string[] = []
  let current = startIp

  while (current <= endIp && cidrs.length < MAX_CIDR_BLOCKS) {
    let prefix = 32

    while (prefix > 0) {
      const candidatePrefix = prefix - 1
      const blockSize = 2 ** (32 - candidatePrefix)
      if (current % blockSize !== 0) break

      const blockEnd = current + blockSize - 1
      if (blockEnd > endIp) break
      prefix = candidatePrefix
    }

    const blockSize = 2 ** (32 - prefix)
    cidrs.push(`${numberToIp(current)}/${prefix}`)
    current += blockSize
  }

  return {
    cidrs,
    truncated: current <= endIp
  }
}
function getCIDRHosts(cidr: string): number {
  const prefix = Number.parseInt(cidr.split('/')[1], 10)
  return 2 ** (32 - prefix)
}

interface RangeResult {
  cidrs: string[]
  totalIPs: number
  networkCount: number
  startIp: string
  endIp: string
  truncated: boolean
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

    const { cidrs, truncated } = ipRangeToCIDRs(startNum, endNum)
    const totalIPs = endNum - startNum + 1

    return {
      cidrs,
      totalIPs,
      networkCount: cidrs.length,
      startIp: startInput,
      endIp: endInput,
      truncated
    }
  }, [startInput, endInput])

  const copyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Fallback is intentionally unavailable so clipboard errors are not reported as success.
    }
  }, [])

  const copyAllCIDRs = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.cidrs.join('\n'))
      setCopied('all')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Fallback is intentionally unavailable so clipboard errors are not reported as success.
    }
  }, [result])

  const loadSample = useCallback((start: string, end: string) => {
    setStartInput(start)
    setEndInput(end)
  }, [])

  const invalid = result === null

  return (
    <div className="re-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">IPv4 Range Expander</h2>
          <p className="tool-page-desc">把任意 IPv4 地址区间拆分为最小的 CIDR 块集合。</p>
        </div>
      </header>

      <div className="tool-split re-layout">
        <section className="tool-panel re-input-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">地址范围</h3>
          </div>
          <div className="re-body">
            <div className="re-inputs">
              <label className="re-input-group">
                <span>起始 IP</span>
                <input
                  type="text"
                  className="tool-input tool-input--mono re-input"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  placeholder="192.168.1.1"
                  inputMode="decimal"
                  spellCheck={false}
                />
              </label>
              <span className="re-arrow" aria-hidden="true">
                →
              </span>
              <label className="re-input-group">
                <span>结束 IP</span>
                <input
                  type="text"
                  className="tool-input tool-input--mono re-input"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  placeholder="192.168.1.254"
                  inputMode="decimal"
                  spellCheck={false}
                />
              </label>
            </div>

            {invalid && (
              <p className="re-error" role="status">
                请输入有效的 IPv4 地址，并确保起始地址不大于结束地址。
              </p>
            )}

            <div className="re-samples">
              <span className="re-samples-label">示例</span>
              <button
                type="button"
                className="re-sample-btn"
                onClick={() => loadSample('192.168.1.1', '192.168.1.254')}
              >
                /24 网段
              </button>
              <button
                type="button"
                className="re-sample-btn"
                onClick={() => loadSample('10.0.0.1', '10.0.0.126')}
              >
                /25 网段
              </button>
              <button
                type="button"
                className="re-sample-btn"
                onClick={() => loadSample('192.168.1.1', '192.168.2.200')}
              >
                跨网段
              </button>
            </div>
          </div>
        </section>

        <section className="tool-panel re-result-panel">
          <div className="tool-panel-head">
            <h3 className="tool-panel-title">CIDR 结果</h3>
            {result && <span className="re-result-count">{result.networkCount} 块</span>}
            {result && result.cidrs.length > 1 && (
              <button type="button" className="tool-btn re-copy-all" onClick={copyAllCIDRs}>
                {copied === 'all' ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied === 'all' ? '已复制' : '复制全部'}
              </button>
            )}
          </div>

          {result ? (
            <>
              <div className="re-stats">
                <div className="re-stat">
                  <span className="re-stat-label">地址总数</span>
                  <span className="re-stat-value">{result.totalIPs.toLocaleString()}</span>
                </div>
                <div className="re-stat">
                  <span className="re-stat-label">CIDR 块</span>
                  <span className="re-stat-value">{result.networkCount}</span>
                </div>
                <div className="re-stat">
                  <span className="re-stat-label">范围</span>
                  <span className="re-stat-value re-stat-value--range">
                    {result.startIp} – {result.endIp}
                  </span>
                </div>
              </div>

              <div className="re-cidr-list">
                {result.cidrs.map((cidr, i) => {
                  const hosts = getCIDRHosts(cidr)
                  return (
                    <button
                      key={i}
                      type="button"
                      className="re-cidr-item"
                      onClick={() => copyValue(cidr, `cidr-${i}`)}
                      title={`复制 ${cidr}`}
                    >
                      <code className="re-cidr-value">{cidr}</code>
                      <span className="re-cidr-hosts">{hosts.toLocaleString()} IPs</span>
                      <span className="re-cidr-copy" aria-hidden="true">
                        {copied === `cidr-${i}` ? <Check size={13} /> : <Copy size={13} />}
                      </span>
                    </button>
                  )
                })}
              </div>

              {result.truncated && (
                <div className="re-notice">
                  <Network size={14} aria-hidden="true" />
                  <span>范围超过安全上限，仅显示前 {MAX_CIDR_BLOCKS} 个 CIDR 块</span>
                </div>
              )}
            </>
          ) : (
            <div className="re-empty">
              <Network size={26} aria-hidden="true" />
              <span>输入有效的起始和结束 IP 后显示结果</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
