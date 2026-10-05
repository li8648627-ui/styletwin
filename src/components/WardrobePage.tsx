import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type WardrobeItem = {
  id: string
  name: string
  category: string
  color: string | null
}

export function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  if (loading) {
    return <div style={{ padding: '16px', color: '#888' }}>Открываем шкаф...</div>
  }

  return (
    <div>
      <h2>Мой гардероб · вещей: {items.length}</h2>
      {items.length === 0 && (
        <p style={{ color: '#888' }}>Пока пусто. Вещи появятся здесь совсем скоро.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
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