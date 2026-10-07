import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

const WEATHER = { temp: 18, cond: 'дождь' }
const EVENTS = ['офис', 'встреча 14:00']

function pickOutfit(items: Item[], seed: number): Item[] {
  if (items.length === 0) return []
  const byCat = (c: string) => items.filter((i) => i.category === c)
  const tops = byCat('tops')
  const bottoms = byCat('bottoms')
  const dresses = byCat('dresses')
  const shoes = byCat('shoes')
  const accessories = byCat('accessories')

  const pick = <T,>(arr: T[], offset: number): T | undefined =>
    arr.length ? arr[(seed + offset) % arr.length] : undefined

  const isOffice = EVENTS.includes('офис')
  const result: Item[] = []

  if (isOffice && tops.length && bottoms.length) {
    const t = pick(tops, 0)
    const b = pick(bottoms, 1)
    if (t) result.push(t)
    if (b) result.push(b)
  } else if (dresses.length) {
    const d = pick(dresses, 0)
    if (d) result.push(d)
  } else if (tops.length && bottoms.length) {
    const t = pick(tops, 0)
    const b = pick(bottoms, 1)
    if (t) result.push(t)
    if (b) result.push(b)
  } else {
    const any = pick(items, 0)
    if (any) result.push(any)
  }

  if (WEATHER.cond === 'дождь') {
    const s = pick(shoes, 2)
    if (s && !result.includes(s)) result.push(s)
  }
  const a = pick(accessories, 3)
  if (a) result.push(a)

  return result.slice(0, 5)
}

function reasonFor(): string {
  const parts: string[] = []
  if (EVENTS.includes('офис')) parts.push('офисный дресс-код')
  if (WEATHER.cond === 'дождь') parts.push('дождь — закрытая обувь')
  if (WEATHER.temp <= 18) parts.push('прохладно — возьмите слой сверху')
  return parts.length ? `Почему: ${parts.join(', ')}.` : 'Почему: настроение и ваш шкаф!'
}

export function TodayPage() {
  const [items, setItems] = useState<Item[]>([])
  const [seed, setSeed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url')
      .then(({ data, error }) => {
        if (!error && data) setItems(data)
        setLoading(false)
      })
  }, [])

  const outfit = pickOutfit(items, seed)

  const saveLook = async () => {
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const { error } = await supabase.from('looks').insert({
        user_id: userData.user.id,
        name: `Сегодня: ${EVENTS.join(', ')} · ${WEATHER.temp}° ${WEATHER.cond}`,
        item_ids: outfit.map((i) => i.id),
      })
      if (error) throw error
      setSaved(true)
      setMessage('✅ Образ сохранён в «Мои образы»!')
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    }
  }

  if (loading) return <div className="card muted">Стилист смотрит в шкаф...</div>
  if (items.length === 0)
    return <div className="card muted">Шкаф пуст — добавьте вещи, и стилист соберёт образ.</div>

  return (
    <div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>✳ Образ на сегодня</div>
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
          {saved ? '✅ Сохранено' : 'Взять этот образ'}
        </button>
        <button
          className="action-btn"
          onClick={() => {
            setSeed(seed + 1)
            setSaved(false)
          }}
        >
          Другой вариант
        </button>
      </div>
      {message && <div className="card muted">{message}</div>}
    </div>
  )
}