export type WeatherLocationMode = 'auto' | 'manual'
export type WeatherUnits = 'celsius' | 'fahrenheit'

export interface AppSettings {
  background: string
  customBackgrounds: string[]
  countdownEnabled: boolean
  timeTrackingEnabled: boolean
  todosEnabled: boolean
  weatherEnabled: boolean
  weatherLocationMode: WeatherLocationMode
  weatherCity: string
  weatherLatitude: number | null
  weatherLongitude: number | null
  weatherLocationLabel: string
  weatherUnits: WeatherUnits
  weatherForecastDays: 5 | 7
  syncEnabled: boolean
  syncToken: string
  syncLastAt: number | null
  syncLastError: string
  syncEtag: string | null
}

export const SETTINGS_STORAGE_KEY = 'appSettings'
const SETTINGS_FALLBACK_KEY = 'focus-new-tab.settings'

const defaultSettings: AppSettings = {
  background: 'alpine',
  customBackgrounds: [],
  countdownEnabled: true,
  timeTrackingEnabled: true,
  todosEnabled: true,
  weatherEnabled: false,
  weatherLocationMode: 'auto',
  weatherCity: '',
  weatherLatitude: null,
  weatherLongitude: null,
  weatherLocationLabel: '',
  weatherUnits: 'celsius',
  weatherForecastDays: 7,
  syncEnabled: false,
  syncToken: '',
  syncLastAt: null,
  syncLastError: '',
  syncEtag: null,
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
    countdownEnabled:
      typeof value.countdownEnabled === 'boolean' ? value.countdownEnabled : defaultSettings.countdownEnabled,
    timeTrackingEnabled:
      typeof value.timeTrackingEnabled === 'boolean'
        ? value.timeTrackingEnabled
        : defaultSettings.timeTrackingEnabled,
    todosEnabled: typeof value.todosEnabled === 'boolean' ? value.todosEnabled : defaultSettings.todosEnabled,
    weatherEnabled:
      typeof value.weatherEnabled === 'boolean' ? value.weatherEnabled : defaultSettings.weatherEnabled,
    weatherLocationMode:
      value.weatherLocationMode === 'auto' || value.weatherLocationMode === 'manual'
        ? value.weatherLocationMode
        : defaultSettings.weatherLocationMode,
    weatherCity: typeof value.weatherCity === 'string' ? value.weatherCity : defaultSettings.weatherCity,
    weatherLatitude:
      typeof value.weatherLatitude === 'number' && Number.isFinite(value.weatherLatitude)
        ? value.weatherLatitude
        : defaultSettings.weatherLatitude,
    weatherLongitude:
      typeof value.weatherLongitude === 'number' && Number.isFinite(value.weatherLongitude)
        ? value.weatherLongitude
        : defaultSettings.weatherLongitude,
    weatherLocationLabel:
      typeof value.weatherLocationLabel === 'string'
        ? value.weatherLocationLabel
        : defaultSettings.weatherLocationLabel,
    weatherUnits:
      value.weatherUnits === 'celsius' || value.weatherUnits === 'fahrenheit'
        ? value.weatherUnits
        : defaultSettings.weatherUnits,
    weatherForecastDays:
      value.weatherForecastDays === 5 || value.weatherForecastDays === 7
        ? value.weatherForecastDays
        : defaultSettings.weatherForecastDays,
    syncEnabled: typeof value.syncEnabled === 'boolean' ? value.syncEnabled : defaultSettings.syncEnabled,
    syncToken: typeof value.syncToken === 'string' ? value.syncToken : defaultSettings.syncToken,
    syncLastAt:
      typeof value.syncLastAt === 'number' && Number.isFinite(value.syncLastAt)
        ? value.syncLastAt
        : defaultSettings.syncLastAt,
    syncLastError: typeof value.syncLastError === 'string' ? value.syncLastError : defaultSettings.syncLastError,
    syncEtag: typeof value.syncEtag === 'string' ? value.syncEtag : defaultSettings.syncEtag,
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

import { scheduleSyncPush } from './sync/hooks'

export async function setAppSettings(
  settings: AppSettings,
  options: { skipSync?: boolean } = {},
): Promise<void> {
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

  if (!options.skipSync) {
    scheduleSyncPush()
  }
}
