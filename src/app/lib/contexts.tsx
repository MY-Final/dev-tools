import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

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
  npmRegistry: ''
}

const STORAGE_KEY = 'dev-tools-settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

type SettingsContextType = {
  settings: AppSettings
  updateAppearance: (updates: Partial<AppSettings['appearance']>) => Promise<AppSettings>
  updateEditor: (updates: Partial<AppSettings['editor']>) => Promise<AppSettings>
  updateUpdater: (updates: Partial<AppSettings['updater']>) => Promise<AppSettings>
  updateTranslator: (updates: Partial<AppSettings['translator']>) => Promise<AppSettings>
  updateNpmRegistry: (npmRegistry: string) => Promise<AppSettings>
  resetToDefaults: () => Promise<AppSettings>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const updateAppearance = useCallback(async (updates: Partial<AppSettings['appearance']>) => {
    setSettings(prev => {
      const next = { ...prev, appearance: { ...prev.appearance, ...updates } }
      saveSettings(next)
      return next
    })
    return settings
  }, [settings])

  const updateEditor = useCallback(async (updates: Partial<AppSettings['editor']>) => {
    setSettings(prev => {
      const next = { ...prev, editor: { ...prev.editor, ...updates } }
      saveSettings(next)
      return next
    })
    return settings
  }, [settings])

  const updateUpdater = useCallback(async (updates: Partial<AppSettings['updater']>) => {
    setSettings(prev => {
      const next = { ...prev, updater: { ...prev.updater, ...updates } }
      saveSettings(next)
      return next
    })
    return settings
  }, [settings])

  const updateTranslator = useCallback(async (updates: Partial<AppSettings['translator']>) => {
    setSettings(prev => {
      const next = { ...prev, translator: { ...prev.translator, ...updates } }
      saveSettings(next)
      return next
    })
    return settings
  }, [settings])

  const updateNpmRegistry = useCallback(async (npmRegistry: string) => {
    setSettings(prev => {
      const next = { ...prev, npmRegistry }
      saveSettings(next)
      return next
    })
    return settings
  }, [settings])

  const resetToDefaults = useCallback(async () => {
    const defaults = { ...DEFAULT_SETTINGS }
    setSettings(defaults)
    saveSettings(defaults)
    return defaults
  }, [])

  return (
    <SettingsContext.Provider value={{
      settings,
      updateAppearance,
      updateEditor,
      updateUpdater,
      updateTranslator,
      updateNpmRegistry,
      resetToDefaults
    }}>
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

// Initialize window.api with localStorage-backed implementations
window.api = {
  getSettings: () => Promise.resolve(loadSettings()),
  getAppearance: () => Promise.resolve(loadSettings().appearance),
  getEditor: () => Promise.resolve(loadSettings().editor),
  updateAppearance: (updates: Partial<AppSettings['appearance']>) => {
    const current = loadSettings()
    const next = { ...current, appearance: { ...current.appearance, ...updates } }
    saveSettings(next)
    return Promise.resolve(next)
  },
  updateEditor: (updates: Partial<AppSettings['editor']>) => {
    const current = loadSettings()
    const next = { ...current, editor: { ...current.editor, ...updates } }
    saveSettings(next)
    return Promise.resolve(next)
  },
  updateUpdater: (updates: Partial<AppSettings['updater']>) => {
    const current = loadSettings()
    const next = { ...current, updater: { ...current.updater, ...updates } }
    saveSettings(next)
    return Promise.resolve(next)
  },
  getTranslator: () => Promise.resolve(loadSettings().translator),
  updateTranslator: (updates: Partial<AppSettings['translator']>) => {
    const current = loadSettings()
    const next = { ...current, translator: { ...current.translator, ...updates } }
    saveSettings(next)
    return Promise.resolve(next)
  },
  getNpmRegistry: () => Promise.resolve(loadSettings().npmRegistry),
  updateNpmRegistry: (npmRegistry: string) => {
    const current = loadSettings()
    const next = { ...current, npmRegistry }
    saveSettings(next)
    return Promise.resolve(next)
  },
  resetToDefaults: () => {
    const defaults = { ...DEFAULT_SETTINGS }
    saveSettings(defaults)
    return Promise.resolve(defaults)
  }
}
