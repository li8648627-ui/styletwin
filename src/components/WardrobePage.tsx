import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { removeBackground } from '@imgly/background-removal'

type WardrobeItem = {
  id: string
  name: string
  category: string
  color: string | null
  image_url: string | null
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [aiCut, setAiCut] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [cardIndex, setCardIndex] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadItems = () => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url')
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
        image_url: imageUrl,
      })
      if (error) throw error
      setName('')
      setColor('')
      setPhoto(null)
      setShowForm(false)
      setMessage(aiCut && photo ? '✂ Фон удалён, вещь в шкафу!' : '')
      loadItems()
    } catch (err: any) {
      setMessage(`❌ Ошибка: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleProcessAll = async () => {
    setSaving(true)
    setMessage('✂ Ищем фото для обработки...')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const withPhoto = items.filter((i) => i.image_url)
      if (withPhoto.length === 0) {
        setMessage('Пока нет фото для обработки.')
        return
      }
      let done = 0
      for (const item of withPhoto) {
        setMessage(`✂ Обрабатываем вещь ${done + 1} из ${withPhoto.length}...`)
        const res = await fetch(item.image_url!)
        const blob = await res.blob()
        const file = new File([blob], `${item.name}.png`, { type: blob.type || 'image/png' })
        const cutted = await cutBackground(file)
        const path = `${userData.user.id}/${Date.now()}-${done}-cut.png`
        const { error: upErr } = await supabase.storage.from('wardrobe-photos').upload(path, cutted)
        if (upErr) throw upErr
        const newUrl = supabase.storage.from('wardrobe-photos').getPublicUrl(path).data.publicUrl
        const { error: updErr } = await supabase.from('wardrobe_items').update({ image_url: newUrl }).eq('id', item.id)
        if (updErr) throw updErr
        const oldPath = item.image_url!.split('/wardrobe-photos/')[1]
        if (oldPath) {
          await supabase.storage.from('wardrobe-photos').remove([oldPath])
        }
        done += 1
      }
      setMessage(`✂ Готово! Обработано вещей: ${done}. Фон удалён, вид единый.`)
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
        <button className="action-btn" onClick={handleProcessAll} disabled={saving}>
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
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 340, margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 8 }}>
              <strong>Карточка вещи</strong>
              <button
                className="action-btn"
                style={{ minWidth: 0, padding: '4px 10px' }}
                onClick={() => {
                  setCardIndex(null)
                  setConfirmDelete(false)
                }}
              >
                ✕
              </button>
            </div>
            {current.image_url ? (
              <img src={current.image_url} alt={current.name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} />
            ) : (
              <div style={{ fontSize: 44, textAlign: 'center', padding: '12px 0' }}>
                {CATEGORY_ICON[current.category] ?? '🧺'}
              </div>
            )}
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
          </div>
        </div>
      )}
    </div>
  )
}
