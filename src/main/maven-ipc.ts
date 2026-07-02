import { ipcMain } from 'electron'
import { settingsStore } from './settings'

const MAVEN_DEFAULT_SEARCH = 'https://search.maven.org/solrsearch/select'

async function mavenFetch(params: URLSearchParams, retries = 2, customUrl?: string): Promise<Response | null> {
  const baseUrl = customUrl || MAVEN_DEFAULT_SEARCH
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`${baseUrl}?${params}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
      if (res.status === 504 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
        continue
      }
    } catch {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
    }
  }
  return null
}

export function registerMavenHandlers(): void {
  ipcMain.handle('maven:search', async (_event, query: string, rows: number) => {
    const config = settingsStore.getSettings()
    const params = new URLSearchParams({ q: query, rows: String(rows || 20), wt: 'json' })
    const res = await mavenFetch(params, 2, config.mavenSearchUrl)
    if (!res) return { response: { docs: [] } }
    return res.json()
  })

  ipcMain.handle('maven:versions', async (_event, groupId: string, artifactId: string) => {
    const config = settingsStore.getSettings()
    const params = new URLSearchParams({ q: `g:${groupId} AND a:${artifactId}`, core: 'gav', rows: '15', wt: 'json' })
    const res = await mavenFetch(params, 1, config.mavenSearchUrl)
    if (!res) return { response: { docs: [] } }
    return res.json()
  })
}
