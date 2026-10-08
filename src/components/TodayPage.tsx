import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { fetchWeather, formatWeather, type Weather } from '../lib/weather'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

function pickOutfit(items: Item[], seed: number, weather: Weather): Item[] {
  if (items.length === 0) return []
  const byCat = (c: string) => items.filter((i) => i.category === c)
  const tops = byCat('tops')
  const bottoms = byCat('bottoms')
  const dresses = byCat('dresses')
  const shoes = byCat('shoes')
  const accessories = byCat('accessories')

  const pick = <T,>(arr: T[], offset: number): T | undefined =>
    arr.length ? arr[(seed + offset) % arr.length] : undefined

  const result: Item[] = []

  if (tops.length && bottoms.length) {
    const t1 = pick(tops, 0)
    const b = pick(bottoms, 1)
    if (t1) result.push(t1)
    if (b) result.push(b)
  } else if (dresses.length) {
    const d = pick(dresses, 0)
    if (d) result.push(d)
  } else {
    const any = pick(items, 0)
    if (any) result.push(any)
  }

  if (weather.condition === 'rain' || weather.condition === 'snow') {
    const s = pick(shoes, 2)
    if (s && !result.includes(s)) result.push(s)
  }
  if (weather.temp <= 10) {
    const a = pick(accessories, 3)
    if (a) result.push(a)
  }

  return result.slice(0, 5)
}

export function TodayPage({ city }: { city: string }) {
  const { t, lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [seed, setSeed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('wardrobe_items').select('id, name, category, color, image_url'),
      fetchWeather(city, lang),
    ]).then(([itemsRes, weatherData]) => {
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data)
      setWeather(weatherData)
      setLoading(false)
    })
  }, [city, lang])

  const outfit = weather ? pickOutfit(items, seed, weather) : []

  const reasonFor = (): string => {
    if (!weather) return ''
    const parts: string[] = []
    if (weather.condition === 'rain') parts.push(lang === 'ru' ? 'дождь — закрытая обувь' : 'rain — closed shoes')
    if (weather.condition === 'snow') parts.push(lang === 'ru' ? 'снег — тёплая обувь' : 'snow — warm shoes')
    if (weather.temp <= 10) parts.push(lang === 'ru' ? 'холодно — добавьте аксессуары' : 'cold — add accessories')
    if (weather.temp <= 18 && weather.temp > 10) parts.push(lang === 'ru' ? 'прохладно — возьмите слой сверху' : 'cool — add a top layer')
    if (parts.length === 0) parts.push(lang === 'ru' ? 'настроение и ваш шкаф!' : 'mood and your wardrobe!')
    return `${lang === 'ru' ? 'Почему:' : 'Why:'} ${parts.join(', ')}.`
  }

  const saveLook = async () => {
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const weatherText = weather ? `${weather.temp}° ${weather.description}` : ''
      const { error } = await supabase.from('looks').insert({
        user_id: userData.user.id,
        name: `${lang === 'ru' ? 'Сегодня' : 'Today'}: ${weatherText}`,
        item_ids: outfit.map((i) => i.id),
      })
      if (error) throw error
      setSaved(true)
      setMessage(t('today_saved_msg'))
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  if (loading) return <div className="card muted">{t('today_stylist')}</div>
  if (items.length === 0) return <div className="card muted">{t('today_empty')}</div>

  return (
    <div>
      {weather && (
        <div className="weather">✳ {formatWeather(weather)} · {city}</div>
      )}
      <h1 className="screen-title">{t('today_title')}</h1>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('today_look')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {outfit.map((it) => (
            <span key={it.id} className="chip">
              {CATEGORY_ICON[it.category] ?? '🧺'} {it.name}
            </span>
          ))}
        </div>
        {outfit.some((it) => it.image_url) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {outfit
              .filter((it) => it.image_url)
              .map((it) => (
                <img key={it.id} src={it.image_url!} alt={it.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
              ))}
          </div>
        )}
        <div className="muted">{reasonFor()}</div>
      </div>
      <div className="actions">
        <button className="action-btn primary" onClick={saveLook} disabled={saved}>
          {saved ? t('today_taken') : t('today_take')}
        </button>
        <button
          className="action-btn"
          onClick={() => {
            setSeed(seed + 1)
            setSaved(false)
          }}
        >
          {t('today_other')}
        </button>
      </div>
      {message && <div className="card muted">{message}</div>}
    </div>
  )
}