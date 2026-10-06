import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type WardrobeItem = {
  id: string
  name: string
  category: string
  color: string | null
}

const CATEGORIES = ['tops', 'bottoms', 'dresses', 'shoes', 'accessories']

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

export function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('tops')
  const [color, setColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [cardIndex, setCardIndex] = useState<number | null>(null)

  const loadItems = () => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setItems(data)
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const { error } = await supabase.from('wardrobe_items').insert({
        user_id: userData.user.id,
        name,
        category,
        color: color || null,
      })
      if (error) throw error
      setName('')
      setColor('')
      setShowForm(false)
      loadItems()
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="muted" style={{ padding: 16 }}>Открываем шкаф...</div>
  }

  const current = cardIndex !== null ? items[cardIndex] : null

  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>Гардероб</h1>
        <span className="muted">Все {items.length} →</span>
      </div>
      <div className="muted" style={{ marginBottom: 12 }}>AI уберёт фон и приведёт к единому виду</div>

      <div className="actions">
        <button className="action-btn" onClick={() => setMessage('✂ Обработка фото появится вместе с камерой. Скоро!')}>
          ✂ Обработать всё
        </button>
        <button className="action-btn" onClick={() => setShowForm(!showForm)}>
          📥 {showForm ? 'Скрыть форму' : 'Добавить вещь'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название (например, Юбка миди)"
            required
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Цвет (например, black)"
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <button type="submit" disabled={saving} className="action-btn primary" style={{ width: '100%' }}>
            {saving ? 'Сохраняем...' : 'Положить в шкаф'}
          </button>
        </form>
      )}

      {message && <div className="card muted">{message}</div>}

      {items.length === 0 ? (
        <div className="card muted">Пока пусто. Нажмите «📥 Добавить вещь» — и она ляжет в облачный шкаф.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              className="card"
              onClick={() => setCardIndex(i)}
              style={{ marginBottom: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 96, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 22 }}>{CATEGORY_ICON[item.category] ?? '🧺'}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.name}</div>
              <div className="muted" style={{ fontSize: 10 }}>
                {item.category}
                {item.color ? ` · ${item.color}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={() => setCardIndex(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 340, margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 8 }}>
              <strong>Карточка вещи</strong>
              <button className="action-btn" style={{ minWidth: 0, padding: '4px 10px' }} onClick={() => setCardIndex(null)}>✕</button>
            </div>
            <div style={{ fontSize: 44, textAlign: 'center', padding: '12px 0' }}>
              {CATEGORY_ICON[current.category] ?? '🧺'}
            </div>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{current.name}</div>
            <div className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
              {current.category}
              {current.color ? ` · ${current.color}` : ''}
            </div>
            <div className="row">
              <button className="action-btn" onClick={() => setCardIndex((cardIndex! - 1 + items.length) % items.length)}>Назад</button>
              <span className="muted">Style Twin</span>
              <button className="action-btn" onClick={() => setCardIndex((cardIndex! + 1) % items.length)}>Далее</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}