export interface NpmSearchResult {
  name: string
  version: string
  description: string
  keywords: string[]
  publisher: string
  link: string
  date: string
}

export interface NpmPackageDetail {
  name: string
  description: string
  license: string
  homepage: string
  repository: string
  keywords: string[]
  maintainers: string[]
  versions: string[]
}

const NPM_REGISTRY = 'https://registry.npmjs.org'

export async function searchNpm(query: string, size = 20): Promise<NpmSearchResult[] | null> {
  if (!query.trim()) return null
  try {
    const url = `https://api.npms.io/v2/search?q=${encodeURIComponent(query)}&size=${size}`
    const res = await fetch(url)
    const data = await res.json()
    return (data.results || []).map((r: { package: { name: string; version: string; description: string; keywords?: string[]; publisher?: { username?: string }; links?: { npm?: string }; date?: string } }) => ({
      name: r.package.name,
      version: r.package.version,
      description: r.package.description,
      keywords: r.package.keywords || [],
      publisher: r.package.publisher?.username || '',
      link: r.package.links?.npm || '',
      date: r.package.date || ''
    }))
  } catch {
    return null
  }
}

export async function getNpmPackage(name: string): Promise<NpmPackageDetail | null> {
  try {
    const url = `${NPM_REGISTRY}/${encodeURIComponent(name)}`
    const res = await fetch(url)
    const data = await res.json()
    return {
      name: data.name,
      description: data.description || '',
      license: data.license || '',
      homepage: data.homepage || '',
      repository: data.repository?.url || '',
      keywords: data.keywords || [],
      maintainers: (data.maintainers || []).map((m: { name: string }) => m.name),
      versions: Object.keys(data.versions || {}).reverse()
    }
  } catch {
    return null
  }
}

// Initialize window.npm with direct API calls
window.npm = {
  search: async (query: string, size = 20) => {
    const results = await searchNpm(query, size)
    return results || []
  },
  getPackage: async (name: string) => getNpmPackage(name)
}
