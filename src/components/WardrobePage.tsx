import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null; price: number | null }
type Look = { id: string; item_ids: string[] }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕', shirts: '👕', blouses: '👚', tshirts: '👕', sweaters: '🧥', hoodies: '🧥',
  jackets: '🧥', coats: '🧥', outerwear: '🧥', bottoms: '👖', pants: '👖', jeans: '👖',
  trousers: '👖', skirts: '👗', dresses: '👗', shoes: '👟', sneakers: '👟', boots: '👢',
  sandals: '👡', heels: '👠', accessories: '👜', bags: '👜', hats: '🧢', scarves: '🧣',
  belts: '👔', jewelry: '💍', other: '🧺',
}

const CATEGORY_LABELS: Record<string, { ru: string; en: string }> = {
  tops: { ru: 'Верх', en: 'Tops' },
  shirts: { ru: 'Рубашки', en: 'Shirts' },
  blouses: { ru: 'Блузы', en: 'Blouses' },
  tshirts: { ru: 'Футболки', en: 'T-shirts' },
  sweaters: { ru: 'Свитеры', en: 'Sweaters' },
  hoodies: { ru: 'Худи', en: 'Hoodies' },
  jackets: { ru: 'Куртки', en: 'Jackets' },
  coats: { ru: 'Пальто', en: 'Coats' },
  outerwear: { ru: 'Верхняя одежда', en: 'Outerwear' },
  bottoms: { ru: 'Низ', en: 'Bottoms' },
  pants: { ru: 'Брюки', en: 'Pants' },
  jeans: { ru: 'Джинсы', en: 'Jeans' },
  trousers: { ru: 'Брюки', en: 'Trousers' },
  skirts: { ru: 'Юбки', en: 'Skirts' },
  dresses: { ru: 'Платья', en: 'Dresses' },
  shoes: { ru: 'Обувь', en: 'Shoes' },
  sneakers: { ru: 'Кроссовки', en: 'Sneakers' },
  boots: { ru: 'Ботинки', en: 'Boots' },
  sandals: { ru: 'Сандалии', en: 'Sandals' },
  heels: { ru: 'Каблуки', en: 'Heels' },
  accessories: { ru: 'Аксессуары', en: 'Accessories' },
  bags: { ru: 'Сумки', en: 'Bags' },
  hats: { ru: 'Головные уборы', en: 'Hats' },
  scarves: { ru: 'Шарфы', en: 'Scarves' },
  belts: { ru: 'Ремни', en: 'Belts' },
  jewelry: { ru: 'Украшения', en: 'Jewelry' },
  other: { ru: 'Другое', en: 'Other' },
}

const WARDROBE_LIMIT = 100

export function WardrobePage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [looks, setLooks] = useState<Look[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [cardIndex, setCardIndex] = useState<number | null>(null)
  const [priceInput, setPriceInput] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('wardrobe_items').select('id, name, category, color, image_url, price').order('created_at', { ascending: false }),
      supabase.from('looks').select('id, item_ids'),
    ]).then(([itemsRes, looksRes]) => {
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data)
      if (!looksRes.error && looksRes.data) setLooks(looksRes.data)
      setLoading(false)
    })
  }, [])

  const handleFile = async (file: File) => {
    if (items.length >= WARDROBE_LIMIT) {
      onShowPro('wardrobe_limit')
      return
    }
    setUploading(true)
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError

      const fileExt = file.name.split('.').pop()
      const fileName = `${userData.user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('wardrobe').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('wardrobe').getPublicUrl(fileName)
      const imageUrl = urlData.publicUrl

      const { error: insertError } = await supabase.from('wardrobe_items').insert({
        user_id: userData.user.id,
        name: file.name.replace(/\.[^/.]+$/, ''),
        category: 'other',
        image_url: imageUrl,
      })
      if (insertError) throw insertError

      const [itemsRes, looksRes] = await Promise.all([
        supabase.from('wardrobe_items').select('id, name, category, color, image_url, price').order('created_at', { ascending: false }),
        supabase.from('looks').select('id, item_ids'),
      ])
      if (itemsRes.data) setItems(itemsRes.data)
      if (looksRes.data) setLooks(looksRes.data)
      await trackEvent('first_item_uploaded', { filename: file.name })
      setMessage(lang === 'ru' ? '✅ Вещь добавлена! AI обработает фон.' : '✅ Item added! AI will process the background.')
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const openCard = (i: number) => {
    setCardIndex(i)
    const it = items[i]
    setPriceInput(it.price != null ? String(it.price) : '')
  }

  const stepCard = (dir: 1 | -1) => {
    if (cardIndex === null) return
    const next = (cardIndex + dir + items.length) % items.length
    openCard(next)
  }

  const savePrice = async () => {
    if (cardIndex === null) return
    const it = items[cardIndex]
    const val = parseFloat(priceInput.replace(',', '.'))
    const price = isNaN(val) || val < 0 ? null : val
    const { error } = await supabase.from('wardrobe_items').update({ price }).eq('id', it.id)
    if (!error) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, price } : x)))
    }
  }

  const deleteItem = async (id: string) => {
    if (!window.confirm(lang === 'ru' ? 'Удалить вещь из гардероба?' : 'Delete this item?')) return
    const { error } = await supabase.from('wardrobe_items').delete().eq('id', id)
    if (!error) {
      setItems((prev) => prev.filter((x) => x.id !== id))
      setCardIndex(null)
      setMessage(lang === 'ru' ? '🗑 Вещь удалена.' : '🗑 Item deleted.')
    }
  }

  const wearsOf = (id: string) => looks.filter((l) => (l.item_ids ?? []).includes(id)).length

  if (loading) return <div className="card muted">…</div>

  if (items.length === 0)
    return (
      <div>
        <h1 className="screen-title">{lang === 'ru' ? 'Гардероб' : 'Wardrobe'}</h1>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
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
          <div className="muted mono" style={{ marginBottom: 16 }}>
            {lang === 'ru' ? 'AI уберёт фон и приведёт к единому виду' : 'AI will remove the background and unify the look'}
          </div>
          <label className="action-btn primary" style={{ width: '100%', cursor: 'pointer', display: 'block' }}>
            📥 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </label>
        </div>
      </div>
    )

  const current = cardIndex !== null ? items[cardIndex] : null
  const currentWears = current ? wearsOf(current.id) : 0
  const currentCpw =
    current && current.price != null && currentWears > 0
      ? `$${(current.price / currentWears).toFixed(2)}`
      : null

  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>{lang === 'ru' ? 'Гардероб' : 'Wardrobe'}</h1>
        <span className="section-link mono">{items.length}</span>
      </div>
      <div className="muted mono" style={{ marginBottom: 14 }}>
        {lang === 'ru' ? 'AI уберёт фон и приведёт к единому виду' : 'AI will remove the background and unify the look'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <label className="action-btn primary" style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
          ✂ {lang === 'ru' ? 'Обработать всё' : 'Process all'}
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = e.target.files
              if (files) Array.from(files).forEach(handleFile)
            }}
          />
        </label>
        <label className="action-btn" style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
          📥 {lang === 'ru' ? `Загрузить фото (${items.length})` : `Upload photo (${items.length})`}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {items.map((it, i) => (
          <div
            key={it.id}
            className="tile"
            style={{ height: 120, cursor: 'pointer', position: 'relative' }}
            onClick={() => openCard(i)}
          >
            {it.image_url ? (
              <img
                src={it.image_url}
                alt={it.name}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                  ;(e.target as HTMLImageElement).nextElementSibling?.setAttribute('style', 'display:flex')
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : null}
            <span
              style={{
                fontSize: 40,
                display: it.image_url ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              {CATEGORY_ICON[it.category] ?? '🧺'}
            </span>
          </div>
        ))}
      </div>

      {uploading && <div className="muted mono" style={{ textAlign: 'center', marginTop: 12 }}>…</div>}
      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}

      {/* КАРТОЧКА ВЕЩИ (как в прототипе) */}
      {current && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,22,28,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
            padding: 20,
          }}
          onClick={() => setCardIndex(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 360, width: '100%', padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="muted mono" style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                {lang === 'ru' ? 'карточка вещи' : 'item card'}
              </span>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted)', fontWeight: 700 }}
                onClick={() => setCardIndex(null)}
              >
                ✕
              </button>
            </div>

            <div className="tile" style={{ height: 180, marginBottom: 12 }}>
              {current.image_url ? (
                <img src={current.image_url} alt={current.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 64 }}>{CATEGORY_ICON[current.category] ?? '🧺'}</span>
              )}
            </div>

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
              {current.name}
            </div>

            <table style={{ width: '100%', fontSize: 13, marginBottom: 10 }}>
              <tbody>
                <tr>
                  <td className="muted">{lang === 'ru' ? 'Категория' : 'Category'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {lang === 'ru' ? (CATEGORY_LABELS[current.category]?.ru ?? current.category) : (CATEGORY_LABELS[current.category]?.en ?? current.category)}
                  </td>
                </tr>
                <tr>
                  <td className="muted">{lang === 'ru' ? 'Цвет' : 'Color'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{current.color ?? '—'}</td>
                </tr>
                <tr>
                  <td className="muted">{lang === 'ru' ? 'В образах' : 'In looks'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{currentWears}</td>
                </tr>
                <tr>
                  <td className="muted">CPW</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-deep)' }}>
                    {currentCpw ?? (lang === 'ru' ? '—' : '—')}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="row" style={{ marginBottom: 12 }}>
              <span className="muted mono" style={{ fontSize: 11 }}>{lang === 'ru' ? 'Цена, $' : 'Price, $'}</span>
              <input
                value={priceInput}
                placeholder="0.00"
                inputMode="decimal"
                style={{ width: 90, textAlign: 'right' }}
                onChange={(e) => setPriceInput(e.target.value)}
                onBlur={savePrice}
              />
            </div>

            <div className="actions" style={{ marginBottom: 8 }}>
              <button className="action-btn" onClick={() => stepCard(-1)}>
                {lang === 'ru' ? 'Назад' : 'Back'}
              </button>
              <button className="action-btn" onClick={() => stepCard(1)}>
                {lang === 'ru' ? 'Далее' : 'Next'}
              </button>
            </div>

            <button
              className="muted mono"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, width: '100%', textAlign: 'center' }}
              onClick={() => deleteItem(current.id)}
            >
              {lang === 'ru' ? 'удалить вещь' : 'delete item'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}