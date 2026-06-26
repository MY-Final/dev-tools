import { useState, useCallback } from 'react'

export interface LocalIpInfo {
  ips: string[]
  hostname: string
}

function getLocalIps(): Promise<string[]> {
  return new Promise((resolve) => {
    const ips: Set<string> = new Set()
    const pc = new RTCPeerConnection({ iceServers: [] })

    pc.createDataChannel('')
    pc.createOffer().then((offer) => pc.setLocalDescription(offer))

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.close()
        resolve([...ips])
        return
      }

      const candidate = event.candidate.candidate
      const match = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/)
      if (match && match[1] !== '0.0.0.0') {
        ips.add(match[1])
      }
    }

    // 超时处理
    setTimeout(() => {
      pc.close()
      resolve([...ips])
    }, 3000)
  })
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export function useMyIp() {
  const [ipInfo, setIpInfo] = useState<LocalIpInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 1500)
  }, [])

  const fetchLocalIp = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const ips = await getLocalIps()
      if (ips.length === 0) {
        setError('未检测到内网 IP')
        return
      }

      setIpInfo({
        ips,
        hostname: window.location.hostname || 'localhost'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取失败')
      showToast('获取失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const handleCopyIp = useCallback(
    (ip: string, index: number) => {
      navigator.clipboard.writeText(ip)
      setCopiedIndex(index)
      showToast('已复制 IP 地址')
      setTimeout(() => setCopiedIndex(null), 1500)
    },
    [showToast]
  )

  const handleCopyAll = useCallback(() => {
    if (ipInfo) {
      const text = ipInfo.ips.map((ip) => `内网 IP: ${ip}`).join('\n')
      navigator.clipboard.writeText(text)
      showToast('已复制全部 IP')
    }
  }, [ipInfo, showToast])

  return {
    ipInfo,
    loading,
    error,
    toast,
    copiedIndex,
    fetchLocalIp,
    handleCopyIp,
    handleCopyAll
  }
}
