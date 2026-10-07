import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = { id: string; name: string; category: string; image_url: string | null }

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

const MAX_LAYERS = 5

export function TryOnPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [view, setView] = useState<'front' | 'back'>('front')
  const [tried, setTried] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, image_url')
      .then(({ data, error }) => {
        if (!error && data) setItems(data)
        setLoading(false)
      })
  }, [])

  const toggle = (id: string) => {
    setTried(false)
    setMessage('')
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_LAYERS ? prev : [...prev, id]
    )
  }

  const layerItems = selected
    .map((id) => items.find((i) => i.id === id))
    .filter((x): x is Item => Boolean(x))

  const saveLook = async () => {
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const { error } = await supabase.from('looks').insert({
        user_id: userData.user.id,
        name: `Примерка: ${layerItems.map((i) => i.name).join(' + ')}`,
        item_ids: selected,
      })
      if (error) throw error
      setMessage('✅ Образ из примерочной сохранён в «Мои образы»!')
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    }
  }

  if (loading) return <div className="muted" style={{ padding: 16 }}>Готовим примерочную...</div>

  return (
    <div>
      <h1 className="screen-title">Примерка</h1>
      <div className="muted" style={{ marginBottom: 12 }}>Одежда по фигуре · 360° · слои с иконками.</div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <button
            className="action-btn"
            style={{ background: view === 'front' ? '#111' : '#fff', color: view === 'front' ? '#fff' : '#111' }}
            onClick={() => setView('front')}
          >
            спереди
          </button>
          <button
            className="action-btn"
            style={{ background: view === 'back' ? '#111' : '#fff', color: view === 'back' ? '#fff' : '#111' }}
            onClick={() => setView('back')}
          >
            сзади
          </button>
        </div>
        <div style={{ position: 'relative', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 96, opacity: 0.25 }}>{view === 'front' ? '🧍' : '🧍‍♀️'}</div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {(view === 'back' ? [...layerItems].reverse() : layerItems).map((it) => (
              <div
                key={it.id}
                style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 999, padding: '2px 10px', fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
              >
                {CATEGORY_ICON[it.category] ?? '🧺'} {it.name}
              </div>
            ))}
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span>{tried ? '✳ Образ готов' : '✳ Примерочная'}</span>
          <span className="muted">{selected.length} / {MAX_LAYERS} слоёв</span>
        </div>
        {tried && <div className="muted" style={{ textAlign: 'center', marginTop: 4 }}>смотри спереди и сзади</div>}
      </div>

      <div className="muted" style={{ margin: '8px 0' }}>Отметьте слои (до 5):</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {items.map((item) => (
          <label key={item.id} className="card row" style={{ marginBottom: 0, padding: 10, cursor: 'pointer' }}>
            <span style={{ fontSize: 14 }}>
              {CATEGORY_ICON[item.category] ?? '🧺'} {item.name}
            </span>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
          </label>
        ))}
      </div>

      <button className="action-btn primary" style={{ width: '100%' }} disabled={selected.length === 0} onClick={() => setTried(true)}>
        ✳ Примерить
      </button>
      {tried && (
        <button className="action-btn" style={{ width: '100%', marginTop: 8 }} onClick={saveLook}>
          Сохранить в образы
        </button>
      )}
      {message && <div className="card muted" style={{ marginTop: 8 }}>{message}</div>}
    </div>
  )
}