import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const CATEGORY_ICON: Record<string, string> = {
  tops: '',
  shirts: '👕',
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
  dresses: '👗',
  shoes: '👟',
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

// Позиции для наложения вещей на манекен (в процентах от контейнера)
const LAYER_POSITIONS: Record<string, { top: string; left: string; width: string; height: string }> = {
  tops: { top: '25%', left: '20%', width: '60%', height: '35%' },
  shirts: { top: '25%', left: '20%', width: '60%', height: '35%' },
  blouses: { top: '25%', left: '20%', width: '60%', height: '35%' },
  tshirts: { top: '25%', left: '20%', width: '60%', height: '35%' },
  sweaters: { top: '25%', left: '18%', width: '64%', height: '38%' },
  hoodies: { top: '22%', left: '18%', width: '64%', height: '40%' },
  jackets: { top: '22%', left: '15%', width: '70%', height: '42%' },
  coats: { top: '20%', left: '15%', width: '70%', height: '45%' },
  outerwear: { top: '20%', left: '15%', width: '70%', height: '45%' },
  bottoms: { top: '55%', left: '25%', width: '50%', height: '40%' },
  pants: { top: '55%', left: '25%', width: '50%', height: '40%' },
  jeans: { top: '55%', left: '25%', width: '50%', height: '40%' },
  trousers: { top: '55%', left: '25%', width: '50%', height: '40%' },
  skirts: { top: '55%', left: '22%', width: '56%', height: '35%' },
  dresses: { top: '25%', left: '20%', width: '60%', height: '65%' },
  shoes: { top: '88%', left: '25%', width: '50%', height: '12%' },
  sneakers: { top: '88%', left: '25%', width: '50%', height: '12%' },
  boots: { top: '80%', left: '25%', width: '50%', height: '20%' },
  sandals: { top: '90%', left: '25%', width: '50%', height: '10%' },
  heels: { top: '88%', left: '25%', width: '50%', height: '12%' },
  accessories: { top: '15%', left: '30%', width: '40%', height: '15%' },
  bags: { top: '60%', left: '65%', width: '25%', height: '25%' },
  hats: { top: '5%', left: '30%', width: '40%', height: '15%' },
  scarves: { top: '20%', left: '25%', width: '50%', height: '15%' },
  belts: { top: '52%', left: '25%', width: '50%', height: '8%' },
  jewelry: { top: '18%', left: '35%', width: '30%', height: '12%' },
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
          ? `✳ Образ готов! (${tryonCount + 1}/${TRYON_LIMIT})`
          : `✳ Look ready! (${tryonCount + 1}/${TRYON_LIMIT})`
      )
    } catch (err: any) {
      setMessage(` ${err.message}`)
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

      {/* Область предпросмотра с наложением вещей */}
      <div 
        className="card" 
        style={{ 
          marginBottom: 14, 
          minHeight: 320, 
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Базовый слой: манекен или фото */}
        {mode === 'mannequin' ? (
          <div style={{ position: 'relative', width: '100%', height: 320 }}>
            {/* SVG манекен */}
            <svg 
              width="100%" 
              height="320" 
              viewBox="0 0 200 320" 
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f0ebe3" />
                  <stop offset="50%" stopColor="#f7f2ea" />
                  <stop offset="100%" stopColor="#e8e0d5" />
                </linearGradient>
                <filter id="shadow3d">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
                </filter>
              </defs>
              
              {view === 'front' ? (
                <>
                  <circle cx="100" cy="40" r="20" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                  <path d="M 60 80 Q 100 70 140 80 L 150 260 Q 100 275 50 260 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                  <path d="M 60 90 L 35 170 Q 30 180 35 185 Q 42 190 48 175 L 68 115" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                  <path d="M 140 90 L 165 170 Q 170 180 165 185 Q 158 190 152 175 L 132 115" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                </>
              ) : (
                <>
                  <circle cx="100" cy="40" r="20" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                  <path d="M 65 80 Q 100 75 135 80 L 145 260 Q 100 272 55 260 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                  <path d="M 65 90 L 40 170 Q 35 180 40 185 Q 47 190 53 175 L 70 115" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                  <path d="M 135 90 L 160 170 Q 165 180 160 185 Q 153 190 147 175 L 130 115" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                </>
              )}
            </svg>

            {/* Наложение выбранных вещей */}
            {selected.map((it, idx) => {
              const pos = LAYER_POSITIONS[it.category] ?? LAYER_POSITIONS['tops']
              return (
                <div
                  key={it.id}
                  style={{
                    position: 'absolute',
                    top: pos.top,
                    left: pos.left,
                    width: pos.width,
                    height: pos.height,
                    zIndex: idx + 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {it.image_url ? (
                    <img 
                      src={it.image_url} 
                      alt={it.name}
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                      }} 
                    />
                  ) : (
                    <span style={{ fontSize: 48, opacity: 0.7 }}>
                      {CATEGORY_ICON[it.category] ?? ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Режим фото */
          <div style={{ position: 'relative', width: '100%', height: 320 }}>
            {photo ? (
              <>
                <img
                  src={photo}
                  alt="My photo"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                />
                {/* Наложение выбранных вещей на фото */}
                {selected.map((it, idx) => {
                  const pos = LAYER_POSITIONS[it.category] ?? LAYER_POSITIONS['tops']
                  return (
                    <div
                      key={it.id}
                      style={{
                        position: 'absolute',
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        height: pos.height,
                        zIndex: idx + 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {it.image_url ? (
                        <img 
                          src={it.image_url} 
                          alt={it.name}
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                          }} 
                        />
                      ) : (
                        <span style={{ fontSize: 48, opacity: 0.7 }}>
                          {CATEGORY_ICON[it.category] ?? '👕'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </>
            ) : (
              <label className="action-btn primary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                📷 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Переключатель спереди/сзади (только для манекена) */}
      {mode === 'mannequin' && (
        <div className="actions" style={{ marginBottom: 12 }}>
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
            onClick={() => {
              setView('front')
              setCompleted(false)
            }}
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
            onClick={() => {
              setView('back')
              setCompleted(false)
            }}
          >
            {lang === 'ru' ? 'сзади' : 'back'}
          </button>
        </div>
      )}

      {/* Счётчик слоёв */}
      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>
          {lang === 'ru' ? '✳ Примерочная' : ' Fitting room'}
        </span>
        <span className="muted mono">
          {selected.length} / {MAX_LAYERS} {lang === 'ru' ? 'слоёв' : 'layers'}
        </span>
      </div>

      {/* Список вещей */}
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