import { useState, useCallback } from 'react'
import { Usb, Copy, Check, Download, X, Cpu, Monitor } from 'lucide-react'
import '../styles/usb-viewer.css'

// ── VID Manufacturer database ──────────────────────────────────

const VID_DB: Record<string, string> = {
  '045E': 'Microsoft',
  '046D': 'Logitech',
  '054C': 'Sony',
  '057E': 'Nintendo',
  '1532': 'Razer',
  '1038': 'SteelSeries',
  '0B05': 'ASUS',
  '04D9': 'Holtek',
  '056E': 'Elecom',
  '0E6A': 'Megawin',
  '0955': 'NVIDIA',
  '8087': 'Intel',
  '04F2': 'Chicony',
  '0461': 'Primax',
  '0457': 'Silicon Integrated Systems',
  '04CA': 'Lite-On',
  '05AC': 'Apple',
  '18D1': 'Google',
  '04E8': 'Samsung',
  '22B8': 'Motorola',
  '0A5C': 'Broadcom',
  '093A': 'Pixart',
  '046A': 'Cherry',
  '03F0': 'HP',
  '413C': 'Dell',
  '17EF': 'Lenovo',
  '04F3': 'Elan',
  '0CF3': 'Qualcomm',
  '0483': 'STMicroelectronics',
  '0603': 'Novatek',
  '1D50': 'OpenMoko',
  '16C0': 'Van Ooijen',
  '03EB': 'Atmel',
  '04D8': 'Microchip',
  '239A': 'Adafruit',
  '2E8A': 'Raspberry Pi',
  '2341': 'Arduino',
  '1A86': 'QinHeng',
  '10C4': 'Silicon Labs',
  '0403': 'FTDI',
  '067B': 'Prolific',
  '04B4': 'Cypress',
  '0D28': 'NXP',
  '1366': 'Segger'
}

function lookupVendor(vid: string): string | null {
  const upper = vid.toUpperCase().replace(/^0X/, '')
  return VID_DB[upper] || null
}

// ── Types ──────────────────────────────────────────────────────

interface HIDDeviceInfo {
  productName: string
  manufacturerName: string
  vendorId: number
  productId: number
  opened: boolean
  collections?: HIDCollectionInfo[]
}

interface HIDCollectionInfo {
  usagePage: number
  usage: number
  type: string
  inputReports: Array<{ reportId: number; byteLength: number }>
  outputReports: Array<{ reportId: number; byteLength: number }>
  featureReports: Array<{ reportId: number; byteLength: number }>
}

// ── Helpers ────────────────────────────────────────────────────

function toHex4(n: number): string {
  return '0x' + n.toString(16).toUpperCase().padStart(4, '0')
}

function toHex2(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0')
}

function usagePageName(page: number): string {
  const MAP: Record<number, string> = {
    0x01: 'Generic Desktop',
    0x02: 'Simulation Controls',
    0x03: 'VR Controls',
    0x04: 'Sport Controls',
    0x05: 'Game Controls',
    0x06: 'Generic Device',
    0x07: 'Keyboard',
    0x08: 'LEDs',
    0x09: 'Button',
    0x0A: 'Ordinal',
    0x0B: 'Telephony',
    0x0C: 'Consumer',
    0x0D: 'Digitizer',
    0x0F: 'PID',
    0x10: 'Unicode',
    0x14: 'Alphanumeric Display',
    0x40: 'Medical Instruments',
    0x80: 'Monitor',
    0x81: 'Power',
    0x84: 'Power Device',
    0x85: 'Battery System',
    0x8C: 'Bar Code Scanner',
    0x8D: 'Scale',
    0x8E: 'Magnetic Stripe Reader',
    0x90: 'Camera Control',
    0x91: 'Arcade',
    0xFF00: 'Vendor Defined'
  }
  return MAP[page] || `Unknown (${toHex4(page)})`
}

// ── Component ──────────────────────────────────────────────────

export default function USBViewer(): React.JSX.Element {
  const [device, setDevice] = useState<HIDDeviceInfo | null>(null)
  const [hidDevice, setHidDevice] = useState<HIDDevice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [descriptorHex, setDescriptorHex] = useState<string | null>(null)
  const [inputReports, setInputReports] = useState<Array<{ reportId: number; data: number[]; time: number }>>([])
  const [monitoring, setMonitoring] = useState(false)

  const connect = useCallback(async () => {
    setError(null)
    setLoading(true)
    setDevice(null)
    setHidDevice(null)
    setDescriptorHex(null)
    setInputReports([])
    setMonitoring(false)

    try {
      // Check WebHID support
      if (!('hid' in navigator)) {
        setError('当前环境不支持 WebHID API。请在 Electron 或 Chrome/Edge 中打开。')
        setLoading(false)
        return
      }

      const devices = await (navigator as Navigator & { hid: { requestDevice: (opts: { filters: Array<{ usagePage?: number }> }) => Promise<HIDDevice[]> } }).hid.requestDevice({
        filters: [{ usagePage: 0xFF00 }, { usagePage: 0x01 }]
      })

      if (devices.length === 0) {
        setError('未选择设备')
        setLoading(false)
        return
      }

      const dev = devices[0] as HIDDevice
      setHidDevice(dev)

      // Collect basic info without opening yet
      const info: HIDDeviceInfo = {
        productName: dev.productName || 'Unknown',
        manufacturerName: dev.manufacturerName || 'Unknown',
        vendorId: dev.vendorId,
        productId: dev.productId,
        opened: dev.opened
      }

      // Try to open and read collections
      try {
        if (!dev.opened) {
          await dev.open()
        }

        const collections: HIDCollectionInfo[] = []
        if ('collections' in dev) {
          const cols = (dev as HIDDevice & { collections: Array<{ usagePage: number; usage: number; inputReports?: Array<{ reportId: number; byteLength: number }>; outputReports?: Array<{ reportId: number; byteLength: number }>; featureReports?: Array<{ reportId: number; byteLength: number }>; type?: number }> }).collections
          if (cols) {
            for (const col of cols) {
              const typeStr = col.type === 0 ? 'Physical' : col.type === 1 ? 'Application' : col.type === 2 ? 'Logical' : 'Unknown'
              collections.push({
                usagePage: col.usagePage,
                usage: col.usage,
                type: typeStr,
                inputReports: (col.inputReports || []).map((r) => ({ reportId: r.reportId || 0, byteLength: r.byteLength || 0 })),
                outputReports: (col.outputReports || []).map((r) => ({ reportId: r.reportId || 0, byteLength: r.byteLength || 0 })),
                featureReports: (col.featureReports || []).map((r) => ({ reportId: r.reportId || 0, byteLength: r.byteLength || 0 }))
              })
            }
          }
        }
        info.collections = collections
        info.opened = dev.opened

        // Try to read report descriptor
        try {
          // Some devices expose descriptor via reportDescriptor
          // This is a raw buffer of the HID report descriptor
          if ('reportDescriptor' in dev) {
            // Can't easily read without sending reports
          }
        } catch {
          // ignore
        }
      } catch {
        // Could not open — still show basic info
      }

      setDevice(info)
    } catch (err) {
      setError((err as Error).message || '连接失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (hidDevice) {
      try {
        await hidDevice.close()
      } catch {
        // ignore
      }
    }
    setHidDevice(null)
    setDevice(null)
    setDescriptorHex(null)
    setInputReports([])
    setMonitoring(false)
  }, [hidDevice])

  const startMonitoring = useCallback(async () => {
    if (!hidDevice || !hidDevice.opened) return
    setMonitoring(true)
    setInputReports([])

    const readLoop = async (): Promise<void> => {
      try {
        // Try to listen for input reports
        hidDevice.addEventListener('inputreport', ((e: HIDInputReportEvent) => {
          const data = Array.from(new Uint8Array(e.data.buffer))
          setInputReports((prev) => [
            { reportId: e.reportId, data, time: Date.now() },
            ...prev.slice(0, 49) // Keep last 50
          ])
        }) as EventListener)
      } catch {
        // Device might not support input report events
      }
    }

    readLoop()
  }, [hidDevice])

  const stopMonitoring = useCallback(() => {
    setMonitoring(false)
  }, [])

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  const exportJSON = useCallback(() => {
    if (!device) return
    const json = JSON.stringify(device, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usb-device-${toHex4(device.vendorId)}-${toHex4(device.productId)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [device])

  const vidHex = device ? toHex4(device.vendorId) : ''
  const pidHex = device ? toHex4(device.productId) : ''
  const vendorName = device ? lookupVendor(vidHex) : null

  return (
    <div className="uv-page">
      <div className="uv-card">
        <div className="uv-header">
          <h2 className="uv-title">USB Device Viewer</h2>
          <p className="uv-subtitle">WebHID — 查看 USB HID 设备信息</p>
        </div>

        {/* Connect button */}
        <div className="uv-connect-area">
          {!device ? (
            <button className="uv-connect-btn" onClick={connect} disabled={loading}>
              <Usb size={18} />
              {loading ? '连接中...' : '连接 USB 设备'}
            </button>
          ) : (
            <button className="uv-connect-btn uv-connect-disconnect" onClick={disconnect}>
              <X size={18} />
              断开设备
            </button>
          )}
        </div>

        {error && (
          <div className="uv-error">
            <Monitor size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Device info */}
        {device && (
          <>
            <div className="uv-device-header">
              <div className="uv-device-name">{device.productName}</div>
              <div className="uv-device-maker">{device.manufacturerName}</div>
            </div>

            {/* VID / PID */}
            <div className="uv-vidpid">
              <div className="uv-vidpid-card">
                <span className="uv-vidpid-label">VID</span>
                <span className="uv-vidpid-value">{vidHex}</span>
                {vendorName && <span className="uv-vidpid-vendor">{vendorName}</span>}
              </div>
              <div className="uv-vidpid-card">
                <span className="uv-vidpid-label">PID</span>
                <span className="uv-vidpid-value">{pidHex}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="uv-actions">
              <button className="uv-btn" onClick={() => copyText('vidpid', `${vidHex}:${pidHex}`)}>
                {copied === 'vidpid' ? <Check size={13} /> : <Copy size={13} />}
                {copied === 'vidpid' ? '已复制' : '复制 VID:PID'}
              </button>
              <button className="uv-btn" onClick={exportJSON}>
                <Download size={13} />
                导出 JSON
              </button>
              {!monitoring ? (
                <button className="uv-btn" onClick={startMonitoring}>
                  <Cpu size={13} />
                  开始监控
                </button>
              ) : (
                <button className="uv-btn uv-btn-active" onClick={stopMonitoring}>
                  <Cpu size={13} />
                  停止监控
                </button>
              )}
            </div>

            {/* Collections */}
            {device.collections && device.collections.length > 0 && (
              <div className="uv-section">
                <h4 className="uv-section-title">HID Collections ({device.collections.length})</h4>
                {device.collections.map((col, i) => (
                  <div key={i} className="uv-collection">
                    <div className="uv-col-header">
                      <span className="uv-col-type">{col.type}</span>
                      <span className="uv-col-usage">
                        {usagePageName(col.usagePage)} / {toHex4(col.usage)}
                      </span>
                    </div>
                    <div className="uv-col-reports">
                      {col.inputReports.length > 0 && (
                        <span className="uv-col-report">
                          输入: {col.inputReports.map((r) => `ID ${r.reportId} (${r.byteLength}B)`).join(', ')}
                        </span>
                      )}
                      {col.outputReports.length > 0 && (
                        <span className="uv-col-report">
                          输出: {col.outputReports.map((r) => `ID ${r.reportId} (${r.byteLength}B)`).join(', ')}
                        </span>
                      )}
                      {col.featureReports.length > 0 && (
                        <span className="uv-col-report">
                          功能: {col.featureReports.map((r) => `ID ${r.reportId} (${r.byteLength}B)`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input reports */}
            {inputReports.length > 0 && (
              <div className="uv-section">
                <h4 className="uv-section-title">Input Reports ({inputReports.length})</h4>
                <div className="uv-reports-list">
                  {inputReports.map((r, i) => (
                    <div key={i} className="uv-report-row">
                      <span className="uv-report-id">ID {r.reportId}</span>
                      <code className="uv-report-data">
                        [{r.data.map((b) => toHex2(b)).join(' ')}]
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!device.collections?.length && !descriptorHex && (
              <div className="uv-note">
                该设备未提供 HID 集合信息。某些设备需要特定驱动才能读取报告描述符。
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
