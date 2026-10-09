import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { fetchWeather, formatWeather, type Weather } from '../lib/weather'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type EventId = 'office' | 'meeting' | 'date' | 'sport' | 'walk' | 'party' | 'theater' | 'trip'
type NavTab = 'tryon' | 'wardrobe' | 'looks'

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

const NEUTRAL = ['white', 'black', 'gray', 'grey', 'blue', 'navy', 'beige', 'brown', 'белый', 'чёрный', 'черный', 'серый', 'синий', 'бежевый', 'коричневый']
const STRONG = ['red', 'pink', 'yellow', 'green', 'красный', 'розовый', 'жёлтый', 'желтый', 'зелёный', 'зеленый']

const EVENT_ORDER: EventId[] = ['office', 'meeting', 'date', 'sport', 'walk', 'party', 'theater', 'trip']

const EVENT_LABELS: Record<EventId, { ru: string; en: string }> = {
  office: { ru: 'офис', en: 'office' },
  meeting: { ru: 'встреча', en: 'meeting' },
  date: { ru: 'свидание', en: 'date' },
  sport: { ru: 'спорт', en: 'sport' },
  walk: { ru: 'прогулка', en: 'walk' },
  party: { ru: 'вечеринка', en: 'party' },
  theater: { ru: 'театр', en: 'theater' },
  trip: { ru: 'поездка', en: 'trip' },
}

const EVENT_REASONS: Record<EventId, { ru: string; en: string }> = {
  office: { ru: 'офисный дресс-код — нейтральная палитра', en: 'office dress code — neutral palette' },
  meeting: { ru: 'встреча — образ держит вид весь день', en: 'meeting — the look stays sharp all day' },
  date: { ru: 'свидание — немного яркости уместно', en: 'date — a touch of brightness welcome' },
  sport: { ru: 'спорт — свобода движений и обувь', en: 'sport — freedom of movement and proper shoes' },
  walk: { ru: 'прогулка — комфорт, обувь и сумка', en: 'walk — comfort, shoes and a bag' },
  party: { ru: 'вечеринка — яркие цвета и аксессуары', en: 'party — bright colors and accessories' },
  theater: { ru: 'театр — сдержанная элегантность', en: 'theater — restrained elegance' },
  trip: { ru: 'поездка — практичная капсула: всё под рукой', en: 'trip — practical capsule: everything at hand' },
}

function pickOutfit(items: Item[], seed: number, weather: Weather, event: EventId): Item[] {
  if (items.length === 0) return []
  const byCat = (c: string) => items.filter((i) => i.category === c)
  const tops = byCat('tops')
  const bottoms = byCat('bottoms')
  const dresses = byCat('dresses')
  const shoes = byCat('shoes')
  const accessories = byCat('accessories')

  const pick = <T,>(arr: T[], offset: number): T | undefined =>
    arr.length ? arr[(seed + offset) % arr.length] : undefined

  const neutralFirst = (arr: Item[]): Item | undefined =>
    arr.find((x) => NEUTRAL.includes((x.color ?? '').toLowerCase())) ?? arr[0]
  const strongFirst = (arr: Item[]): Item | undefined =>
    arr.find((x) => STRONG.includes((x.color ?? '').toLowerCase())) ?? arr[0]

  const result: Item[] = []

  if ((event === 'date' || event === 'theater' || event === 'party') && dresses.length) {
    const d = event === 'theater' ? neutralFirst(dresses) : strongFirst(dresses)
    if (d) result.push(d)
  } else if (tops.length && bottoms.length) {
    let t1: Item | undefined
    let b: Item | undefined
    if (event === 'office' || event === 'meeting' || event === 'theater') {
      t1 = neutralFirst(tops)
      b = neutralFirst(bottoms)
    } else if (event === 'party' || event === 'date') {
      t1 = strongFirst(tops)
      b = neutralFirst(bottoms)
    } else {
      t1 = pick(tops, 0)
      b = pick(bottoms, 1)
    }
    if (
      t1 && b && t1.color && b.color &&
      t1.color.toLowerCase() === b.color.toLowerCase() &&
      STRONG.includes(t1.color.toLowerCase())
    ) {
      const alt = bottoms.find((x) => (x.color ?? '').toLowerCase() !== (t1.color ?? '').toLowerCase())
      if (alt) b = alt
    }
    if (t1) result.push(t1)
    if (b) result.push(b)
  } else if (dresses.length) {
    const d = event === 'theater' || event === 'office' || event === 'meeting' ? neutralFirst(dresses) : strongFirst(dresses)
    if (d) result.push(d)
  } else {
    const any = pick(items, 0)
    if (any) result.push(any)
  }

  const shoesEvents: EventId[] = ['sport', 'walk', 'party', 'theater', 'trip']
  if (weather.condition === 'rain' || weather.condition === 'snow' || shoesEvents.includes(event)) {
    const s = pick(shoes, 2)
    if (s && !result.includes(s)) result.push(s)
  }
  const accEvents: EventId[] = ['walk', 'date', 'party', 'theater', 'trip']
  if (weather.temp <= 10 || accEvents.includes(event)) {
    const a = pick(accessories, 3)
    if (a && !result.includes(a)) result.push(a)
  }

  return result.slice(0, 5)
}

export function TodayPage({ city, onNavigate }: { city: string; onNavigate: (tab: NavTab) => void }) {
  const { t, lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [event, setEvent] = useState<EventId>('office')
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

  const outfit = weather ? pickOutfit(items, seed, weather, event) : []

  const reasonFor = (): string => {
    if (!weather) return ''
    const parts: string[] = []
    parts.push(lang === 'ru' ? EVENT_REASONS[event].ru : EVENT_REASONS[event].en)
    if (weather.condition === 'rain') parts.push(lang === 'ru' ? 'дождь — закрытая обувь' : 'rain — closed shoes')
    if (weather.condition === 'snow') parts.push(lang === 'ru' ? 'снег — тёплая обувь' : 'snow — warm shoes')
    if (weather.temp <= 10) parts.push(lang === 'ru' ? 'холодно — добавьте аксессуары' : 'cold — add accessories')
    if (weather.temp <= 18 && weather.temp > 10) parts.push(lang === 'ru' ? 'прохладно — возьмите слой сверху' : 'cool — add a top layer')
    return `${lang === 'ru' ? 'Почему:' : 'Why:'} ${parts.join(', ')}.`
  }

  const saveLook = async () => {
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const weatherText = weather ? `${weather.temp}° ${weather.description}` : ''
      const eventText = lang === 'ru' ? EVENT_LABELS[event].ru : EVENT_LABELS[event].en
      const { error } = await supabase.from('looks').insert({
        user_id: userData.user.id,
        name: `${lang === 'ru' ? 'Сегодня' : 'Today'}: ${eventText} · ${weatherText}`,
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
      <div className="chips" style={{ marginBottom: 8 }}>
        <button
          className="chip"
          style={{ cursor: 'pointer', background: '#111', color: '#fff', border: '1px solid #111', fontWeight: 600 }}
          onClick={() => {
            setEvent(EVENT_ORDER[(EVENT_ORDER.indexOf(event) + 1) % EVENT_ORDER.length])
            setSaved(false)
          }}
        >
          {lang === 'ru' ? 'куда: ' : 'going: '} {lang === 'ru' ? EVENT_LABELS[event].ru : EVENT_LABELS[event].en} ▸
        </button>
        <span className="muted" style={{ fontSize: 11 }}>
          {lang === 'ru' ? 'нажмите, чтобы сменить направление' : 'tap to change destination'}
        </span>
      </div>
      <h1 className="screen-title">{t('today_title')}</h1>
      <div className="actions" style={{ marginBottom: 12 }}>
        <button className="action-btn primary" onClick={() => onNavigate('tryon')}>{t('btn_tryon')}</button>
        <button className="action-btn" onClick={() => onNavigate('wardrobe')}>{t('btn_wardrobe')}</button>
        <button className="action-btn" onClick={() => onNavigate('looks')}>{t('btn_looks')}</button>
      </div>
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