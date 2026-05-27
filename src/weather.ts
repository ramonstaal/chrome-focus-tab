export type WeatherUnits = 'celsius' | 'fahrenheit'

export interface WeatherLocation {
  latitude: number
  longitude: number
  name: string
}

export interface WeatherHour {
  time: string
  temperature: number
  weatherCode: number
}

export interface WeatherDay {
  date: string
  weatherCode: number
  temperatureMax: number
  temperatureMin: number
}

export interface WeatherForecast {
  location: WeatherLocation
  timezone: string
  current: {
    temperature: number
    weatherCode: number
    windSpeed: number
  }
  hourly: WeatherHour[]
  daily: WeatherDay[]
  fetchedAt: number
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 85 && code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Cloudy'
}

export function weatherIconKind(code: number): string {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly-cloudy'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95) return 'thunderstorm'
  return 'cloudy'
}

export async function geocodeCity(query: string): Promise<WeatherLocation | null> {
  const trimmed = query.trim()
  if (!trimmed) {
    return null
  }

  const params = new URLSearchParams({
    name: trimmed,
    count: '1',
    language: 'en',
    format: 'json',
  })

  const response = await fetch(`${GEOCODE_URL}?${params}`)
  if (!response.ok) {
    throw new Error('Could not search for that city.')
  }

  const data = (await response.json()) as {
    results?: Array<{
      latitude: number
      longitude: number
      name: string
      admin1?: string
      country_code?: string
    }>
  }

  const match = data.results?.[0]
  if (!match) {
    return null
  }

  const parts = [match.name, match.admin1, match.country_code].filter(Boolean)
  return {
    latitude: match.latitude,
    longitude: match.longitude,
    name: parts.join(', '),
  }
}

export function requestDeviceLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 15 * 60 * 1000,
    })
  })
}

export async function reverseGeocodeLabel(latitude: number, longitude: number): Promise<string> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: 'en',
  })

  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`,
    )
    if (!response.ok) {
      return 'Your location'
    }

    const data = (await response.json()) as {
      city?: string
      locality?: string
      principalSubdivision?: string
      countryCode?: string
    }

    const parts = [data.city || data.locality, data.principalSubdivision, data.countryCode].filter(
      Boolean,
    )

    return parts.length > 0 ? parts.join(', ') : 'Your location'
  } catch {
    return 'Your location'
  }
}

export async function fetchWeatherForecast(
  location: WeatherLocation,
  units: WeatherUnits,
  days: 5 | 7,
): Promise<WeatherForecast> {
  const isFahrenheit = units === 'fahrenheit'
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: String(days),
    temperature_unit: isFahrenheit ? 'fahrenheit' : 'celsius',
    wind_speed_unit: isFahrenheit ? 'mph' : 'kmh',
  })

  const response = await fetch(`${FORECAST_URL}?${params}`)
  if (!response.ok) {
    throw new Error('Weather data is temporarily unavailable.')
  }

  const data = (await response.json()) as {
    timezone?: string
    current?: {
      temperature_2m?: number
      weather_code?: number
      wind_speed_10m?: number
    }
    hourly?: {
      time?: string[]
      temperature_2m?: number[]
      weather_code?: number[]
    }
    daily?: {
      time?: string[]
      weather_code?: number[]
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
    }
  }

  const hourlyTimes = data.hourly?.time ?? []
  const hourly: WeatherHour[] = hourlyTimes.map((time, index) => ({
    time,
    temperature: Math.round(data.hourly?.temperature_2m?.[index] ?? 0),
    weatherCode: data.hourly?.weather_code?.[index] ?? 0,
  }))

  const dailyTimes = data.daily?.time ?? []
  const daily: WeatherDay[] = dailyTimes.map((date, index) => ({
    date,
    weatherCode: data.daily?.weather_code?.[index] ?? 0,
    temperatureMax: Math.round(data.daily?.temperature_2m_max?.[index] ?? 0),
    temperatureMin: Math.round(data.daily?.temperature_2m_min?.[index] ?? 0),
  }))

  return {
    location,
    timezone: data.timezone ?? 'auto',
    current: {
      temperature: Math.round(data.current?.temperature_2m ?? 0),
      weatherCode: data.current?.weather_code ?? 0,
      windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
    },
    hourly,
    daily,
    fetchedAt: Date.now(),
  }
}

export function upcomingHourly(hourly: WeatherHour[], count = 8): WeatherHour[] {
  const now = Date.now()
  const upcoming = hourly.filter((entry) => {
    const time = Date.parse(entry.time)
    return Number.isFinite(time) && time >= now - 30 * 60 * 1000
  })

  return upcoming.slice(0, count)
}

export function formatHourLabel(isoTime: string): string {
  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
  }).format(date)
}

export function formatDayLabel(isoDate: string, index: number): string {
  if (index === 0) {
    return 'Today'
  }

  if (index === 1) {
    return 'Tomorrow'
  }

  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date)
}
