import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

/* ---------- AI-примерка (встроено) ---------- */
const FAL_API_KEY = (import.meta as any).env?.VITE_FAL_API_KEY

interface TryOnResult {
  success: boolean
  imageUrl?: string
  error?: string
}

async function virtualTryOn(personImage: string, garmentImage: string): Promise<TryOnResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'API ключ Fal.ai не настроен. Добавьте VITE_FAL_API_KEY в .env' }
  }
  try {
    const response = await fetch('https://fal.run/fal-ai/idm-vton', {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ person_image: personImage, garment_image: garmentImage, garment_description: '' }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }
    const data = await response.json()
    const imageUrl = data.output?.image?.url || data.image?.url
    if (!imageUrl) throw new Error('AI не вернул изображение')
    return { success: true, imageUrl }
  } catch (error: any) {
    console.error('Virtual try-on error:', error)
    return { success: false, error: error.message || 'Ошибка AI-примерки' }
  }
}

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕', shirts: '👕', blouses: '👚', tshirts: '👕', sweaters: '🧥', hoodies: '🧥',
  jackets: '🧥', coats: '🧥', outerwear: '🧥', bottoms: '👖', pants: '👖', jeans: '👖',
  trousers: '👖', skirts: '👗', dresses: '👗', shoes: '👟', sneakers: '👟', boots: '👢',
  sandals: '👡', heels: '👠', accessories: '👜', bags: '👜', hats: '🧢', scarves: '🧣',
  belts: '👔', jewelry: '💍', other: '🧺',
}

const COLOR_HEX: Record<string, string> = {
  red: '#d95f5f', white: '#f4f1e8', black: '#33322f', blue: '#5b7fb8', navy: '#31406b',
  green: '#69a37c', yellow: '#d9bc55', pink: '#d992ac', beige: '#d8c8a8', brown: '#8f6f4d',
  gray: '#9c9c98', grey: '#9c9c98', красный: '#d95f5f', белый: '#f4f1e8', чёрный: '#33322f',
  черный: '#33322f', синий: '#5b7fb8', зелёный: '#69a37c', зеленый: '#69a37c',
  бежевый: '#d8c8a8', коричневый: '#8f6f4d', серый: '#9c9c98',
}

/* Порядок отрисовки: низ → верх → верхняя одежда → обувь → аксессуар */
const DRAW_ORDER: Record<string, number> = {
  dresses: 1, skirts: 2, bottoms: 2, pants: 2, jeans: 2, trousers: 2,
  tops: 3, shirts: 3, blouses: 3, tshirts: 3, sweaters: 4, hoodies: 4,
  jackets: 5, coats: 5, outerwear: 5, shoes: 6, sneakers: 6, boots: 6,
  sandals: 6, heels: 6, hats: 7, scarves: 7, belts: 7, bags: 8, accessories: 8, jewelry: 8,
}

const MAX_LAYERS = 5
const TRYON_LIMIT = 3

/* Формы одежды, повторяющие силуэт манекена (viewBox 320×320) */
function GarmentShape({ category }: { category: string }) {
  switch (category) {
    case 'tops': case 'shirts': case 'blouses': case 'tshirts': case 'sweaters': case 'hoodies':
      return (
        <>
          <path d="M 104 96 Q 160 86 216 96 L 224 196 Q 160 208 96 196 Z" />
          <path d="M 104 100 L 84 160 Q 82 168 90 170 L 108 128 Z" />
          <path d="M 216 100 L 236 160 Q 238 168 230 170 L 212 128 Z" />
        </>
      )
    case 'jackets': case 'coats': case 'outerwear':
      return (
        <>
          <path d="M 102 94 Q 160 84 218 94 L 230 240 Q 160 252 90 240 Z" />
          <path d="M 102 98 L 80 165 Q 78 173 86 175 L 106 130 Z" />
          <path d="M 218 98 L 240 165 Q 242 173 234 175 L 214 130 Z" />
        </>
      )
    case 'bottoms': case 'pants': case 'jeans': case 'trousers':
      return (
        <>
          <path d="M 116 186 L 158 186 L 150 292 L 122 292 Z" />
          <path d="M 162 186 L 204 186 L 198 292 L 170 292 Z" />
        </>
      )
    case 'skirts':
      return <path d="M 112 178 L 208 178 L 228 252 Q 160 266 92 252 Z" />
    case 'dresses':
      return <path d="M 104 96 Q 160 86 216 96 L 238 272 Q 160 288 82 272 Z" />
    case 'shoes': case 'sneakers': case 'sandals': case 'heels':
      return (
        <>
          <ellipse cx="138" cy="296" rx="17" ry="8" />
          <ellipse cx="182" cy="296" rx="17" ry="8" />
        </>
      )
    case 'boots':
      return (
        <>
          <path d="M 126 262 h 24 v 30 q 0 6 -6 6 h -12 q -6 0 -6 -6 Z" />
          <path d="M 170 262 h 24 v 30 q 0 6 -6 6 h -12 q -6 0 -6 -6 Z" />
        </>
      )
    case 'hats':
      return <path d="M 130 44 Q 160 14 190 44 L 190 54 Q 160 42 130 54 Z" />
    case 'scarves':
      return <path d="M 132 88 Q 160 102 188 88 L 188 106 Q 160 120 132 106 Z" />
    case 'belts':
      return <rect x="110" y="180" width="100" height="12" rx="5" />
    case 'bags': case 'accessories':
      return (
        <>
          <path d="M 208 118 L 240 178" strokeWidth="4" fill="none" stroke="#8f6f4d" />
          <rect x="226" y="176" width="36" height="42" rx="7" />
        </>
      )
    case 'jewelry':
      return <circle cx="160" cy="112" r="9" />
    default:
      return <path d="M 104 96 Q 160 86 216 96 L 224 196 Q 160 208 96 196 Z" />
  }
}

export function TryOnPage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item[]>([])
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [mode, setMode] = useState<'mannequin' | 'photo'>('mannequin')
  const [view, setView] = useState<'front' | 'back'>('front')
  const [photo, setPhoto] = useState<string | null>(null)
  const [tryonCount, setTryonCount] = useState(0)
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const isBack = view === 'back'

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
        setPositions((prevPos) => {
          const newPos = { ...prevPos }
          delete newPos[it.id]
          return newPos
        })
        return prev.filter((x) => x.id !== it.id)
      }
      if (prev.length >= MAX_LAYERS) return prev
      return [...prev, it]
    })
    setAiResult(null)
  }

  /* ---------- DRAG & DROP (только режим фото) ---------- */
  const handleDragStart = (itemId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setDragging(itemId)
  }

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const rawX = ((clientX - rect.left) / rect.width) * 100
    const rawY = ((clientY - rect.top) / rect.height) * 100
    const x = Math.max(0, Math.min(80, rawX - 10))
    const y = Math.max(0, Math.min(80, rawY - 10))
    setPositions((prev) => ({ ...prev, [dragging]: { x, y } }))
  }

  const handleDragEnd = () => setDragging(null)

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove)
      window.addEventListener('touchend', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [dragging, selected])

  /* ---------- Счётчик ---------- */
  const bumpCounter = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: usageData } = await supabase
      .from('usage')
      .select('id, tryons_this_month, month_start')
      .eq('user_id', userData.user.id)
      .single()
    const now = new Date()
    const monthStart = usageData?.month_start
      ? new Date(usageData.month_start)
      : new Date(now.getFullYear(), now.getMonth(), 1)
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

    if (mode === 'photo' && photo) {
      const garment = selected.find((s) => s.image_url)
      if (garment) {
        setIsProcessing(true)
        setAiResult(null)
        const res = await virtualTryOn(photo, garment.image_url!)
        setIsProcessing(false)
        if (res.success && res.imageUrl) {
          setAiResult(res.imageUrl)
          await bumpCounter()
          await trackEvent('first_tryon', { layers: selected.length, ai: true })
          setMessage(
            lang === 'ru'
              ? `✳ AI-примерка готова! (${tryonCount + 1}/${TRYON_LIMIT})`
              : `✳ AI try-on ready! (${tryonCount + 1}/${TRYON_LIMIT})`
          )
          return
        }
        setMessage(`❌ ${res.error ?? (lang === 'ru' ? 'Ошибка AI' : 'AI error')}`)
        return
      }
    }

    await bumpCounter()
    await trackEvent('first_tryon', { layers: selected.length, ai: false })
    setMessage(
      lang === 'ru'
        ? `✳ Образ готов! (${tryonCount + 1}/${TRYON_LIMIT})`
        : `✳ Look ready! (${tryonCount + 1}/${TRYON_LIMIT})`
    )
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result as string)
      setMode('photo')
      setAiResult(null)
    }
    reader.readAsDataURL(file)
  }

  const sortedSelected = [...selected].sort(
    (a, b) => (DRAW_ORDER[a.category] ?? 9) - (DRAW_ORDER[b.category] ?? 9)
  )

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Примерка' : 'Try-On'}</h1>
      <div className="muted mono" style={{ marginBottom: 14 }}>
        {mode === 'mannequin'
          ? lang === 'ru'
            ? 'Одежда по фигуре · 360° · слои с иконками.'
            : 'Clothing on figure · 360° · layers with icons.'
          : lang === 'ru'
            ? 'Перетаскивайте вещи по фото.'
            : 'Drag items on your photo.'}
      </div>

      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          className="action-btn"
          style={{ flex: 1, background: mode === 'mannequin' ? 'var(--accent)' : 'var(--card)', color: mode === 'mannequin' ? '#fff' : 'var(--ink)' }}
          onClick={() => { setMode('mannequin'); setAiResult(null) }}
        >
          {lang === 'ru' ? 'Манекен' : 'Mannequin'}
        </button>
        <button
          className="action-btn"
          style={{ flex: 1, background: mode === 'photo' ? 'var(--accent)' : 'var(--card)', color: mode === 'photo' ? '#fff' : 'var(--ink)' }}
          onClick={() => { setMode('photo'); setAiResult(null) }}
        >
          {lang === 'ru' ? 'Моё фото' : 'My photo'}
        </button>
      </div>

      <div
        ref={previewRef}
        className="card"
        style={{ marginBottom: 14, padding: 0, position: 'relative', width: '100%', height: 320, overflow: 'hidden', cursor: mode === 'photo' && dragging ? 'grabbing' : 'default' }}
      >
        {isProcessing ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', zIndex: 100 }}>
            <div style={{ width: 48, height: 48, border: '4px solid var(--hair)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div className="muted mono" style={{ marginTop: 16, fontSize: 13 }}>
              {lang === 'ru' ? 'AI надевает одежду...' : 'AI is dressing you...'}
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : aiResult ? (
          <img src={aiResult} alt="AI try-on" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : mode === 'mannequin' ? (
          /* МАНЕКЕН + ОДЕЖДА ПО ФИГУРЕ */
          <svg width="100%" height="320" viewBox="0 0 320 320" style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
            <defs>
              <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f0ebe3" />
                <stop offset="50%" stopColor="#f7f2ea" />
                <stop offset="100%" stopColor="#e8e0d5" />
              </linearGradient>
              {sortedSelected.map((it) =>
                it.image_url ? (
                  <pattern key={it.id} id={`pat-${it.id}`} patternUnits="objectBoundingBox" width="1" height="1">
                    <image href={it.image_url} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
                  </pattern>
                ) : null
              )}
            </defs>

            {/* Тело */}
            <circle cx="160" cy="50" r="28" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" />
            <path d="M 110 100 Q 160 90 210 100 L 225 280 Q 160 295 95 280 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" />
            <path d="M 110 110 L 80 190 Q 75 200 80 205 Q 87 210 93 195 L 115 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
            <path d="M 210 110 L 240 190 Q 245 200 240 205 Q 233 210 227 195 L 205 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />

            {/* Одежда по фигуре */}
            {sortedSelected.map((it) => {
              const fill = it.image_url
                ? `url(#pat-${it.id})`
                : COLOR_HEX[(it.color ?? '').toLowerCase()] ?? '#d8c8a8'
              return (
                <g
                  key={it.id}
                  fill={fill}
                  stroke="#b9a888"
                  strokeWidth="1.5"
                  opacity="0.95"
                  transform={isBack ? 'translate(320,0) scale(-1,1)' : undefined}
                >
                  <GarmentShape category={it.category} />
                </g>
              )
            })}
          </svg>
        ) : photo ? (
          <>
            <img src={photo} alt="My photo" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 0 }} />
            {selected.map((it, idx) => {
              const pos = positions[it.id] ?? { x: 35, y: 25 }
              return (
                <div
                  key={it.id}
                  style={{
                    position: 'absolute',
                    top: `${pos.y}%`,
                    left: `${pos.x}%`,
                    width: '30%',
                    height: '35%',
                    zIndex: idx + 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                  onMouseDown={(e) => handleDragStart(it.id, e)}
                  onTouchStart={(e) => handleDragStart(it.id, e)}
                >
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))', pointerEvents: 'none' }} />
                  ) : (
                    <span style={{ fontSize: 64, opacity: 0.85, pointerEvents: 'none' }}>{CATEGORY_ICON[it.category] ?? '👕'}</span>
                  )}
                </div>
              )
            })}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
            <label className="action-btn primary" style={{ cursor: 'pointer' }}>
              📷 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div className="muted mono" style={{ fontSize: 11, background: 'rgba(255,255,255,0.9)', padding: '4px 12px', borderRadius: 12, display: 'inline-block' }}>
            {aiResult
              ? lang === 'ru' ? 'AI-примерка' : 'AI try-on'
              : selected.length === 0
                ? lang === 'ru' ? 'Выберите вещи ниже' : 'Select items below'
                : `${selected.length} из ${MAX_LAYERS} выбрано`}
          </div>
        </div>
      </div>

      {aiResult && (
        <button className="action-btn" style={{ width: '100%', marginBottom: 12 }} onClick={() => setAiResult(null)}>
          {lang === 'ru' ? '🔄 Попробовать другую вещь' : '🔄 Try another item'}
        </button>
      )}

      {mode === 'mannequin' && !aiResult && (
        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            className="action-btn"
            style={{ flex: 1, fontSize: 11, padding: '6px 8px', background: view === 'front' ? 'var(--accent-soft)' : 'var(--card)', color: view === 'front' ? 'var(--accent-deep)' : 'var(--ink)', borderColor: view === 'front' ? 'var(--accent)' : 'var(--hair)' }}
            onClick={() => setView('front')}
          >
            {lang === 'ru' ? 'спереди' : 'front'}
          </button>
          <button
            className="action-btn"
            style={{ flex: 1, fontSize: 11, padding: '6px 8px', background: view === 'back' ? 'var(--accent-soft)' : 'var(--card)', color: view === 'back' ? 'var(--accent-deep)' : 'var(--ink)', borderColor: view === 'back' ? 'var(--accent)' : 'var(--hair)' }}
            onClick={() => setView('back')}
          >
            {lang === 'ru' ? 'сзади' : 'back'}
          </button>
        </div>
      )}

      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>{lang === 'ru' ? '✳ Примерочная' : '✳ Fitting room'}</span>
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
          const icon = CATEGORY_ICON[it.category] ?? '🧺'
          return (
            <div
              key={it.id}
              className="card row"
              style={{ cursor: 'pointer', background: isSelected ? 'var(--accent-soft)' : 'var(--card)', borderColor: isSelected ? 'var(--accent)' : 'var(--hair)', padding: '10px 12px', margin: 0 }}
              onClick={() => toggleItem(it)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                {it.image_url ? (
                  <img src={it.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--hair)' }} />
                ) : (
                  <span style={{ fontSize: 24, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
                )}
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {it.name}
                  {it.color && <span style={{ color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>· {it.color}</span>}
                </span>
              </span>
              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ pointerEvents: 'none', width: 18, height: 18, accentColor: 'var(--accent)' }} />
            </div>
          )
        })}
      </div>

      <button className="action-btn primary" style={{ width: '100%' }} onClick={tryOn} disabled={selected.length === 0 || isProcessing}>
        {isProcessing
          ? lang === 'ru' ? '⏳ AI работает...' : '⏳ AI processing...'
          : `✳ ${lang === 'ru' ? 'Примерить' : 'Try on'}`}
      </button>

      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}