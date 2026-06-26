export interface MavenDoc {
  groupId: string
  artifactId: string
  latestVersion: string
  versionCount: number
  packaging: string
  timestamp: number
}

interface SolrDoc {
  g: string
  a: string
  latestVersion: string
  versionCount: number
  p: string
  timestamp: number
}

function toMavenDoc(doc: SolrDoc): MavenDoc {
  return {
    groupId: doc.g,
    artifactId: doc.a,
    latestVersion: doc.latestVersion,
    versionCount: doc.versionCount,
    packaging: doc.p,
    timestamp: doc.timestamp
  }
}

const MAVEN_SEARCH_URL = 'https://search.maven.org/solrsearch/select'

export async function searchMavenArtifacts(query: string, rows = 20): Promise<MavenDoc[]> {
  if (!query.trim()) return []
  try {
    const url = `${MAVEN_SEARCH_URL}?q=${encodeURIComponent(query)}&rows=${rows}&wt=json`
    const res = await fetch(url)
    const data = await res.json()
    const docs = (data as { response?: { docs?: SolrDoc[] } }).response?.docs ?? []
    return docs.map(toMavenDoc)
  } catch {
    return []
  }
}

export async function getArtifactVersions(
  groupId: string,
  artifactId: string
): Promise<string[]> {
  try {
    const url = `${MAVEN_SEARCH_URL}?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}&rows=100&wt=json`
    const res = await fetch(url)
    const data = await res.json()
    const docs = (data as { response?: { docs?: { v: string }[] } }).response?.docs ?? []
    const versions = docs.map((d) => d.v)
    return versions.sort((a, b) => {
      const ap = a.split('.').map(Number)
      const bp = b.split('.').map(Number)
      for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const av = ap[i] ?? 0
        const bv = bp[i] ?? 0
        if (av !== bv) return bv - av
      }
      return a.localeCompare(b)
    })
  } catch {
    return []
  }
}

export async function fetchPopularDeps(): Promise<MavenDoc[]> {
  try {
    const url = `${MAVEN_SEARCH_URL}?q=popular&rows=20&wt=json`
    const res = await fetch(url)
    const data = await res.json()
    const docs = (data as { response?: { docs?: SolrDoc[] } }).response?.docs ?? []
    return docs.map(toMavenDoc)
  } catch {
    return []
  }
}

// Initialize window.maven with direct API calls
window.maven = {
  searchArtifacts: async (query: string, rows: number) => {
    const url = `${MAVEN_SEARCH_URL}?q=${encodeURIComponent(query)}&rows=${rows}&wt=json`
    const res = await fetch(url)
    return res.json()
  },
  getVersions: async (groupId: string, artifactId: string) => {
    const url = `${MAVEN_SEARCH_URL}?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}&rows=100&wt=json`
    const res = await fetch(url)
    return res.json()
  },
  fetchPopular: async () => {
    const url = `${MAVEN_SEARCH_URL}?q=popular&rows=20&wt=json`
    const res = await fetch(url)
    const data = await res.json()
    return (data as { response?: { docs?: unknown[] } }).response?.docs ?? []
  }
}
