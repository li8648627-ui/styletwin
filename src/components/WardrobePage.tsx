import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

export function WardrobePage() {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

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
    setUploading(true)
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
    } catch (err: any) {
      alert(`❌ ${err.message}`)
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
          <label className="action-btn primary" style={{ width: '100%', cursor: 'pointer' }}>
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

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>
          {lang === 'ru' ? 'Гардероб' : 'Wardrobe'}
        </h1>
        <span className="section-link mono">{items.length}</span>
      </div>
      <div className="muted mono" style={{ marginBottom: 12 }}>
        {lang === 'ru' ? 'AI уберёт фон и приведёт к единому виду' : 'AI will remove the background and unify the look'}
      </div>
      <label className="action-btn primary" style={{ width: '100%', marginBottom: 14, cursor: 'pointer' }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((it) => (
          <div
            key={it.id}
            className="tile"
            style={{ width: 'calc(33.333% - 6px)', height: 120, cursor: 'pointer' }}
          >
            {it.image_url ? (
              <img src={it.image_url} alt={it.name} />
            ) : (
              <span style={{ fontSize: 40 }}>{CATEGORY_ICON[it.category] ?? ''}</span>
            )}
          </div>
        ))}
      </div>
      {uploading && <div className="muted mono" style={{ textAlign: 'center', marginTop: 12 }}>…</div>}
    </div>
  )
}