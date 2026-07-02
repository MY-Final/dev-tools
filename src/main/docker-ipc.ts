import { ipcMain } from 'electron'
import { settingsStore } from './settings'

const DEFAULT_REGISTRIES = [
  'https://index.docker.io/v1/search',
  'https://hub-mirror.c.163.com/v1/search'
]

function getMirrors(): string[] {
  const custom = settingsStore.getSettings().npmRegistry
  if (custom?.trim()) {
    const base = custom.trim().replace(/\/+$/, '')
    return [`${base}/v1/search`, ...DEFAULT_REGISTRIES]
  }
  return DEFAULT_REGISTRIES
}

async function fetchDockerSearch(query: string, size: number): Promise<Response | null> {
  for (const base of getMirrors()) {
    try {
      const params = new URLSearchParams({ q: query, n: String(size || 20) })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${base}?${params}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
    } catch {
      continue
    }
  }
  return null
}

export function registerDockerHandlers(): void {
  ipcMain.handle('docker:search', async (_event, query: string, size: number) => {
    try {
      const res = await fetchDockerSearch(query, size)
      if (!res) return []
      const data = await res.json()
      return (data.results || []).map((r: { name: string; description: string; star_count: number; pull_count: number; is_automated: boolean; is_official: boolean }) => ({
        name: r.name,
        description: r.description || '',
        stars: r.star_count || 0,
        pulls: r.pull_count || 0,
        isOfficial: r.is_official || false,
        isAutomated: r.is_automated || false,
        imageName: r.name
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('docker:tags', async (_event, imageName: string) => {
    try {
      const path = imageName.includes('/')
        ? imageName
        : 'library/' + imageName
      const res = await fetch(`https://hub.docker.com/v2/repositories/${path}/tags?page_size=50`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.results || []).map((t: { name: string; digest: string; images: { size: number; architecture: string; os: string }[]; last_updated: string }) => ({
        name: t.name,
        digest: t.digest || '',
        digestShort: t.digest ? t.digest.replace('sha256:', '').slice(0, 12) : '',
        size: t.images?.[0]?.size || 0,
        arch: t.images?.[0]?.architecture || '',
        os: t.images?.[0]?.os || '',
        lastUpdated: t.last_updated || ''
      }))
    } catch {
      return []
    }
  })
}
