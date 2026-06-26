/**
 * Web API initializer — replaces Electron IPC with direct browser API calls.
 * Imported once in main.tsx.
 */

// Translator API — direct OpenAI-compatible API calls
window.translator = {
  translate: async (text: string, sourceLang: string, targetLang: string) => {
    const settings = JSON.parse(localStorage.getItem('dev-tools-settings') || '{}')
    const translator = settings.translator || {}
    const { baseUrl, apiKey, model, systemPrompt, temperature, maxTokens } = translator
    if (!baseUrl || !apiKey) {
      return { error: '请在设置中配置 AI 翻译' }
    }
    try {
      const prompt = (systemPrompt || '')
        .replace('{sourceLang}', sourceLang)
        .replace('{targetLang}', targetLang)
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: text }
          ],
          temperature: temperature || 0.3,
          max_tokens: maxTokens || 4096
        })
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        return { error: `API 错误 (${res.status}): ${err}` }
      }
      const data = await res.json()
      return { translation: data.choices?.[0]?.message?.content || '' }
    } catch (err) {
      return { error: (err as Error).message || '请求失败' }
    }
  },
  testConnection: async () => {
    const settings = JSON.parse(localStorage.getItem('dev-tools-settings') || '{}')
    const translator = settings.translator || {}
    const { baseUrl, apiKey } = translator
    if (!baseUrl || !apiKey) {
      return { error: '请配置 Base URL 和 API Key' }
    }
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      if (!res.ok) return { error: `连接失败 (${res.status})` }
      const data = await res.json()
      const models = (data.data || []).map((m: { id: string }) => m.id)
      return { success: true, models }
    } catch (err) {
      return { error: (err as Error).message || '连接失败' }
    }
  }
}

// Docker Hub API — direct fetch
window.docker = {
  search: async (query: string, size = 20) => {
    try {
      const url = `https://hub.docker.com/api/content/v1/products/search?q=${encodeURIComponent(query)}&page_size=${size}&type=image`
      const res = await fetch(url, { headers: { 'Search-Version': 'v3' } })
      const data = await res.json()
      return (data.results || []).map((r: { name: string; short_description: string; star_count: number; pull_count: number; is_official: boolean; is_automated: boolean }) => ({
        name: r.name?.split('/').pop() || r.name,
        description: r.short_description || '',
        stars: r.star_count || 0,
        pulls: r.pull_count || 0,
        isOfficial: r.is_official || false,
        isAutomated: r.is_automated || false,
        imageName: r.name
      }))
    } catch {
      // Fallback to old API
      try {
        const url = `https://index.docker.io/v1/search?q=${encodeURIComponent(query)}&n=${size}`
        const res = await fetch(url)
        const data = await res.json()
        return (data.results || []).map((r: { name: string; description: string; star_count: number; is_official: boolean; is_automated: boolean }) => ({
          name: r.name?.split('/').pop() || r.name,
          description: r.description || '',
          stars: r.star_count || 0,
          pulls: 0,
          isOfficial: r.is_official || false,
          isAutomated: r.is_automated || false,
          imageName: r.name
        }))
      } catch {
        return []
      }
    }
  },
  getTags: async (imageName: string) => {
    try {
      const url = `https://hub.docker.com/v2/repositories/${imageName}/tags?page_size=50`
      const res = await fetch(url)
      const data = await res.json()
      return (data.results || []).map((t: { name: string; digest: string; images: Array<{ size: number; architecture: string; os: string; last_pushed: string }> }) => {
        const img = t.images?.[0] || {}
        return {
          name: t.name,
          digest: t.digest || '',
          digestShort: t.digest ? t.digest.replace('sha256:', '').substring(0, 12) : '',
          size: img.size || 0,
          arch: img.architecture || '',
          os: img.os || '',
          lastUpdated: img.last_pushed || ''
        }
      })
    } catch {
      return []
    }
  }
}
