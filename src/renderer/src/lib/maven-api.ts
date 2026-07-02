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

export async function searchMavenArtifacts(query: string, rows = 20): Promise<MavenDoc[]> {
  if (!query.trim()) return []
  try {
    const data = await window.maven.searchArtifacts(query, rows)
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
    const data = await window.maven.getVersions(groupId, artifactId)
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
