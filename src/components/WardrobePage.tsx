import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '',
  accessories: '👜',
  other: '🧺',
}

const WARDROBE_LIMIT = 100

export function WardrobePage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setItems(data)
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

      const { error: uploadError } = await supabase.storage
        .from('wardrobe')
        .upload(fileName, file)
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

      const { data } = await supabase
        .from('wardrobe_items')
        .select('id, name, category, color, image_url')
        .order('created_at', { ascending: false })
      if (data) setItems(data)
      // Трекинг первой загруженной вещи
      await trackEvent('first_item_uploaded', { filename: file.name, size: file.size })
      setMessage(
        lang === 'ru'
          ? '✅ Вещь добавлена! AI обработает фон.'
          : '✅ Item added! AI will process the background.'
      )
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

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
            {lang === 'ru'
              ? 'AI уберёт фон и приведёт к единому виду'
              : 'AI will remove the background and unify the look'}
          </div>
          <label className="action-btn primary" style={{ width: '100%', cursor: 'pointer', display: 'block' }}>
             {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
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

  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>
          {lang === 'ru' ? 'Гардероб' : 'Wardrobe'}
        </h1>
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
           {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
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
        {items.map((it) => (
          <div
            key={it.id}
            className="tile"
            style={{ height: 120, cursor: 'pointer', position: 'relative' }}
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
    </div>
  )
}