import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { removeBackground } from '@imgly/background-removal'

type WardrobeItem = {
  id: string
  name: string
  category: string
  color: string | null
  image_url: string | null
  price: number | null
  wears: number
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
  const [price, setPrice] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [aiCut, setAiCut] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [cardIndex, setCardIndex] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('tops')
  const [editColor, setEditColor] = useState('')
  const [editPrice, setEditPrice] = useState('')

  const loadItems = () => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url, price, wears')
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

  const cutBackground = async (file: File): Promise<File> => {
    const blob = await removeBackground(file, {
      progress: (_key, current, total) => {
        if (total > 0) {
          setMessage(`✂ AI убирает фон: ${Math.round((current / total) * 100)}%`)
        }
      },
    })
    const base = file.name.replace(/\.[^/.]+$/, '') || 'photo'
    return new File([blob], `${base}-cut.png`, { type: 'image/png' })
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError

      let imageUrl: string | null = null
      if (photo) {
        const finalFile = aiCut ? await cutBackground(photo) : photo
        const path = `${userData.user.id}/${Date.now()}-${finalFile.name}`
        const { error: uploadError } = await supabase.storage.from('wardrobe-photos').upload(path, finalFile)
        if (uploadError) throw uploadError
        imageUrl = supabase.storage.from('wardrobe-photos').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('wardrobe_items').insert({
        user_id: userData.user.id,
        name,
        category,
        color: color || null,
        price: price ? Number(price) : null,
        image_url: imageUrl,
      })
      if (error) throw error
      setName('')
      setColor('')
      setPrice('')
      setPhoto(null)
      setShowForm(false)
      loadItems()
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!current) return
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .update({
          name: editName.trim() || current.name,
          category: editCategory,
          color: editColor || null,
          price: editPrice ? Number(editPrice) : null,
        })
        .eq('id', current.id)
      if (error) throw error
      setEditing(false)
      loadItems()
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleWear = async () => {
    if (!current) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .update({ wears: (current.wears ?? 0) + 1 })
        .eq('id', current.id)
      if (error) throw error
      loadItems()
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!current) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      if (current.image_url) {
        const path = current.image_url.split('/wardrobe-photos/')[1]
        if (path) {
          await supabase.storage.from('wardrobe-photos').remove([path])
        }
      }
      const { error } = await supabase.from('wardrobe_items').delete().eq('id', current.id)
      if (error) throw error
      setCardIndex(null)
      setConfirmDelete(false)
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
        <button className="action-btn" onClick={() => setMessage('✂ Обработка уже доступна при загрузке фото и по кнопке для новых вещей!')} disabled={saving}>
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
            placeholder="Название (например, Красные кеды)"
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
            placeholder="Цвет (например, red)"
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Цена (необязательно), например 2500"
            type="number"
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={aiCut} onChange={(e) => setAiCut(e.target.checked)} />
            ✂ Убрать фон с фото (AI)
          </label>
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
              onClick={() => {
                setCardIndex(i)
                setConfirmDelete(false)
                setEditing(false)
              }}
              style={{ marginBottom: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 96, cursor: 'pointer' }}
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <div style={{ fontSize: 22 }}>{CATEGORY_ICON[item.category] ?? '🧺'}</div>
              )}
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
          onClick={() => {
            setCardIndex(null)
            setConfirmDelete(false)
            setEditing(false)
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 340, margin: 0, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 8 }}>
              <strong>Карточка вещи</strong>
              <button
                className="action-btn"
                style={{ minWidth: 0, padding: '4px 10px' }}
                onClick={() => {
                  setCardIndex(null)
                  setConfirmDelete(false)
                  setEditing(false)
                }}
              >
                ✕
              </button>
            </div>
            {current.image_url ? (
              <img src={current.image_url} alt={current.name} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} />
            ) : (
              <div style={{ fontSize: 44, textAlign: 'center', padding: '12px 0' }}>
                {CATEGORY_ICON[current.category] ?? '🧺'}
              </div>
            )}

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input value={editColor} onChange={(e) => setEditColor(e.target.value)} placeholder="Цвет" style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
                <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Цена" type="number" style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
                <button className="action-btn primary" style={{ width: '100%' }} onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{current.name}</div>
                <div className="muted" style={{ textAlign: 'center', marginBottom: 4 }}>
                  {current.category}
                  {current.color ? ` · ${current.color}` : ''}
                </div>
                <div className="muted" style={{ textAlign: 'center', marginBottom: 12, fontSize: 12 }}>
                  Выходов: {current.wears ?? 0}
                  {current.price != null ? ` · Цена: ${current.price}` : ''}
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <button
                    className="action-btn"
                    onClick={() => {
                      setEditing(true)
                      setEditName(current.name)
                      setEditCategory(current.category)
                      setEditColor(current.color ?? '')
                      setEditPrice(current.price != null ? String(current.price) : '')
                    }}
                  >
                    ✏️ Редактировать
                  </button>
                  <button className="action-btn" onClick={handleWear}>👗 +1 выход</button>
                </div>
                <div className="row">
                  <button className="action-btn" onClick={() => setCardIndex((cardIndex! - 1 + items.length) % items.length)}>Назад</button>
                  <span className="muted">Style Twin</span>
                  <button className="action-btn" onClick={() => setCardIndex((cardIndex! + 1) % items.length)}>Далее</button>
                </div>
                <button
                  className="action-btn"
                  style={{
                    width: '100%',
                    marginTop: 8,
                    background: confirmDelete ? '#c0392b' : '#ffe5e5',
                    color: confirmDelete ? '#fff' : '#c0392b',
                  }}
                  onClick={handleDelete}
                >
                  {confirmDelete ? 'Точно удалить?' : '🗑 Удалить вещь'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}