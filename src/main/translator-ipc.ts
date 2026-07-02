import { ipcMain } from 'electron'
import { settingsStore } from './settings'

export function registerTranslatorHandlers(): void {
  ipcMain.handle(
    'translator:translate',
    async (_event, text: string, sourceLang: string, targetLang: string) => {
      const config = settingsStore.getTranslator()
      if (!config.baseUrl || !config.apiKey) {
        return { error: '请先在设置中配置 AI 翻译的 Base URL 和 API Key' }
      }

      const baseUrl = config.baseUrl.replace(/\/$/, '')
      const systemPrompt = config.systemPrompt
        .replace(/\{sourceLang\}/g, sourceLang)
        .replace(/\{targetLang\}/g, targetLang)
      const temperature = config.temperature ?? 0.3
      const maxTokens = config.maxTokens ?? 4096

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text }
            ],
            temperature,
            max_tokens: maxTokens
          }),
          signal: controller.signal
        })

        clearTimeout(timeout)

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          if (res.status === 401) return { error: 'API Key 无效 (401 Unauthorized)' }
          if (res.status === 404) return { error: 'Base URL 无效或路径不正确 (404 Not Found)' }
          if (res.status === 429) return { error: '请求过于频繁，请稍后再试 (429 Rate Limit)' }
          return { error: `API 请求失败 (${res.status}): ${errText.slice(0, 200)}` }
        }

        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content
        if (!content) {
          return { error: 'API 响应格式异常，未获取到翻译结果' }
        }
        return { translation: content.trim() }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return { error: '请求超时 (30s)，请检查网络或 Base URL' }
        }
        return { error: `网络请求失败: ${(err as Error).message}` }
      }
    }
  )

  ipcMain.handle('translator:test-connection', async () => {
    const config = settingsStore.getTranslator()
    if (!config.baseUrl || !config.apiKey) {
      return { error: '请先配置 Base URL 和 API Key' }
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        const models = data?.data?.map((m: { id: string }) => m.id) || []
        return { success: true, models }
      }

      if (res.status === 401) return { error: 'API Key 无效 (401 Unauthorized)' }
      if (res.status === 404) return { error: 'Base URL 无效或路径不正确 (404 Not Found)' }
      return { error: `连接失败 (${res.status})` }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { error: '连接超时 (10s)，请检查网络' }
      }
      return { error: `连接失败: ${(err as Error).message}` }
    }
  })
}
