export interface AppSettings {
  background: string
  customBackgrounds: string[]
}

export const SETTINGS_STORAGE_KEY = 'appSettings'
const SETTINGS_FALLBACK_KEY = 'focus-new-tab.settings'

const defaultSettings: AppSettings = {
  background: 'alpine',
  customBackgrounds: [],
}

export function pickRandomCustomBackground(images: string[]): string {
  if (images.length === 0) {
    return ''
  }

  const index = Math.floor(Math.random() * images.length)
  return images[index] ?? ''
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function normalizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...defaultSettings }
  }

  const value = raw as Partial<AppSettings> & { customBackground?: string }
  const legacyBackground = typeof value.customBackground === 'string' ? value.customBackground : ''
  let customBackgrounds = Array.isArray(value.customBackgrounds)
    ? value.customBackgrounds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []

  if (legacyBackground && !customBackgrounds.includes(legacyBackground)) {
    customBackgrounds = [legacyBackground, ...customBackgrounds]
  }

  return {
    background: typeof value.background === 'string' ? value.background : defaultSettings.background,
    customBackgrounds,
  }
}

function loadFallbackSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_FALLBACK_KEY)

  if (!raw) {
    return { ...defaultSettings }
  }

  try {
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...defaultSettings }
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
      const stored = data[SETTINGS_STORAGE_KEY]

      if (stored) {
        return normalizeSettings(stored)
      }
    } catch {
      // Fall back to localStorage below.
    }
  }

  return loadFallbackSettings()
}

export async function setAppSettings(settings: AppSettings): Promise<void> {
  const normalized = normalizeSettings(settings)

  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: normalized })
    } catch {
      // Fall back to localStorage below.
    }
  }

  try {
    localStorage.setItem(SETTINGS_FALLBACK_KEY, JSON.stringify(normalized))
  } catch {
    // Large custom backgrounds can exceed quota; chrome.storage above should still persist.
  }
}
