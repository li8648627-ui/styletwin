import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { type Weather } from '../lib/weather'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type Look = { id: string; name: string; item_ids: string[]; created_at: string }
type EventId = 'office' | 'meeting' | 'date' | 'sport' | 'walk' | 'party' | 'theater' | 'trip'

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

const DAY_NAMES_RU = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']
const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const NEUTRAL = ['white', 'black', 'gray', 'grey', 'blue', 'navy', 'beige', 'brown', 'белый', 'чёрный', 'черный', 'серый', 'синий', 'бежевый', 'коричневый']
const STRONG = ['red', 'pink', 'yellow', 'green', 'красный', 'розовый', 'жёлтый', 'желтый', 'зелёный', 'зеленый']

function pickOutfit(
  items: Item[],
  seed: number,
  weather: Weather,
  event: EventId,
  prefs: Record<string, number>,
  usedIds: Set<string>
): Item[] {
  if (items.length === 0) return []
  const score = (i: Item) => prefs[i.id] ?? 0
  const poolOf = (arr: Item[]): Item[] => {
    const clean = arr.filter((i) => score(i) >= 0 && !usedIds.has(i.id))
    const use = clean.length ? clean : arr.filter((i) => !usedIds.has(i.id))
    const final = use.length ? use : arr
    return [...final].sort((a, b) => score(b) - score(a))
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
    if (t1) result.push(t1)
    if (b) result.push(b)
  } else if (dresses.length) {
    const d = pick(dresses, 0)
    if (d) result.push(d)
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

export function LooksPage() {
  const { lang } = useLang()
  const [looks, setLooks] = useState<Look[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [prefs, setPrefs] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('looks').select('id, name, item_ids, created_at').order('created_at', { ascending: false }),
      supabase.from('wardrobe_items').select('id, name, category, color, image_url'),
      supabase.from('preferences').select('item_id, score'),
    ]).then(([looksRes, itemsRes, prefsRes]) => {
      if (!looksRes.error && looksRes.data) setLooks(looksRes.data)
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data)
      const map: Record<string, number> = {}
      ;(prefsRes.data ?? []).forEach((r: { item_id: string; score: number }) => {
        map[r.item_id] = r.score
      })
      setPrefs(map)
      setLoading(false)
    })
  }, [])

  const generateWeek = async () => {
    setGenerating(true)
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError

      const usedIds = new Set<string>()
      const newLooks: { name: string; item_ids: string[] }[] = []

      for (let i = 0; i < 5; i++) {
        const event = EVENT_ORDER[i % EVENT_ORDER.length]
        const weather: Weather = {
          temp: 15 + Math.floor(Math.random() * 10),
          condition: ['clear', 'cloudy', 'rain'][Math.floor(Math.random() * 3)] as any,
          description: lang === 'ru' ? 'ясно' : 'clear',
        }
        const outfit = pickOutfit(items, i, weather, event, prefs, usedIds)
        outfit.forEach((it) => usedIds.add(it.id))

        const dayName = lang === 'ru' ? DAY_NAMES_RU[i] : DAY_NAMES_EN[i]
        const eventText = lang === 'ru' ? EVENT_LABELS[event].ru : EVENT_LABELS[event].en
        const weatherText = `${weather.temp}° ${weather.description}`
        newLooks.push({
          name: `${dayName}: ${eventText} · ${weatherText}`,
          item_ids: outfit.map((it) => it.id),
        })
      }

      const { error } = await supabase.from('looks').insert(
        newLooks.map((l) => ({ user_id: userData.user.id, ...l }))
      )
      if (error) throw error

      const { data } = await supabase
        .from('looks')
        .select('id, name, item_ids, created_at')
        .order('created_at', { ascending: false })
      if (data) setLooks(data)
      setMessage(
        lang === 'ru'
          ? '✅ Неделя образов собрана! 5 луков на будни.'
          : '✅ Week of looks generated! 5 looks for weekdays.'
      )
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="card muted">…</div>

  if (looks.length === 0 && items.length === 0)
    return (
      <div>
        <h1 className="screen-title">{lang === 'ru' ? 'Мои образы' : 'My looks'}</h1>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❐</div>
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
            {lang === 'ru' ? 'Образов пока нет' : 'No looks yet'}
          </div>
          <div className="muted mono" style={{ marginBottom: 16 }}>
            {lang === 'ru'
              ? 'Сохраните первый образ на экране «Сегодня»'
              : 'Save your first look on the Today screen'}
          </div>
          <div className="muted mono" style={{ fontSize: 11 }}>
            {lang === 'ru'
              ? '✳ Нажмите «Надеть это» — и образ появится здесь'
              : '✳ Tap "Wear this" — and the look will appear here'}
          </div>
        </div>
      </div>
    )

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Мои образы' : 'My looks'}</h1>
      {items.length >= 5 && (
        <button
          className="action-btn primary"
          style={{ width: '100%', marginBottom: 12 }}
          onClick={generateWeek}
          disabled={generating}
        >
          {generating
            ? lang === 'ru'
              ? 'Собираю неделю…'
              : 'Generating week…'
            : lang === 'ru'
              ? '📅 Собрать неделю'
              : '📅 Generate week'}
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {looks.map((look) => (
          <div key={look.id} className="card">
            <div className="row" style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{look.name}</span>
              <span className="muted mono" style={{ fontSize: 11 }}>
                {new Date(look.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="muted mono" style={{ fontSize: 11 }}>
              {look.item_ids.length} {lang === 'ru' ? 'вещей' : 'items'}
            </div>
          </div>
        ))}
      </div>
      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}