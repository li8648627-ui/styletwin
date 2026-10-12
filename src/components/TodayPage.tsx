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

const EVENT_ICONS: Record<EventId, string> = {
  office: '💼',
  meeting: '🤝',
  date: '💫',
  sport: '🏃',
  walk: '🌳',
  party: '🎉',
  theater: '🎭',
  trip: '✈️',
}

const EVENT_BG: Record<EventId, string> = {
  office: '#eef2ff',
  meeting: '#fef3c7',
  date: '#fce7f3',
  sport: '#dcfce7',
  walk: '#d1fae5',
  party: '#ffe4e6',
  theater: '#ede9fe',
  trip: '#e0f2fe',
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

function pickOutfit(
  items: Item[],
  seed: number,
  weather: Weather,
  event: EventId,
  prefs: Record<string, number>
): Item[] {
  if (items.length === 0) return []
  const score = (i: Item) => prefs[i.id] ?? 0
  const poolOf = (arr: Item[]): Item[] => {
    const clean = arr.filter((i) => score(i) >= 0)
    const use = clean.length ? clean : arr
    return [...use].sort((a, b) => score(b) - score(a))
  }
  const byCat = (c: string) => poolOf(items.filter((i) => i.category === c))
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
  const [prefs, setPrefs] = useState<Record<string, number>>({})
  const [event, setEvent] = useState<EventId>('office')
  const [seed, setSeed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('wardrobe_items').select('id, name, category, color, image_url'),
      supabase.from('preferences').select('item_id, score'),
    ]).then(([itemsRes, prefsRes]) => {
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data)
      const map: Record<string, number> = {}
      ;(prefsRes.data ?? []).forEach((r: { item_id: string; score: number }) => {
        map[r.item_id] = r.score
      })
      setPrefs(map)
      setLoading(false)
    })
    fetchWeather(city, lang).then(setWeather)
  }, [city, lang])

  const outfit = weather ? pickOutfit(items, seed, weather, event, prefs) : []

  const vote = async (delta: 1 | -1) => {
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      for (const it of outfit) {
        const { data: existing } = await supabase
          .from('preferences')
          .select('id, score')
          .eq('user_id', userData.user.id)
          .eq('item_id', it.id)
          .maybeSingle()
        if (existing) {
          const { error } = await supabase.from('preferences').update({ score: existing.score + delta }).eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('preferences').insert({ user_id: userData.user.id, item_id: it.id, score: delta })
          if (error) throw error
        }
      }
      const { data } = await supabase.from('preferences').select('item_id, score').eq('user_id', userData.user.id)
      const map: Record<string, number> = {}
      ;(data ?? []).forEach((r: { item_id: string; score: number }) => {
        map[r.item_id] = r.score
      })
      setPrefs(map)
      setMessage(
        delta === 1
          ? lang === 'ru'
            ? '✅ Стилист запомнил: вам нравится этот образ!'
            : '✅ Stylist remembered: you like this look!'
          : lang === 'ru'
            ? '👎 Поняла: такие сочетания буду предлагать реже.'
            : '👎 Got it: I will suggest such combos less often.'
      )
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  const reasonFor = (): string => {
    if (!weather) return lang === 'ru' ? 'Смотрим погоду за окном…' : 'Checking the weather…'
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
      <button
        onClick={() => {
          setEvent(EVENT_ORDER[(EVENT_ORDER.indexOf(event) + 1) % EVENT_ORDER.length])
          setSaved(false)
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: 16,
          padding: '12px 14px',
          marginBottom: 6,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: EVENT_BG[event],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {EVENT_ICONS[event]}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
            {lang === 'ru' ? 'Куда сегодня?' : 'Where today?'}
          </span>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>
            {lang === 'ru' ? EVENT_LABELS[event].ru : EVENT_LABELS[event].en}
          </span>
        </span>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#111',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ▸
        </span>
      </button>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10, textAlign: 'center' }}>
        {lang === 'ru' ? 'нажмите, чтобы сменить направление' : 'tap to change destination'}
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
        <div className="row" style={{ marginTop: 10 }}>
          <button className="action-btn" onClick={() => vote(1)}>👍 {lang === 'ru' ? 'Нравится' : 'Like'}</button>
          <button className="action-btn" onClick={() => vote(-1)}>👎 {lang === 'ru' ? 'Не моё' : 'Not mine'}</button>
        </div>
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