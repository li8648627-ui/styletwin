export type Weather = {
  temp: number
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog'
  description: string
}

const CONDITION_MAP: Record<number, 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog'> = {
  0: 'clear', 1: 'clear', 2: 'cloudy', 3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain', 61: 'rain', 63: 'rain', 65: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain', 85: 'snow', 86: 'snow',
  95: 'rain', 96: 'rain', 99: 'rain',
}

const DESCRIPTION_RU: Record<string, string> = {
  clear: 'ясно', cloudy: 'облачно', rain: 'дождь', snow: 'снег', fog: 'туман',
}

const DESCRIPTION_EN: Record<string, string> = {
  clear: 'clear', cloudy: 'cloudy', rain: 'rain', snow: 'snow', fog: 'fog',
}

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  moscow: { lat: 55.7558, lon: 37.6173 },
  'санкт-петербург': { lat: 59.9343, lon: 30.3351 },
  'saint petersburg': { lat: 59.9343, lon: 30.3351 },
  london: { lat: 51.5074, lon: -0.1278 },
  'new york': { lat: 40.7128, lon: -74.0060 },
  paris: { lat: 48.8566, lon: 2.3522 },
  berlin: { lat: 52.5200, lon: 13.4050 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
}

export async function fetchWeather(city: string, lang: 'ru' | 'en'): Promise<Weather> {
  const key = city.toLowerCase().trim()
  const coords = CITY_COORDS[key] ?? CITY_COORDS['moscow']
  const fallback: Weather = { temp: 18, condition: 'cloudy', description: lang === 'ru' ? 'облачно' : 'cloudy' }

  try {
    const data = await Promise.race([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`
      ).then((r) => r.json()),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])
    if (!data || !data.current_weather) return fallback
    const code = data.current_weather.weathercode ?? 0
    const temp = Math.round(data.current_weather.temperature ?? 20)
    const condition = CONDITION_MAP[code] ?? 'clear'
    const description = lang === 'ru' ? DESCRIPTION_RU[condition] : DESCRIPTION_EN[condition]
    return { temp, condition, description }
  } catch {
    return fallback
  }
}

export function formatWeather(w: Weather): string {
  return `${w.temp}° · ${w.description}`
}