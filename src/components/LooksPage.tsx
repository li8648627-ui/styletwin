import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'

type Look = { id: string; name: string; item_ids: string[]; created_at: string }

export function LooksPage() {
  const { lang } = useLang()
  const [looks, setLooks] = useState<Look[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('looks')
      .select('id, name, item_ids, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setLooks(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="card muted">…</div>

  if (looks.length === 0)
    return (
      <div>
        <h1 className="screen-title">{lang === 'ru' ? 'Мои образы' : 'My looks'}</h1>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❐</div>
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
            {lang === 'ru' ? 'Образов пока нет' : 'No looks yet'}
          </div>
          <div className="muted mono" style={{ marginBottom: 16 }}>
            {lang === 'ru'
              ? 'Сохраните первый образ на экране «Сегодня»'
              : 'Save your first look on the Today screen'}
          </div>
          <div className="muted mono" style={{ fontSize: 11 }}>
            {lang === 'ru'
              ? '✳ Нажмите «Надеть это» — и образ появится здесь'
              : '✳ Tap "Wear this" — and the look will appear here'}
          </div>
        </div>
      </div>
    )

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Мои образы' : 'My looks'}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {looks.map((look) => (
          <div key={look.id} className="card">
            <div className="row" style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{look.name}</span>
              <span className="muted mono" style={{ fontSize: 11 }}>
                {new Date(look.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="muted mono" style={{ fontSize: 11 }}>
              {look.item_ids.length} {lang === 'ru' ? 'вещей' : 'items'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}