import { useEffect, useRef } from 'react'
import { Copy, Check, RefreshCw, Wifi } from 'lucide-react'
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
    <div className="myip-page">
      <div className="myip-bg-decoration" />

      <div className="myip-card">
        <div className="myip-header">
          <h2 className="myip-title">内网 IP</h2>
          <p className="myip-subtitle">查看本机内网 IP 地址</p>
        </div>

        <div className="myip-address-section">
          <div className="myip-address-label">本机内网地址</div>
          <div className="myip-address-value">
            {loading ? (
              <div className="myip-loading">
                <RefreshCw size={20} className="myip-loading-icon" />
                <span>检测中...</span>
              </div>
            ) : error ? (
              <div className="myip-error">{error}</div>
            ) : ipInfo && ipInfo.ips.length > 0 ? (
              <div className="myip-ips-list">
                {ipInfo.ips.map((ip, index) => (
                  <div key={ip} className="myip-ip-item">
                    <div className="myip-ip-info">
                      <Wifi size={16} className="myip-ip-icon" />
                      <span className="myip-ip">{ip}</span>
                    </div>
                    <button
                      className="myip-copy-btn"
                      onClick={() => handleCopyIp(ip, index)}
                      title="复制 IP"
                    >
                      {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="myip-placeholder">点击下方按钮检测</div>
            )}
          </div>
        </div>

        <div className="myip-actions">
          <button className="myip-refresh-btn" onClick={fetchLocalIp} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            {loading ? '检测中...' : '重新检测'}
          </button>

          {ipInfo && ipInfo.ips.length > 0 && (
            <button className="myip-copy-all-btn" onClick={handleCopyAll}>
              <Copy size={14} />
              复制全部
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="myip-toast">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
