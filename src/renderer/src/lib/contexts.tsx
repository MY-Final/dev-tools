import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface AppSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system'
    fontSize: 'small' | 'medium' | 'large'
    sidebarCollapsed: boolean
  }
  editor: {
    jsonIndent: 2 | 4
    autoCopy: boolean
    timestampFormat: 'seconds' | 'milliseconds'
  }
  updater: {
    autoCheck: boolean
  }
  translator: {
    baseUrl: string
    apiKey: string
    model: string
    systemPrompt: string
    temperature: number
    maxTokens: number
  }
  npmRegistry: string
  mavenSearchUrl: string
}

const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    theme: 'dark',
    fontSize: 'medium',
    sidebarCollapsed: false
  },
  editor: {
    jsonIndent: 2,
    autoCopy: false,
    timestampFormat: 'seconds'
  },
  updater: {
    autoCheck: true
  },
  translator: {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: 'You are a professional translator. Translate the following text from {sourceLang} to {targetLang}. Only output the translated text, nothing else. Do not add explanations, notes, or quotation marks.',
    temperature: 0.3,
    maxTokens: 4096
  },
  npmRegistry: '',
  mavenSearchUrl: ''
}

interface SettingsContextType {
  settings: AppSettings
  loading: boolean
  updateAppearance: (updates: Partial<AppSettings['appearance']>) => Promise<void>
  updateEditor: (updates: Partial<AppSettings['editor']>) => Promise<void>
  updateUpdater: (updates: Partial<AppSettings['updater']>) => Promise<void>
  updateTranslator: (updates: Partial<AppSettings['translator']>) => Promise<void>
  updateNpmRegistry: (npmRegistry: string) => Promise<void>
  updateMavenSearchUrl: (url: string) => Promise<void>
  resetToDefaults: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const loaded = await window.api.getSettings()
        setSettings(loaded)
      } catch {
        // 使用默认设置
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const updateAppearance = useCallback(async (updates: Partial<AppSettings['appearance']>) => {
    try {
      const updated = await window.api.updateAppearance(updates)
      setSettings(updated)
    } catch {
      // 忽略错误
    }
  }, [])

  const updateEditor = useCallback(async (updates: Partial<AppSettings['editor']>) => {
    try {
      const updated = await window.api.updateEditor(updates)
      setSettings(updated)
    } catch {
      // 忽略错误
    }
  }, [])

  const updateUpdater = useCallback(async (updates: Partial<AppSettings['updater']>) => {
    try {
      const updated = await window.api.updateUpdater(updates)
      setSettings(updated)
    } catch {
      // 忽略错误
    }
  }, [])

  const updateTranslator = useCallback(async (updates: Partial<AppSettings['translator']>) => {
    try {
      const updated = await window.api.updateTranslator(updates)
      setSettings(updated)
    } catch {
      // 忽略错误
    }
  }, [])

  const updateNpmRegistry = useCallback(async (npmRegistry: string) => {
    try {
      const updated = await window.api.updateNpmRegistry(npmRegistry)
      setSettings(updated)
    } catch {
      // 忽略错误
    }
  }, [])

  const updateMavenSearchUrl = useCallback(async (url: string) => {
    try {
      const updated = await window.api.updateMavenSearchUrl(url)
      setSettings(updated)
    } catch {
      // 忽略错误
    }
  }, [])

  const resetToDefaults = useCallback(async () => {
    try {
      const reset = await window.api.resetToDefaults()
      setSettings(reset)
    } catch {
      // 忽略错误
    }
  }, [])

  return (
    <SettingsContext.Provider
      value={{ settings, loading, updateAppearance, updateEditor, updateUpdater, updateTranslator, updateNpmRegistry, updateMavenSearchUrl, resetToDefaults }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
