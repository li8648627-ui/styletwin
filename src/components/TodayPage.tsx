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
  const completeness = Math.round((outfit.length / 5) * 100)

  const vote = async (delta: 1 | -1) => {
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
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  const reasonFor = (): string => {
    const parts: string[] = []
    parts.push(lang === 'ru' ? EVENT_REASONS[event].ru : EVENT_REASONS[event].en)
    if (weather?.condition === 'rain') parts.push(lang === 'ru' ? 'дождь — закрытая обувь' : 'rain — closed shoes')
    if (weather?.condition === 'snow') parts.push(lang === 'ru' ? 'снег — тёплая обувь' : 'snow — warm shoes')
    if ((weather?.temp ?? 99) <= 10) parts.push(lang === 'ru' ? 'холодно — добавьте аксессуары' : 'cold — add accessories')
    if ((weather?.temp ?? 99) <= 18 && (weather?.temp ?? 99) > 10) parts.push(lang === 'ru' ? 'прохладно — возьмите слой сверху' : 'cool — add a top layer')
    return `${lang === 'ru' ? 'Почему:' : 'Why:'} ${parts.join(', ')}.`
  }

  const wear = async () => {
    setMessage('')
    await vote(1)
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

  const dislike = async () => {
    setMessage('')
    await vote(-1)
    setSeed(seed + 1)
    setSaved(false)
    setMessage(lang === 'ru' ? '👎 Поняла: покажу другой вариант.' : "👎 Got it: showing another option.")
  }

  const shareLook = async () => {
    const eventText = lang === 'ru' ? EVENT_LABELS[event].ru : EVENT_LABELS[event].en
    const weatherText = weather ? `${weather.temp}° ${weather.description}` : ''
    const itemsText = outfit.map((i) => i.name).join(', ')
    const reason = reasonFor().replace(lang === 'ru' ? 'Почему: ' : 'Why: ', '')
    const text =
      lang === 'ru'
        ? `✳ Мой образ в StyleTwin\n\nКуда: ${eventText}\nПогода: ${weatherText}\nВещи: ${itemsText}\n\n${reason}\n\nПопробуйте StyleTwin — AI-стилист, который учится на вашем вкусе.`
        : `✳ My look in StyleTwin\n\nWhere: ${eventText}\nWeather: ${weatherText}\nItems: ${itemsText}\n\n${reason}\n\nTry StyleTwin — AI stylist that learns your taste.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'StyleTwin', text })
      } else {
        await navigator.clipboard.writeText(text)
        setMessage(
          lang === 'ru'
            ? '✅ Образ скопирован — можно вставить в любой чат!'
            : '✅ Look copied — paste it anywhere!'
        )
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setMessage(`❌ ${err.message}`)
    }
  }

  if (loading) return <div className="card muted">{t('today_stylist')}</div>

  if (items.length === 0)
    return (
      <div>
        <h1 className="screen-title">{t('today_title')}</h1>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧺</div>
          <div
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: -0.3,
              marginBottom: 8,
              color: 'var(--ink)',
            }}
          >
            {lang === 'ru' ? 'Шкаф пока пуст' : 'Wardrobe is empty'}
          </div>
          <div className="muted" style={{ marginBottom: 16 }}>
            {lang === 'ru'
              ? 'Загрузите первую вещь — AI вырежет фон за секунду.'
              : 'Upload your first item — AI will remove the background in seconds.'}
          </div>
          <button
            className="action-btn primary"
            style={{ width: '100%' }}
            onClick={() => onNavigate('wardrobe')}
          >
            📥 {lang === 'ru' ? 'Загрузить первую вещь' : 'Upload first item'}
          </button>
        </div>
      </div>
    )

  return (
    <div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {weather && <span className="weather-pill">✳ {formatWeather(weather)}</span>}
        <button
          className="chip"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setEvent(EVENT_ORDER[(EVENT_ORDER.indexOf(event) + 1) % EVENT_ORDER.length])
            setSaved(false)
          }}
        >
          {lang === 'ru' ? EVENT_LABELS[event].ru : EVENT_LABELS[event].en} ▸
        </button>
        <span className="chip">{lang === 'ru' ? 'встреча 14:00' : 'meeting 2:00 PM'}</span>
      </div>
      <h1 className="screen-title">{t('today_title')}</h1>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 700 }}>{t('today_look')}</span>
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: `conic-gradient(var(--accent) ${completeness}%, #ece4d4 0)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent-deep)' }}>
              {outfit.length}/5
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {outfit.slice(0, 3).map((it) => (
            <div key={it.id} className="tile" style={{ flex: 1, height: 110 }}>
              {it.image_url ? (
                <img src={it.image_url} alt={it.name} />
              ) : (
                <span style={{ fontSize: 40 }}>{CATEGORY_ICON[it.category] ?? '🧺'}</span>
              )}
            </div>
          ))}
        </div>
        <div className="actions" style={{ marginBottom: 8 }}>
          <button className="action-btn primary" onClick={wear} disabled={saved}>
            ✳ {saved ? t('today_taken') : lang === 'ru' ? 'Надеть это' : 'Wear this'}
          </button>
          <button className="action-btn" onClick={dislike}>{lang === 'ru' ? 'Не нравится' : "Don't like"}</button>
        </div>
        <div className="muted mono" style={{ fontSize: 11 }}>{reasonFor()}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="nav-tile" onClick={() => onNavigate('tryon')}>
          <span className="nav-tile-icon">✳</span>
          <span className="nav-tile-label">{lang === 'ru' ? 'AI-примерка' : 'AI try-on'}</span>
        </button>
        <button className="nav-tile" onClick={() => onNavigate('wardrobe')}>
          <span className="nav-tile-icon">＋</span>
          <span className="nav-tile-label">{lang === 'ru' ? 'Гардероб' : 'Wardrobe'}</span>
        </button>
        <button className="nav-tile" onClick={() => onNavigate('looks')}>
          <span className="nav-tile-icon">❐</span>
          <span className="nav-tile-label">{lang === 'ru' ? 'Мои образы' : 'My looks'}</span>
        </button>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <span className="section-title">{lang === 'ru' ? 'Мой гардероб' : 'My wardrobe'}</span>
        <button className="section-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => onNavigate('wardrobe')}>
          {lang === 'ru' ? `Все ${items.length} →` : `All ${items.length} →`}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {items.slice(0, 3).map((it) => (
          <div key={it.id} className="tile" style={{ flex: 1, height: 120, cursor: 'pointer' }} onClick={() => onNavigate('wardrobe')}>
            {it.image_url ? (
              <img src={it.image_url} alt={it.name} />
            ) : (
              <span style={{ fontSize: 40 }}>{CATEGORY_ICON[it.category] ?? '🧺'}</span>
            )}
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="action-btn" onClick={shareLook}>
          🔗 {lang === 'ru' ? 'Поделиться' : 'Share'}
        </button>
      </div>

      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}