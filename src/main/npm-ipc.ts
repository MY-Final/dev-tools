import { ipcMain } from 'electron'
import { settingsStore } from './settings'

const DEFAULT_REGISTRIES = [
  'https://registry.npmjs.org',
  'https://registry.npmmirror.com'
]

function getRegistries(): string[] {
  const custom = settingsStore.getSettings().npmRegistry
  if (custom?.trim()) return [custom.trim(), ...DEFAULT_REGISTRIES]
  return DEFAULT_REGISTRIES
}

async function fetchNpm(path: string): Promise<Response | null> {
  for (const base of getRegistries()) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${base}${path}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
    } catch {
      continue
    }
  }
  return null
}

export function registerNpmHandlers(): void {
  ipcMain.handle('npm:search', async (_event, query: string, size: number) => {
    try {
      const params = new URLSearchParams({ text: query, size: String(size || 20) })
      const res = await fetchNpm(`/-/v1/search?${params}`)
      if (!res) { console.warn('[npm] all mirrors failed for:', query); return [] }
      const data = await res.json()
      return data?.objects?.map((o: { package: { name: string; version: string; description: string; keywords?: string[]; publisher?: { username: string }; links?: { npm: string }; date: string } }) => ({
        name: o.package.name,
        version: o.package.version,
        description: o.package.description,
        keywords: o.package.keywords || [],
        publisher: o.package.publisher?.username || '',
        link: o.package.links?.npm || '',
        date: o.package.date
      })) || []
    } catch {
      return []
    }
  })

  ipcMain.handle('npm:package', async (_event, packageName: string) => {
    try {
      const res = await fetchNpm(`/${encodeURIComponent(packageName)}`)
      if (!res) return null
      const data = await res.json()
      return {
        name: data.name,
        description: data.description,
        license: data.license,
        homepage: data.homepage,
        repository: data.repository?.url || '',
        keywords: data.keywords || [],
        maintainers: (data.maintainers || []).map((m: { name: string }) => m.name),
        versions: Object.keys(data.versions || {}).sort((a, b) => {
          const ap = a.split('.').map(Number)
          const bp = b.split('.').map(Number)
          for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
            const av = ap[i] ?? 0; const bv = bp[i] ?? 0
            if (av !== bv) return bv - av
          }
          return a.localeCompare(b)
        })
      }
    } catch {
      return null
    }
  })
}
