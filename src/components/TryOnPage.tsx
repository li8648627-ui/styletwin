import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '',
}

const MAX_LAYERS = 5
const TRYON_LIMIT = 3

export function TryOnPage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item[]>([])
  const [mode, setMode] = useState<'mannequin' | 'photo'>('mannequin')
  const [view, setView] = useState<'front' | 'back'>('front')
  const [rotation, setRotation] = useState(0)
  const [photo, setPhoto] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [tryonCount, setTryonCount] = useState(0)

  useEffect(() => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url')
      .then(({ data, error }) => {
        if (!error && data) setItems(data)
      })
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('usage')
          .select('tryons_this_month, month_start')
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: usage }) => {
            if (usage) {
              const now = new Date()
              const monthStart = new Date(usage.month_start)
              const isNewMonth =
                now.getMonth() !== monthStart.getMonth() ||
                now.getFullYear() !== monthStart.getFullYear()
              setTryonCount(isNewMonth ? 0 : usage.tryons_this_month)
            }
          })
      }
    })
  }, [])

  const toggleItem = (it: Item) => {
    setSelected((prev) => {
      const exists = prev.find((x) => x.id === it.id)
      if (exists) return prev.filter((x) => x.id !== it.id)
      if (prev.length >= MAX_LAYERS) return prev
      return [...prev, it]
    })
  }

  const tryOn = async () => {
    if (selected.length === 0) {
      setMessage(lang === 'ru' ? 'Выберите хотя бы одну вещь' : 'Select at least one item')
      return
    }
    if (tryonCount >= TRYON_LIMIT) {
      onShowPro('tryon_limit')
      return
    }
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError

      const { data: usageData } = await supabase
        .from('usage')
        .select('id, tryons_this_month, month_start')
        .eq('user_id', userData.user.id)
        .single()

      const now = new Date()
      const monthStart = usageData?.month_start ? new Date(usageData.month_start) : new Date(now.getFullYear(), now.getMonth(), 1)
      const isNewMonth =
        now.getMonth() !== monthStart.getMonth() ||
        now.getFullYear() !== monthStart.getFullYear()

      if (isNewMonth || !usageData) {
        await supabase.from('usage').upsert({
          user_id: userData.user.id,
          tryons_this_month: 1,
          month_start: now.toISOString(),
        })
        setTryonCount(1)
      } else {
        await supabase
          .from('usage')
          .update({ tryons_this_month: usageData.tryons_this_month + 1 })
          .eq('id', usageData.id)
        setTryonCount(usageData.tryons_this_month + 1)
      }

      // ✅ Трекинг первой примерки — ВНУТРИ функции tryOn, после успешного обновления
      await trackEvent('first_tryon', { layers: selected.length, mode })

      setMessage(
        lang === 'ru'
          ? `✳ Образ готов! (${tryonCount + 1}/${TRYON_LIMIT} бесплатных примерок)`
          : `✳ Look ready! (${tryonCount + 1}/${TRYON_LIMIT} free try-ons)`
      )
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Примерка' : 'Try-On'}</h1>
      <div className="muted mono" style={{ marginBottom: 10 }}>
        {lang === 'ru'
          ? 'Одежда по фигуре · 360° · слои с иконками.'
          : 'Clothing on figure · 360° · layers with icons.'}
      </div>

      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          className="action-btn"
          style={{
            background: mode === 'mannequin' ? 'var(--accent)' : undefined,
            color: mode === 'mannequin' ? '#fff' : undefined,
          }}
          onClick={() => setMode('mannequin')}
        >
          {lang === 'ru' ? 'Манекен' : 'Mannequin'}
        </button>
        <button
          className="action-btn"
          style={{
            background: mode === 'photo' ? 'var(--accent)' : undefined,
            color: mode === 'photo' ? '#fff' : undefined,
          }}
          onClick={() => setMode('photo')}
        >
          {lang === 'ru' ? 'Моё фото' : 'My photo'}
        </button>
      </div>

      {mode === 'mannequin' && (
        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            className="action-btn"
            style={{
              background: view === 'front' ? 'var(--accent)' : undefined,
              color: view === 'front' ? '#fff' : undefined,
            }}
            onClick={() => setView('front')}
          >
            {lang === 'ru' ? 'спереди' : 'front'}
          </button>
          <button
            className="action-btn"
            style={{
              background: view === 'back' ? 'var(--accent)' : undefined,
              color: view === 'back' ? '#fff' : undefined,
            }}
            onClick={() => setView('back')}
          >
            {lang === 'ru' ? 'сзади' : 'back'}
          </button>
        </div>
      )}

      <div
        className="card"
        style={{
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {mode === 'mannequin' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 80 }}>
              {view === 'front' ? '' : '🧍‍♀️'}
            </div>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>
              {lang === 'ru'
                ? '← потяните манекен, чтобы повернуть'
                : '← drag mannequin to rotate'}
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
        ) : photo ? (
          <img
            src={photo}
            alt="photo"
            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
          />
        ) : (
          <label className="action-btn primary" style={{ cursor: 'pointer' }}>
            📷 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          </label>
        )}
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>
          {lang === 'ru' ? ' Примерочная' : '✳ Fitting room'}
        </span>
        <span className="muted mono">
          {selected.length} / {MAX_LAYERS} {lang === 'ru' ? 'слоёв' : 'layers'}
        </span>
      </div>

      <div className="muted mono" style={{ marginBottom: 8 }}>
        {lang === 'ru' ? 'Отметьте слои (до 5):' : 'Select layers (up to 5):'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map((it) => {
          const isSelected = selected.some((x) => x.id === it.id)
          return (
            <div
              key={it.id}
              className="card row"
              style={{
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-soft)' : undefined,
                borderColor: isSelected ? 'var(--accent)' : undefined,
                padding: '10px 12px',
              }}
              onClick={() => toggleItem(it)}
            >
              <span style={{ fontWeight: 600 }}>
                {CATEGORY_ICON[it.category] ?? '🧺'} {it.name}
                {it.color ? ` · ${it.color}` : ''}
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={{ pointerEvents: 'none' }}
              />
            </div>
          )
        })}
      </div>

      <button
        className="action-btn primary"
        style={{ width: '100%' }}
        onClick={tryOn}
        disabled={selected.length === 0}
      >
        ✳ {lang === 'ru' ? 'Примерить' : 'Try on'}
      </button>

      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}