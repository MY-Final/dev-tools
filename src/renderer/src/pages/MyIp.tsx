import { useEffect, useRef } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { useMyIp } from '@renderer/tools/my-ip/useMyIp'

export default function MyIp(): React.JSX.Element {
  const { ipInfo, loading, error, toast, copiedIndex, fetchLocalIp, handleCopyIp, handleCopyAll } =
    useMyIp()

  const fetched = useRef(false)

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true
      fetchLocalIp()
    }
  }, [fetchLocalIp])

  return (
    <div className="myip-page tool-page">
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <h2 className="tool-page-title">内网 IP</h2>
          <p className="tool-page-desc">检测本机各网络接口的内网地址，点击地址即可复制。</p>
        </div>
        <div className="tool-page-actions">
          <button
            type="button"
            className="tool-btn tool-btn--outline"
            onClick={fetchLocalIp}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} aria-hidden="true" />
            {loading ? '检测中…' : '重新检测'}
          </button>
          {ipInfo && ipInfo.ips.length > 0 && (
            <button type="button" className="tool-btn" onClick={handleCopyAll}>
              <Copy size={14} aria-hidden="true" />
              复制全部
            </button>
          )}
        </div>
      </header>

      <section className="tool-panel myip-panel">
        <div className="tool-panel-head">
          <h3 className="tool-panel-title">本机内网地址</h3>
          {ipInfo && ipInfo.ips.length > 0 && (
            <span className="myip-count">{ipInfo.ips.length} 个地址</span>
          )}
        </div>

        {loading ? (
          <div className="myip-state">
            <RefreshCw size={18} className="myip-loading-icon" aria-hidden="true" />
            <span>检测中…</span>
          </div>
        ) : error ? (
          <div className="myip-state myip-state--error">{error}</div>
        ) : ipInfo && ipInfo.ips.length > 0 ? (
          <div className="myip-ips-list">
            {ipInfo.ips.map((ip, index) => (
              <button
                key={ip}
                type="button"
                className="myip-ip-item"
                onClick={() => handleCopyIp(ip, index)}
                title={`复制 ${ip}`}
              >
                <span className="myip-ip">{ip}</span>
                <span className="myip-copy-icon" aria-hidden="true">
                  {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="myip-state">未检测到内网地址，点击「重新检测」重试。</div>
        )}
      </section>

      {toast && (
        <div className="myip-toast">
          <Check size={14} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
