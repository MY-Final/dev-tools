import { useEffect } from 'react'
import {
  Monitor,
  Globe,
  Cpu,
  Wifi,
  MapPin,
  Battery,
  HardDrive,
  Check,
  X,
  Copy,
  Download,
  RefreshCw,
  Navigation
} from 'lucide-react'
import { useDeviceInfo } from '@renderer/tools/device-info/useDeviceInfo'

function InfoRow({
  label,
  value,
  onCopy
}: {
  label: string
  value: string
  onCopy?: (text: string) => void
}): React.JSX.Element {
  return (
    <div className="device-info-row">
      <span className="device-info-label">{label}</span>
      <div className="device-info-value-wrapper">
        <span className="device-info-value">{value}</span>
        {onCopy && (
          <button className="device-info-copy-btn" onClick={() => onCopy(value)} title="复制">
            <Copy size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function CapabilityBadge({
  name,
  supported
}: {
  name: string
  supported: boolean
}): React.JSX.Element {
  return (
    <div className={`device-capability ${supported ? 'supported' : 'unsupported'}`}>
      {supported ? <Check size={12} /> : <X size={12} />}
      <span>{name}</span>
    </div>
  )
}

function InfoCard({
  icon: Icon,
  title,
  children
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="device-card">
      <div className="device-card-header">
        <Icon size={16} className="device-card-icon" />
        <h3 className="device-card-title">{title}</h3>
      </div>
      <div className="device-card-body">{children}</div>
    </div>
  )
}

export default function DeviceInfo(): React.JSX.Element {
  const {
    info,
    loading,
    toast,
    locationLoading,
    fetchLocation,
    handleCopy,
    handleCopyAll,
    handleExport,
    refresh
  } = useDeviceInfo()

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading || !info) {
    return (
      <div className="device-page">
        <div className="device-loading">
          <RefreshCw size={24} className="device-loading-icon" />
          <span>正在检测设备信息...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="device-page">
      <div className="device-bg-decoration" />

      <div className="device-container">
        <div className="device-header">
          <div className="device-header-info">
            <h2 className="device-title">设备信息</h2>
            <p className="device-subtitle">获取当前设备和浏览器运行环境</p>
          </div>
          <div className="device-header-actions">
            <button className="device-action-btn" onClick={handleCopyAll}>
              <Copy size={14} />
              复制全部
            </button>
            <button className="device-action-btn" onClick={handleExport}>
              <Download size={14} />
              导出 JSON
            </button>
          </div>
        </div>

        <div className="device-grid">
          {/* 屏幕信息 */}
          <InfoCard icon={Monitor} title="屏幕">
            <InfoRow
              label="屏幕分辨率"
              value={`${info.screen.screenWidth} × ${info.screen.screenHeight}`}
              onCopy={handleCopy}
            />
            <InfoRow
              label="窗口大小"
              value={`${info.screen.windowWidth} × ${info.screen.windowHeight}`}
              onCopy={handleCopy}
            />
            <InfoRow label="设备像素比" value={`${info.screen.pixelRatio}x`} onCopy={handleCopy} />
            <InfoRow
              label="颜色深度"
              value={`${info.screen.colorDepth} bits`}
              onCopy={handleCopy}
            />
            <InfoRow label="方向" value={info.screen.orientation} onCopy={handleCopy} />
            <InfoRow label="旋转角度" value={`${info.screen.angle}°`} onCopy={handleCopy} />
          </InfoCard>

          {/* 浏览器信息 */}
          <InfoCard icon={Globe} title="浏览器">
            <InfoRow label="浏览器" value={info.browser.vendor} onCopy={handleCopy} />
            <InfoRow label="语言" value={info.browser.language} onCopy={handleCopy} />
            <InfoRow label="时区" value={info.browser.timezone} onCopy={handleCopy} />
            <InfoRow
              label="Cookie"
              value={info.browser.cookieEnabled ? '启用' : '禁用'}
              onCopy={handleCopy}
            />
            <InfoRow label="JavaScript" value="启用" onCopy={handleCopy} />
          </InfoCard>

          {/* 系统信息 */}
          <InfoCard icon={Cpu} title="系统">
            <InfoRow label="平台" value={info.system.platform} onCopy={handleCopy} />
            <InfoRow label="操作系统" value={info.system.os} onCopy={handleCopy} />
            <InfoRow label="CPU 核心数" value={`${info.system.cpuCores} 核`} onCopy={handleCopy} />
            <InfoRow
              label="内存"
              value={info.system.memory ? `${info.system.memory} GB` : '未知'}
              onCopy={handleCopy}
            />
            <InfoRow
              label="触控支持"
              value={info.system.touchSupport ? '是' : '否'}
              onCopy={handleCopy}
            />
          </InfoCard>

          {/* 网络信息 */}
          <InfoCard icon={Wifi} title="网络">
            <InfoRow
              label="在线状态"
              value={info.network.online ? '在线' : '离线'}
              onCopy={handleCopy}
            />
            <InfoRow label="网络类型" value={info.network.type} onCopy={handleCopy} />
            <InfoRow
              label="下行速度"
              value={info.network.downlink ? `${info.network.downlink} Mbps` : '未知'}
              onCopy={handleCopy}
            />
            <InfoRow
              label="延迟"
              value={info.network.rtt ? `${info.network.rtt} ms` : '未知'}
              onCopy={handleCopy}
            />
          </InfoCard>

          {/* 地理位置 */}
          <InfoCard icon={MapPin} title="地理位置">
            {info.location.latitude !== null ? (
              <>
                <InfoRow label="纬度" value={`${info.location.latitude}`} onCopy={handleCopy} />
                <InfoRow label="经度" value={`${info.location.longitude}`} onCopy={handleCopy} />
                <InfoRow
                  label="精度"
                  value={
                    info.location.accuracy
                      ? `${info.location.accuracy} 米`
                      : info.location.ipBased
                        ? 'IP 定位'
                        : '未知'
                  }
                  onCopy={handleCopy}
                />
              </>
            ) : (
              <div className="device-location-placeholder">
                {info.location.error ? (
                  <span className="device-location-error">{info.location.error}</span>
                ) : (
                  <span className="device-location-text">未授权获取位置</span>
                )}
                <button
                  className="device-location-btn"
                  onClick={fetchLocation}
                  disabled={locationLoading}
                >
                  <Navigation size={14} />
                  {locationLoading ? '获取中...' : '获取位置'}
                </button>
              </div>
            )}
          </InfoCard>

          {/* 电池信息 */}
          <InfoCard icon={Battery} title="电池">
            {info.battery.supported ? (
              <>
                <InfoRow
                  label="电量"
                  value={info.battery.level !== null ? `${info.battery.level}%` : '未知'}
                  onCopy={handleCopy}
                />
                <InfoRow
                  label="充电状态"
                  value={info.battery.charging ? '充电中' : '未充电'}
                  onCopy={handleCopy}
                />
                {info.battery.charging && info.battery.chargingTime !== null && (
                  <InfoRow
                    label="充满时间"
                    value={`${Math.round(info.battery.chargingTime / 60)} 分钟`}
                    onCopy={handleCopy}
                  />
                )}
                {!info.battery.charging && info.battery.dischargingTime !== null && (
                  <InfoRow
                    label="剩余时间"
                    value={`${Math.round(info.battery.dischargingTime / 60)} 分钟`}
                    onCopy={handleCopy}
                  />
                )}
              </>
            ) : (
              <div className="device-unsupported">当前浏览器不支持电池 API</div>
            )}
          </InfoCard>
        </div>

        {/* 硬件能力 */}
        <div className="device-card device-card-full">
          <div className="device-card-header">
            <HardDrive size={16} className="device-card-icon" />
            <h3 className="device-card-title">浏览器能力</h3>
          </div>
          <div className="device-capabilities">
            <CapabilityBadge name="WebGL" supported={info.capabilities.webgl} />
            <CapabilityBadge name="WebGPU" supported={info.capabilities.webgpu} />
            <CapabilityBadge name="WebRTC" supported={info.capabilities.webrtc} />
            <CapabilityBadge name="WebSocket" supported={info.capabilities.websocket} />
            <CapabilityBadge name="Service Worker" supported={info.capabilities.serviceWorker} />
            <CapabilityBadge name="IndexedDB" supported={info.capabilities.indexedDB} />
            <CapabilityBadge name="LocalStorage" supported={info.capabilities.localStorage} />
            <CapabilityBadge name="SessionStorage" supported={info.capabilities.sessionStorage} />
            <CapabilityBadge name="Clipboard API" supported={info.capabilities.clipboardAPI} />
          </div>
        </div>

        {/* User Agent */}
        <div className="device-card device-card-full">
          <div className="device-card-header">
            <Globe size={16} className="device-card-icon" />
            <h3 className="device-card-title">User Agent</h3>
          </div>
          <div className="device-ua-content">
            <code className="device-ua-text">{info.browser.userAgent}</code>
            <button className="device-ua-copy" onClick={() => handleCopy(info.browser.userAgent)}>
              <Copy size={14} />
              复制
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="device-toast">
          <Check size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
