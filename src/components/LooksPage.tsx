import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type LookItem = { id: string; name: string; category: string }
type Look = { id: string; name: string; item_ids: string[] }

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

export function LooksPage() {
  const [looks, setLooks] = useState<Look[]>([])
  const [items, setItems] = useState<LookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => {
    Promise.all([
      supabase.from('looks').select('id, name, item_ids').order('created_at', { ascending: true }),
      supabase.from('wardrobe_items').select('id, name, category'),
    ]).then(([looksRes, itemsRes]) => {
      if (!looksRes.error && looksRes.data) setLooks(looksRes.data)
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [])

  const toggleItem = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const { error } = await supabase.from('looks').insert({
        user_id: userData.user.id,
        name,
        item_ids: selected,
      })
      if (error) throw error
      setName('')
      setSelected([])
      setShowForm(false)
      load()
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="muted" style={{ padding: 16 }}>Открываем образы...</div>

  const itemById = (id: string) => items.find((i) => i.id === id)

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>Мои образы</h1>
        <button className="action-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Скрыть' : '+ Собрать образ'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название образа (например, Офис в понедельник)"
            required
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <div className="muted">Отметьте вещи из шкафа:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {items.map((item) => (
              <label key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <span>{CATEGORY_ICON[item.category] ?? '🧺'} {item.name}</span>
              </label>
            ))}
          </div>
          <button type="submit" disabled={saving || selected.length === 0} className="action-btn primary" style={{ width: '100%' }}>
            {saving ? 'Сохраняем...' : 'Сохранить образ'}
          </button>
        </form>
      )}

      {message && <div className="card muted">{message}</div>}

      {looks.length === 0 ? (
        <div className="card muted">Образов пока нет. Нажмите «+ Собрать образ» — и шкаф превратится в комплекты.</div>
      ) : (
        looks.map((look) => (
          <div key={look.id} className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>✨ {look.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {look.item_ids.map((id) => {
                const it = itemById(id)
                return it ? (
                  <span key={id} className="chip">
                    {CATEGORY_ICON[it.category] ?? '🧺'} {it.name}
                  </span>
                ) : null
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}