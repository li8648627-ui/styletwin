import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const CATEGORY_ICON: Record<string, string> = {
  tops: '',
  shirts: '👕',
  blouses: '',
  tshirts: '',
  sweaters: '🧥',
  hoodies: '🧥',
  jackets: '🧥',
  coats: '🧥',
  outerwear: '',
  bottoms: '👖',
  pants: '👖',
  jeans: '',
  trousers: '',
  skirts: '👗',
  dresses: '👗',
  shoes: '👟',
  sneakers: '',
  boots: '👢',
  sandals: '👡',
  heels: '👠',
  accessories: '',
  bags: '👜',
  hats: '🧢',
  scarves: '',
  belts: '👔',
  jewelry: '💍',
  other: '🧺',
}

// Базовые позиции (в пикселях от верхнего левого угла контейнера 320×320)
const LAYER_POSITIONS: Record<string, { top: number; left: number; width: number; height: number }> = {
  tops: { top: 80, left: 70, width: 180, height: 110 },
  shirts: { top: 80, left: 70, width: 180, height: 110 },
  blouses: { top: 80, left: 70, width: 180, height: 110 },
  tshirts: { top: 80, left: 70, width: 180, height: 110 },
  sweaters: { top: 75, left: 65, width: 190, height: 120 },
  hoodies: { top: 70, left: 65, width: 190, height: 125 },
  jackets: { top: 70, left: 60, width: 200, height: 130 },
  coats: { top: 65, left: 60, width: 200, height: 140 },
  outerwear: { top: 65, left: 60, width: 200, height: 140 },
  bottoms: { top: 175, left: 80, width: 160, height: 130 },
  pants: { top: 175, left: 80, width: 160, height: 130 },
  jeans: { top: 175, left: 80, width: 160, height: 130 },
  trousers: { top: 175, left: 80, width: 160, height: 130 },
  skirts: { top: 175, left: 75, width: 170, height: 110 },
  dresses: { top: 75, left: 70, width: 180, height: 220 },
  shoes: { top: 280, left: 80, width: 160, height: 40 },
  sneakers: { top: 280, left: 80, width: 160, height: 40 },
  boots: { top: 255, left: 80, width: 160, height: 65 },
  sandals: { top: 290, left: 80, width: 160, height: 30 },
  heels: { top: 280, left: 80, width: 160, height: 40 },
  accessories: { top: 50, left: 90, width: 140, height: 50 },
  bags: { top: 190, left: 200, width: 80, height: 80 },
  hats: { top: 15, left: 90, width: 140, height: 50 },
  scarves: { top: 65, left: 80, width: 160, height: 50 },
  belts: { top: 165, left: 80, width: 160, height: 25 },
  jewelry: { top: 60, left: 110, width: 100, height: 40 },
}

const MAX_LAYERS = 5
const TRYON_LIMIT = 3

export function TryOnPage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item[]>([])
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<'mannequin' | 'photo'>('mannequin')
  const [view, setView] = useState<'front' | 'back'>('front')
  const [photo, setPhoto] = useState<string | null>(null)
  const [tryonCount, setTryonCount] = useState(0)
  const [message, setMessage] = useState('')

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
      if (exists) {
        // Удаляем вещь и её размер
        setSizes((prevSizes) => {
          const newSizes = { ...prevSizes }
          delete newSizes[it.id]
          return newSizes
        })
        return prev.filter((x) => x.id !== it.id)
      }
      if (prev.length >= MAX_LAYERS) return prev
      // Добавляем вещь с размером по умолчанию 1.0
      setSizes((prevSizes) => ({ ...prevSizes, [it.id]: 1.0 }))
      return [...prev, it]
    })
  }

  const updateSize = (itemId: string, newSize: number) => {
    setSizes((prev) => ({ ...prev, [itemId]: newSize }))
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
      setMessage(
        lang === 'ru'
          ? `✳ Образ готов! (${tryonCount + 1}/${TRYON_LIMIT})`
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
    }
    reader.readAsDataURL(file)
  }

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
          onClick={() => setMode('mannequin')}
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
          onClick={() => setMode('photo')}
        >
          {lang === 'ru' ? 'Моё фото' : 'My photo'}
        </button>
      </div>

      {/* Область предпросмотра */}
      <div 
        className="card" 
        style={{ 
          marginBottom: 14,
          padding: 0,
          position: 'relative',
          width: '100%',
          height: 320,
          overflow: 'hidden',
        }}
      >
        {/* Базовый слой: манекен или фото */}
        {mode === 'mannequin' ? (
          <svg 
            width="100%" 
            height="320" 
            viewBox="0 0 320 320" 
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}
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
                <circle cx="160" cy="50" r="28" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 110 100 Q 160 90 210 100 L 225 280 Q 160 295 95 280 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 110 110 L 80 190 Q 75 200 80 205 Q 87 210 93 195 L 115 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 210 110 L 240 190 Q 245 200 240 205 Q 233 210 227 195 L 205 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
              </>
            ) : (
              <>
                <circle cx="160" cy="50" r="28" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 115 100 Q 160 95 205 100 L 220 280 Q 160 292 100 280 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 115 110 L 85 190 Q 80 200 85 205 Q 92 210 98 195 L 118 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 205 110 L 235 190 Q 240 200 235 205 Q 228 210 222 195 L 202 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
              </>
            )}
          </svg>
        ) : (
          photo ? (
            <img
              src={photo}
              alt="My photo"
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                zIndex: 0,
              }}
            />
          ) : (
            <div style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 0,
            }}>
              <label className="action-btn primary" style={{ cursor: 'pointer' }}>
                📷 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
            </div>
          )
        )}

        {/* Наложение выбранных вещей с учётом размера */}
        {selected.map((it, idx) => {
          const basePos = LAYER_POSITIONS[it.category] ?? LAYER_POSITIONS['tops']
          const size = sizes[it.id] ?? 1.0
          const scaledWidth = basePos.width * size
          const scaledHeight = basePos.height * size
          const offsetX = (basePos.width - scaledWidth) / 2
          const offsetY = (basePos.height - scaledHeight) / 2
          
          return (
            <div
              key={it.id}
              style={{
                position: 'absolute',
                top: basePos.top + offsetY,
                left: basePos.left + offsetX,
                width: scaledWidth,
                height: scaledHeight,
                zIndex: idx + 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
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
                <span style={{ fontSize: 64 * size, opacity: 0.8 }}>
                  {CATEGORY_ICON[it.category] ?? '👕'}
                </span>
              )}
            </div>
          )
        })}

        {/* Подпись снизу */}
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 20,
        }}>
          <div className="muted mono" style={{ fontSize: 11 }}>
            {selected.length === 0
              ? lang === 'ru' ? 'Выберите вещи ниже' : 'Select items below'
              : `${selected.length} из ${MAX_LAYERS} выбрано`}
          </div>
        </div>
      </div>

      {/* Переключатель спереди/сзади */}
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
      )}

      {/* Счётчик слоёв */}
      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>
          {lang === 'ru' ? ' Примерочная' : '✳ Fitting room'}
        </span>
        <span className="muted mono">
          {selected.length} / {MAX_LAYERS} {lang === 'ru' ? 'слоёв' : 'layers'}
        </span>
      </div>

      {/* Список вещей с контролами размера */}
      <div className="muted mono" style={{ marginBottom: 8 }}>
        {lang === 'ru' ? 'Отметьте слои (до 5):' : 'Select layers (up to 5):'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map((it) => {
          const isSelected = selected.some((x) => x.id === it.id)
          const icon = CATEGORY_ICON[it.category] ?? '🧺'
          const currentSize = sizes[it.id] ?? 1.0
          
          return (
            <div key={it.id}>
              <div
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
                    <span style={{ fontSize: 24, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              
              {/* Слайдер размера для выбранной вещи */}
              {isSelected && (
                <div style={{ 
                  padding: '8px 12px', 
                  background: 'var(--object)', 
                  borderRadius: '0 0 12px 12px',
                  marginTop: -6,
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <span className="muted mono" style={{ fontSize: 11, minWidth: 40 }}>
                    {lang === 'ru' ? 'Размер:' : 'Size:'}
                  </span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={currentSize}
                    onChange={(e) => updateSize(it.id, parseFloat(e.target.value))}
                    style={{ flex: 1, height: 20 }}
                  />
                  <span className="muted mono" style={{ fontSize: 11, minWidth: 30, textAlign: 'right' }}>
                    {currentSize.toFixed(1)}×
                  </span>
                </div>
              )}
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