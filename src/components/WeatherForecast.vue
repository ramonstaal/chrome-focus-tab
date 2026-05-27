<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { MapPin, RefreshCw } from '@lucide/vue'
import type { WeatherLocationMode, WeatherUnits } from '../appSettings'
import WeatherIcon from './WeatherIcon.vue'
import {
  fetchWeatherForecast,
  formatDayLabel,
  formatHourLabel,
  geocodeCity,
  requestDeviceLocation,
  reverseGeocodeLabel,
  upcomingHourly,
  weatherCodeLabel,
  type WeatherForecast,
} from '../weather'

const props = defineProps<{
  locationMode: WeatherLocationMode
  cityQuery: string
  latitude: number | null
  longitude: number | null
  locationLabel: string
  units: WeatherUnits
  forecastDays: 5 | 7
}>()

const emit = defineEmits<{
  locationResolved: [payload: { latitude: number; longitude: number; label: string }]
}>()

const forecast = ref<WeatherForecast | null>(null)
const loading = ref(false)
const error = ref('')
const expanded = ref(false)
let collapseTimer: number | undefined

function openExpanded() {
  if (collapseTimer !== undefined) {
    window.clearTimeout(collapseTimer)
    collapseTimer = undefined
  }
  expanded.value = true
}

function scheduleCollapse() {
  if (collapseTimer !== undefined) {
    window.clearTimeout(collapseTimer)
  }
  collapseTimer = window.setTimeout(() => {
    expanded.value = false
    collapseTimer = undefined
  }, 220)
}

function onSurfaceFocusOut(event: FocusEvent) {
  const surface = event.currentTarget as HTMLElement
  const next = event.relatedTarget as Node | null
  if (next && surface.contains(next)) {
    return
  }
  scheduleCollapse()
}

const unitsSymbol = computed(() => (props.units === 'fahrenheit' ? '°F' : '°C'))
const windUnit = computed(() => (props.units === 'fahrenheit' ? 'mph' : 'km/h'))

const displayLocation = computed(() => {
  if (props.locationLabel.trim()) {
    return props.locationLabel.trim()
  }

  if (props.locationMode === 'auto') {
    return 'Your location'
  }

  return props.cityQuery.trim() || 'Set a city in Settings'
})

const currentLabel = computed(() => {
  if (!forecast.value) {
    return ''
  }

  return weatherCodeLabel(forecast.value.current.weatherCode)
})

const hourlySlice = computed(() => {
  if (!forecast.value) {
    return []
  }

  return upcomingHourly(forecast.value.hourly, 8)
})

const dailySlice = computed(() => forecast.value?.daily ?? [])

const chipTitle = computed(() => {
  if (error.value) {
    return error.value
  }
  if (forecast.value) {
    return `${currentLabel.value} · ${displayLocation.value}`
  }
  return displayLocation.value
})

function hasCoordinates(): boolean {
  return props.latitude !== null && props.longitude !== null
}

async function resolveAutoLocation(): Promise<{ latitude: number; longitude: number; label: string } | null> {
  const position = await requestDeviceLocation()
  const latitude = position.coords.latitude
  const longitude = position.coords.longitude
  const label = await reverseGeocodeLabel(latitude, longitude)
  return { latitude, longitude, label }
}

async function resolveManualLocation(): Promise<{ latitude: number; longitude: number; label: string } | null> {
  if (hasCoordinates() && props.locationLabel.trim()) {
    return {
      latitude: props.latitude as number,
      longitude: props.longitude as number,
      label: props.locationLabel.trim(),
    }
  }

  const query = props.cityQuery.trim()
  if (!query) {
    return null
  }

  const match = await geocodeCity(query)
  if (!match) {
    throw new Error('No city found. Try a different name in Settings.')
  }

  return {
    latitude: match.latitude,
    longitude: match.longitude,
    label: match.name,
  }
}

async function loadForecast(force = false) {
  if (loading.value && !force) {
    return
  }

  loading.value = true
  error.value = ''

  try {
    let resolved: { latitude: number; longitude: number; label: string } | null = null

    if (props.locationMode === 'auto') {
      resolved = await resolveAutoLocation()
    } else {
      resolved = await resolveManualLocation()
    }

    if (!resolved) {
      error.value =
        props.locationMode === 'manual'
          ? 'Add a city name in Settings to load weather.'
          : 'Allow location access or choose a city in Settings.'
      forecast.value = null
      return
    }

    if (
      resolved.latitude !== props.latitude ||
      resolved.longitude !== props.longitude ||
      resolved.label !== props.locationLabel
    ) {
      emit('locationResolved', resolved)
    }

    forecast.value = await fetchWeatherForecast(
      {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        name: resolved.label,
      },
      props.units,
      props.forecastDays,
    )
  } catch (caught) {
    forecast.value = null
    error.value = caught instanceof Error ? caught.message : 'Could not load weather.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadForecast()
})

onUnmounted(() => {
  if (collapseTimer !== undefined) {
    window.clearTimeout(collapseTimer)
  }
})

watch(
  () => [props.locationMode, props.cityQuery, props.latitude, props.longitude, props.units, props.forecastDays],
  () => {
    void loadForecast(true)
  },
)
</script>

<template>
  <div class="weather-anchor">
    <div
      class="weather-surface"
      :class="{ 'weather-surface--open': expanded }"
      tabindex="0"
      role="region"
      :aria-expanded="expanded"
      :aria-label="
        forecast
          ? `Weather today ${forecast.current.temperature} degrees`
          : error
            ? 'Weather unavailable'
            : 'Weather'
      "
      :aria-busy="loading"
      @mouseenter="openExpanded"
      @mouseleave="scheduleCollapse"
      @focusin="openExpanded"
      @focusout="onSurfaceFocusOut"
    >
      <div class="weather-chip backdrop-glass" :title="chipTitle">
        <template v-if="error">
          <span class="weather-chip__error" aria-hidden="true">!</span>
        </template>
        <template v-else-if="loading && !forecast">
          <RefreshCw :size="14" class="weather-chip__spinner" aria-hidden="true" />
        </template>
        <template v-else-if="forecast">
          <WeatherIcon :code="forecast.current.weatherCode" :size="18" class="weather-chip__icon" />
          <span class="weather-chip__temp">{{ forecast.current.temperature }}°</span>
        </template>
      </div>

      <div class="weather-expanded" :class="{ 'weather-expanded--open': expanded }" :inert="!expanded">
        <div class="weather-expanded__inner backdrop-glass">
          <section class="weather-pane" aria-label="Weather forecast details">
            <header class="weather__header">
              <div class="weather__location">
                <MapPin :size="13" aria-hidden="true" />
                <span>{{ displayLocation }}</span>
              </div>
              <button
                type="button"
                class="weather__refresh backdrop-glass"
                :disabled="loading"
                aria-label="Refresh weather"
                @click="loadForecast(true)"
              >
                <RefreshCw :size="14" :class="{ 'weather__refresh-icon--spin': loading }" aria-hidden="true" />
              </button>
            </header>

            <p v-if="error" class="weather__message">{{ error }}</p>
            <p v-else-if="loading && !forecast" class="weather__message">Loading forecast…</p>

            <template v-else-if="forecast">
              <div class="weather__current">
                <WeatherIcon :code="forecast.current.weatherCode" :size="58" class="weather__current-icon" />
                <div class="weather__current-copy">
                  <p class="weather__temperature">
                    {{ forecast.current.temperature }}<span class="weather__degree">{{ unitsSymbol }}</span>
                  </p>
                  <p class="weather__condition">{{ currentLabel }}</p>
                  <p class="weather__meta">Wind {{ forecast.current.windSpeed }} {{ windUnit }}</p>
                </div>
              </div>

              <div v-if="hourlySlice.length" class="weather__hourly" role="list" aria-label="Hourly forecast">
                <article v-for="hour in hourlySlice" :key="hour.time" class="weather__hour" role="listitem">
                  <span class="weather__hour-time">{{ formatHourLabel(hour.time) }}</span>
                  <WeatherIcon :code="hour.weatherCode" :size="22" />
                  <span class="weather__hour-temp">{{ hour.temperature }}°</span>
                </article>
              </div>

              <div
                class="weather__daily"
                role="list"
                aria-label="Daily forecast"
                :style="{ gridTemplateColumns: `repeat(${dailySlice.length}, minmax(0, 1fr))` }"
              >
                <article
                  v-for="(day, index) in dailySlice"
                  :key="day.date"
                  class="weather__day"
                  role="listitem"
                >
                  <span class="weather__day-label">{{ formatDayLabel(day.date, index) }}</span>
                  <WeatherIcon :code="day.weatherCode" :size="24" />
                  <div class="weather__day-range">
                    <span class="weather__day-high">{{ day.temperatureMax }}°</span>
                    <span class="weather__day-low">{{ day.temperatureMin }}°</span>
                  </div>
                </article>
              </div>
            </template>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
