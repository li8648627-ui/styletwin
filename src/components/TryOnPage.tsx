import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

// Расширенный словарь иконок для всех возможных категорий
const CATEGORY_ICON: Record<string, string> = {
  tops: '',
  shirts: '',
  blouses: '👚',
  tshirts: '👕',
  sweaters: '🧥',
  hoodies: '🧥',
  jackets: '🧥',
  coats: '🧥',
  outerwear: '🧥',
  bottoms: '',
  pants: '',
  jeans: '',
  trousers: '',
  skirts: '👗',
  dresses: '',
  shoes: '',
  sneakers: '👟',
  boots: '👢',
  sandals: '👡',
  heels: '',
  accessories: '👜',
  bags: '👜',
  hats: '',
  scarves: '🧣',
  belts: '👔',
  jewelry: '💍',
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
  const [photo, setPhoto] = useState<string | null>(null)
  const [tryonCount, setTryonCount] = useState(0)
  const [message, setMessage] = useState('')
  const [completed, setCompleted] = useState(false)

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
    setCompleted(false)
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

      await trackEvent('first_tryon', { layers: selected.length })
      setCompleted(true)
      setMessage(
        lang === 'ru'
          ? ` Образ готов! (${tryonCount + 1}/${TRYON_LIMIT})`
          : `✳ Look ready! (${tryonCount + 1}/${TRYON_LIMIT})`
      )
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result as string)
      setMode('photo')
      setCompleted(false)
    }
    reader.readAsDataURL(file)
  }

  const completeness = Math.round((selected.length / MAX_LAYERS) * 100)

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Примерка' : 'Try-On'}</h1>
      <div className="muted mono" style={{ marginBottom: 14 }}>
        {lang === 'ru'
          ? 'Одежда по фигуре · 360° · слои с иконками.'
          : 'Clothing on figure · 360° · layers with icons.'}
      </div>

      {/* Переключатель режимов */}
      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          className="action-btn"
          style={{
            flex: 1,
            background: mode === 'mannequin' ? 'var(--accent)' : 'var(--card)',
            color: mode === 'mannequin' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => {
            setMode('mannequin')
            setCompleted(false)
          }}
        >
          {lang === 'ru' ? 'Манекен' : 'Mannequin'}
        </button>
        <button
          className="action-btn"
          style={{
            flex: 1,
            background: mode === 'photo' ? 'var(--accent)' : 'var(--card)',
            color: mode === 'photo' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => {
            setMode('photo')
            setCompleted(false)
          }}
        >
          {lang === 'ru' ? 'Моё фото' : 'My photo'}
        </button>
      </div>

      {/* Область предпросмотра */}
      <div className="card" style={{ marginBottom: 14, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mode === 'mannequin' ? (
          completed ? (
            <div style={{ textAlign: 'center' }}>
              <div className="row" style={{ marginBottom: 12, justifyContent: 'center' }}>
                <span style={{ fontWeight: 700 }}>
                  {lang === 'ru' ? ' Образ готов' : '✳ Look ready'}
                </span>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: `conic-gradient(var(--accent) ${completeness}%, #ece4d4 0)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 10,
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent-deep)' }}>
                    {selected.length}/{MAX_LAYERS}
                  </span>
                </span>
              </div>
              <div className="muted mono" style={{ marginBottom: 10, fontSize: 11 }}>
                {lang === 'ru' ? 'смотри спереди и сзади' : 'view front and back'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {selected.map((it) => (
                  <div key={it.id} className="tile" style={{ width: 64, height: 64 }}>
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 24 }}>{CATEGORY_ICON[it.category] ?? ''}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              {/* 3D манекен */}
              <div style={{ 
                position: 'relative', 
                width: 140, 
                height: 200, 
                margin: '0 auto',
                transform: 'perspective(500px) rotateY(0deg)',
                transformStyle: 'preserve-3d',
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 80,
                  height: 12,
                  background: 'radial-gradient(ellipse at center, rgba(101,78,44,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                  filter: 'blur(4px)',
                }} />
                
                <svg width="140" height="200" viewBox="0 0 140 200" style={{ position: 'relative', zIndex: 1 }}>
                  <defs>
                    <linearGradient id="bodyGradFront" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f0ebe3" />
                      <stop offset="50%" stopColor="#f7f2ea" />
                      <stop offset="100%" stopColor="#e8e0d5" />
                    </linearGradient>
                    <linearGradient id="bodyGradBack" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#e8e0d5" />
                      <stop offset="50%" stopColor="#f7f2ea" />
                      <stop offset="100%" stopColor="#f0ebe3" />
                    </linearGradient>
                    <filter id="shadow3d">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
                    </filter>
                  </defs>
                  
                  {view === 'front' ? (
                    <>
                      <circle cx="70" cy="25" r="14" fill="url(#bodyGradFront)" stroke="#d4c9b8" strokeWidth="1.5" filter="url(#shadow3d)" />
                      <path d="M 42 55 Q 70 50 98 55 L 105 165 Q 70 172 35 165 Z" fill="url(#bodyGradFront)" stroke="#d4c9b8" strokeWidth="1.5" filter="url(#shadow3d)" />
                      <path d="M 42 60 L 25 110 Q 22 115 26 118 Q 30 120 33 112 L 45 75" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="1.5" />
                      <path d="M 98 60 L 115 110 Q 118 115 114 118 Q 110 120 107 112 L 95 75" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="1.5" />
                      <ellipse cx="70" cy="100" rx="18" ry="40" fill="rgba(255,255,255,0.15)" />
                    </>
                  ) : (
                    <>
                      <circle cx="70" cy="25" r="14" fill="url(#bodyGradBack)" stroke="#d4c9b8" strokeWidth="1.5" filter="url(#shadow3d)" />
                      <path d="M 45 55 Q 70 52 95 55 L 100 165 Q 70 170 40 165 Z" fill="url(#bodyGradBack)" stroke="#d4c9b8" strokeWidth="1.5" filter="url(#shadow3d)" />
                      <path d="M 45 60 L 30 110 Q 27 115 31 118 Q 35 120 38 112 L 48 75" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="1.5" />
                      <path d="M 95 60 L 110 110 Q 113 115 109 118 Q 105 120 102 112 L 92 75" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="1.5" />
                    </>
                  )}
                </svg>
              </div>
              
              <div className="muted mono" style={{ fontSize: 11, marginTop: 12 }}>
                {selected.length === 0
                  ? lang === 'ru'
                    ? 'Выберите вещи ниже'
                    : 'Select items below'
                  : lang === 'ru'
                    ? `${selected.length} из ${MAX_LAYERS} выбрано`
                    : `${selected.length} of ${MAX_LAYERS} selected`}
              </div>
              
              <div className="actions" style={{ marginTop: 16, marginBottom: 0 }}>
                <button
                  className="action-btn"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: '6px 8px',
                    background: view === 'front' ? 'var(--accent-soft)' : 'var(--card)',
                    color: view === 'front' ? 'var(--accent-deep)' : 'var(--ink)',
                    borderColor: view === 'front' ? 'var(--accent)' : 'var(--hair)',
                  }}
                  onClick={() => setView('front')}
                >
                  {lang === 'ru' ? 'спереди' : 'front'}
                </button>
                <button
                  className="action-btn"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: '6px 8px',
                    background: view === 'back' ? 'var(--accent-soft)' : 'var(--card)',
                    color: view === 'back' ? 'var(--accent-deep)' : 'var(--ink)',
                    borderColor: view === 'back' ? 'var(--accent)' : 'var(--hair)',
                  }}
                  onClick={() => setView('back')}
                >
                  {lang === 'ru' ? 'сзади' : 'back'}
                </button>
              </div>
            </div>
          )
        ) : (
          <div style={{ width: '100%', textAlign: 'center' }}>
            {photo ? (
              <div>
                <img
                  src={photo}
                  alt="My photo"
                  style={{ maxHeight: 240, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
                />
                <div className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>
                  {lang === 'ru' ? 'ваше фото' : 'your photo'}
                </div>
              </div>
            ) : (
              <label className="action-btn primary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Счётчик слоёв */}
      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>
          {lang === 'ru' ? ' Примерочная' : '✳ Fitting room'}
        </span>
        <span className="muted mono">
          {selected.length} / {MAX_LAYERS} {lang === 'ru' ? 'слоёв' : 'layers'}
        </span>
      </div>

      {/* Список вещей — ИСПРАВЛЕННЫЙ */}
      <div className="muted mono" style={{ marginBottom: 8 }}>
        {lang === 'ru' ? 'Отметьте слои (до 5):' : 'Select layers (up to 5):'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map((it) => {
          const isSelected = selected.some((x) => x.id === it.id)
          const icon = CATEGORY_ICON[it.category] ?? ''
          return (
            <div
              key={it.id}
              className="card row"
              style={{
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-soft)' : 'var(--card)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--hair)',
                padding: '10px 12px',
                margin: 0,
              }}
              onClick={() => toggleItem(it)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                {/* Мини-превью: фото или иконка категории */}
                {it.image_url ? (
                  <img 
                    src={it.image_url} 
                    alt="" 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      objectFit: 'cover', 
                      borderRadius: 6,
                      border: '1px solid var(--hair)',
                    }} 
                  />
                ) : (
                  <span style={{ 
                    fontSize: 24, 
                    width: 32, 
                    height: 32, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    {icon}
                  </span>
                )}
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {it.name}
                  {it.color && <span style={{ color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>· {it.color}</span>}
                </span>
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={{ pointerEvents: 'none', width: 18, height: 18, accentColor: 'var(--accent)' }}
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