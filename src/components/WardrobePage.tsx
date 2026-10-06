import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type WardrobeItem = {
  id: string
  name: string
  category: string
  color: string | null
}

const CATEGORIES = ['tops', 'bottoms', 'dresses', 'shoes', 'accessories']

export function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('tops')
  const [color, setColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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
    return <div style={{ padding: '16px', color: '#888' }}>Открываем шкаф...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Мой гардероб · вещей: {items.length}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '6px 12px', background: '#d946ef', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          {showForm ? 'Скрыть' : '+ Добавить'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          style={{ background: 'white', borderRadius: '8px', padding: '12px', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название (например, Юбка миди)"
            required
            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Цвет (например, black)"
            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
          />
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '10px', background: saving ? '#ccc' : '#111', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            {saving ? 'Сохраняем...' : 'Положить в шкаф'}
          </button>
          {message && <div style={{ color: '#c00', fontSize: '14px' }}>{message}</div>}
        </form>
      )}

      {items.length === 0 && (
        <p style={{ color: '#888' }}>Пока пусто. Нажмите «+ Добавить», чтобы положить первую вещь!</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{ background: 'white', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <span>{item.name}</span>
            <span style={{ color: '#888', fontSize: '12px' }}>
              {item.category}
              {item.color ? ` · ${item.color}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}